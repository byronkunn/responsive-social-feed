create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_user_action_created_idx
on public.rate_limit_events (user_id, action, created_at desc);

alter table public.rate_limit_events enable row level security;

grant all on public.rate_limit_events to service_role;
grant usage, select on sequence public.rate_limit_events_id_seq to service_role;

create or replace function public.check_rate_limit(
  action_name text,
  max_events int,
  window_duration interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  recent_count int;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.rate_limit_events
  where created_at < now() - interval '2 days';

  select count(*) into recent_count
  from public.rate_limit_events
  where user_id = caller_id
    and action = action_name
    and created_at >= now() - window_duration;

  if recent_count >= max_events then
    return false;
  end if;

  insert into public.rate_limit_events (user_id, action)
  values (caller_id, action_name);

  return true;
end;
$$;

with ranked_reports as (
  select
    id,
    row_number() over (
      partition by reporter_id, target_type, target_id
      order by created_at desc, id desc
    ) as duplicate_rank
  from public.moderation_reports
  where status = 'pending' and reporter_id is not null
)
update public.moderation_reports
set status = 'dismissed',
    moderator_note = 'Auto-dismissed duplicate pending report before duplicate-report enforcement.',
    resolved_at = now()
where id in (
  select id
  from ranked_reports
  where duplicate_rank > 1
);

create unique index moderation_reports_one_pending_per_target_idx
on public.moderation_reports (reporter_id, target_type, target_id)
where status = 'pending' and reporter_id is not null;

drop function if exists public.submit_moderation_report(text, text, text);

create or replace function public.submit_moderation_report(
  p_target_type text,
  p_target_id text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  report_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.check_rate_limit('report:create', 10, interval '1 hour') then
    raise exception 'Report limit reached. Try again later.' using errcode = '42501';
  end if;

  select id into report_id
  from public.moderation_reports
  where reporter_id = caller_id
    and moderation_reports.target_type = p_target_type
    and moderation_reports.target_id = p_target_id
    and status = 'pending'
  limit 1;

  if report_id is not null then
    return report_id;
  end if;

  insert into public.moderation_reports (reporter_id, target_type, target_id, reason)
  values (caller_id, p_target_type, p_target_id, btrim(p_reason))
  returning id into report_id;

  return report_id;
end;
$$;

create or replace function public.moderate_post(
  target_post_id uuid,
  action text,
  reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_author_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_has_moderation_permission('moderate_content') then
    raise exception 'Content moderation permission required' using errcode = '42501';
  end if;

  update public.posts
  set moderation_status = case
      when action = 'hide' then 'hidden'
      when action = 'remove' then 'removed'
      when action = 'restore' then 'visible'
      else moderation_status
    end,
    moderated_by = caller_id,
    moderated_at = now(),
    moderation_reason = nullif(btrim(reason), '')
  where id = target_post_id
  returning author_id into target_author_id;

  if not found then
    raise exception 'Post not found';
  end if;

  insert into public.moderation_actions (
    moderator_id,
    target_profile_id,
    target_type,
    target_id,
    action_type,
    reason
  )
  values (
    caller_id,
    target_author_id,
    'post',
    target_post_id::text,
    case
      when action = 'hide' then 'hide_post'
      when action = 'remove' then 'remove_post'
      else 'restore_post'
    end,
    reason
  );

  perform public.create_notification(target_author_id, caller_id, 'system', target_post_id);
end;
$$;

create or replace function public.set_user_restriction(
  target_profile_id uuid,
  target_status text,
  reason text default '',
  expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_has_moderation_permission('manage_users') then
    raise exception 'User moderation permission required' using errcode = '42501';
  end if;
  if target_profile_id = caller_id then
    raise exception 'Moderators cannot restrict themselves' using errcode = '42501';
  end if;

  if target_status = 'active' then
    delete from public.moderation_user_restrictions where profile_id = target_profile_id;
  else
    insert into public.moderation_user_restrictions (
      profile_id,
      status,
      reason,
      expires_at,
      created_by
    )
    values (target_profile_id, target_status, reason, expires_at, caller_id)
    on conflict (profile_id) do update
    set status = excluded.status,
        reason = excluded.reason,
        expires_at = excluded.expires_at,
        created_by = caller_id,
        updated_at = now();
  end if;

  insert into public.moderation_actions (
    moderator_id,
    target_profile_id,
    target_type,
    target_id,
    action_type,
    reason
  )
  values (
    caller_id,
    target_profile_id,
    'profile',
    target_profile_id::text,
    case when target_status = 'active' then 'restore_user' else 'restrict_user' end,
    reason
  );

  perform public.create_notification(target_profile_id, caller_id, 'system', null);
end;
$$;

drop policy if exists "Unrestricted users create their posts" on public.posts;
create policy "Rate limited unrestricted users create their posts" on public.posts
for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and not public.current_user_is_restricted()
  and public.check_rate_limit('post:create', 30, interval '1 hour')
  and moderation_status = 'visible'
);

drop policy if exists "Unrestricted users create their replies" on public.replies;
create policy "Rate limited unrestricted users create their replies" on public.replies
for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and not public.current_user_is_restricted()
  and public.check_rate_limit('reply:create', 60, interval '1 hour')
  and moderation_status = 'visible'
);

drop policy if exists "Unrestricted participants send messages" on public.messages;
create policy "Rate limited unrestricted participants send messages" on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and not public.current_user_is_restricted()
  and public.check_rate_limit('message:send', 120, interval '1 hour')
  and deleted_for_everyone_at is null
  and deleted_for = '{}'::uuid[]
  and exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = messages.conversation_id
      and conversation_participants.user_id = (select auth.uid())
  )
);

drop policy if exists "Users upload their pulse media" on storage.objects;
create policy "Rate limited users upload their pulse media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pulse-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not public.current_user_is_restricted()
  and public.check_rate_limit('media:upload', 80, interval '1 hour')
);

revoke all on function public.check_rate_limit(text, int, interval) from public, anon;
revoke all on function public.submit_moderation_report(text, text, text) from public, anon;
grant execute on function public.check_rate_limit(text, int, interval) to authenticated;
grant execute on function public.submit_moderation_report(text, text, text) to authenticated;
