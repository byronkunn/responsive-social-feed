alter table public.posts
add column if not exists moderation_status text not null default 'visible'
  check (moderation_status in ('visible', 'hidden', 'removed')),
add column if not exists moderated_by uuid references public.profiles(id) on delete set null,
add column if not exists moderated_at timestamptz,
add column if not exists moderation_reason text;

alter table public.replies
add column if not exists moderation_status text not null default 'visible'
  check (moderation_status in ('visible', 'hidden', 'removed')),
add column if not exists moderated_by uuid references public.profiles(id) on delete set null,
add column if not exists moderated_at timestamptz,
add column if not exists moderation_reason text;

create table public.moderation_role_members (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  permissions text[] not null default '{}'::text[],
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('post', 'reply', 'profile', 'message')),
  target_id text not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'pending' check (status in ('pending', 'actioned', 'dismissed')),
  moderator_id uuid references public.profiles(id) on delete set null,
  moderator_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.moderation_user_restrictions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null check (status in ('active', 'suspended', 'banned')),
  reason text not null default '',
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  target_profile_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('post', 'reply', 'profile', 'message', 'role', 'report')),
  target_id text not null,
  action_type text not null check (
    action_type in (
      'hide_post',
      'remove_post',
      'restore_post',
      'hide_reply',
      'remove_reply',
      'restore_reply',
      'restrict_user',
      'restore_user',
      'role_change',
      'resolve_report'
    )
  ),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index moderation_role_members_role_idx on public.moderation_role_members (role);
create index moderation_reports_status_created_idx on public.moderation_reports (status, created_at desc);
create index moderation_reports_target_idx on public.moderation_reports (target_type, target_id);
create index moderation_actions_created_idx on public.moderation_actions (created_at desc);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id);
create index moderation_user_restrictions_status_idx on public.moderation_user_restrictions (status);
create index posts_moderation_status_idx on public.posts (moderation_status, created_at desc);
create index replies_moderation_status_idx on public.replies (moderation_status, created_at desc);

create trigger moderation_role_members_set_updated_at before update on public.moderation_role_members
for each row execute function public.set_updated_at();
create trigger moderation_user_restrictions_set_updated_at before update on public.moderation_user_restrictions
for each row execute function public.set_updated_at();

alter table public.moderation_role_members enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.moderation_user_restrictions enable row level security;
alter table public.moderation_actions enable row level security;

create or replace function public.current_user_has_moderation_permission(required_permission text default 'view_admin')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with token as (
    select
      coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') as jwt_role,
      coalesce(
        array(
          select jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'permissions')
        ),
        '{}'::text[]
      ) as jwt_permissions
  ),
  member as (
    select role, permissions
    from public.moderation_role_members
    where profile_id = (select auth.uid())
  )
  select exists (
    select 1
    from token
    left join member on true
    where token.jwt_role = 'admin'
      or member.role = 'admin'
      or required_permission = any(token.jwt_permissions)
      or required_permission = any(coalesce(member.permissions, '{}'::text[]))
  );
$$;

create or replace function public.current_user_is_restricted()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.moderation_user_restrictions
    where profile_id = (select auth.uid())
      and status in ('suspended', 'banned')
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.current_moderation_role()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with token as (
    select
      coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') as jwt_role,
      coalesce(
        array(
          select jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'permissions')
        ),
        '{}'::text[]
      ) as jwt_permissions
  ),
  member as (
    select role, permissions
    from public.moderation_role_members
    where profile_id = (select auth.uid())
  )
  select jsonb_build_object(
    'role',
    case
      when token.jwt_role = 'admin' or member.role = 'admin' then 'admin'
      when member.role = 'moderator' then 'moderator'
      when token.jwt_role = 'moderator' then 'moderator'
      else 'member'
    end,
    'permissions',
    case
      when token.jwt_role = 'admin' or member.role = 'admin' then
        to_jsonb(array[
          'view_admin',
          'moderate_content',
          'manage_reports',
          'manage_users',
          'manage_roles',
          'view_analytics'
        ]::text[])
      else to_jsonb(
        (
          select array_agg(distinct permission)
          from unnest(token.jwt_permissions || coalesce(member.permissions, '{}'::text[])) as permissions(permission)
        )
      )
    end
  )
  from token
  left join member on true;
$$;

create or replace function public.submit_moderation_report(
  target_type text,
  target_id text,
  reason text
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

  insert into public.moderation_reports (reporter_id, target_type, target_id, reason)
  values (caller_id, target_type, target_id, btrim(reason))
  returning id into report_id;

  return report_id;
end;
$$;

create or replace function public.set_moderation_role(
  target_profile_id uuid,
  target_role text,
  target_permissions text[] default '{}'::text[],
  reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  cleaned_permissions text[];
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_has_moderation_permission('manage_roles') then
    raise exception 'Admin role management permission required' using errcode = '42501';
  end if;
  if target_profile_id = caller_id and target_role <> 'admin' then
    raise exception 'Admins cannot remove their own admin access' using errcode = '42501';
  end if;

  cleaned_permissions := (
    select coalesce(array_agg(distinct permission), '{}'::text[])
    from unnest(target_permissions) as permissions(permission)
    where permission in (
      'view_admin',
      'moderate_content',
      'manage_reports',
      'manage_users',
      'manage_roles',
      'view_analytics'
    )
  );

  if target_role = 'none' then
    delete from public.moderation_role_members where profile_id = target_profile_id;
  else
    insert into public.moderation_role_members (profile_id, role, permissions, granted_by)
    values (target_profile_id, target_role, cleaned_permissions, caller_id)
    on conflict (profile_id) do update
    set role = excluded.role,
        permissions = excluded.permissions,
        granted_by = caller_id,
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
  values (caller_id, target_profile_id, 'role', target_profile_id::text, 'role_change', reason);
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
end;
$$;

create or replace function public.moderate_reply(
  target_reply_id uuid,
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

  update public.replies
  set moderation_status = case
      when action = 'hide' then 'hidden'
      when action = 'remove' then 'removed'
      when action = 'restore' then 'visible'
      else moderation_status
    end,
    moderated_by = caller_id,
    moderated_at = now(),
    moderation_reason = nullif(btrim(reason), '')
  where id = target_reply_id
  returning author_id into target_author_id;

  if not found then
    raise exception 'Reply not found';
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
    'reply',
    target_reply_id::text,
    case
      when action = 'hide' then 'hide_reply'
      when action = 'remove' then 'remove_reply'
      else 'restore_reply'
    end,
    reason
  );
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
end;
$$;

create or replace function public.resolve_moderation_report(
  target_report_id uuid,
  target_status text,
  moderator_note text default ''
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
  if not public.current_user_has_moderation_permission('manage_reports') then
    raise exception 'Report management permission required' using errcode = '42501';
  end if;

  update public.moderation_reports
  set status = target_status,
      moderator_id = caller_id,
      moderator_note = moderator_note,
      resolved_at = now()
  where id = target_report_id;

  if not found then
    raise exception 'Report not found';
  end if;

  insert into public.moderation_actions (
    moderator_id,
    target_type,
    target_id,
    action_type,
    reason
  )
  values (caller_id, 'report', target_report_id::text, 'resolve_report', moderator_note);
end;
$$;

create or replace function public.admin_analytics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.current_user_has_moderation_permission('view_analytics') then
      jsonb_build_object('error', 'Analytics permission required')
    else jsonb_build_object(
      'totals', jsonb_build_object(
        'users', (select count(*) from public.profiles),
        'posts', (select count(*) from public.posts),
        'visiblePosts', (select count(*) from public.posts where moderation_status = 'visible'),
        'hiddenPosts', (select count(*) from public.posts where moderation_status <> 'visible'),
        'replies', (select count(*) from public.replies),
        'messages', (select count(*) from public.messages),
        'reportsOpen', (select count(*) from public.moderation_reports where status = 'pending'),
        'reportsResolved', (select count(*) from public.moderation_reports where status <> 'pending'),
        'restrictedUsers', (select count(*) from public.moderation_user_restrictions where status <> 'active')
      ),
      'last24h', jsonb_build_object(
        'posts', (select count(*) from public.posts where created_at >= now() - interval '24 hours'),
        'replies', (select count(*) from public.replies where created_at >= now() - interval '24 hours'),
        'messages', (select count(*) from public.messages where created_at >= now() - interval '24 hours'),
        'reports', (select count(*) from public.moderation_reports where created_at >= now() - interval '24 hours'),
        'newUsers', (select count(*) from public.profiles where created_at >= now() - interval '24 hours')
      ),
      'topPosts', coalesce((
        select jsonb_agg(row_to_json(ranked))
        from (
          select
            posts.id,
            posts.body,
            posts.moderation_status as status,
            profiles.display_name as author_name,
            profiles.handle as author_handle,
            count(post_reactions.post_id) filter (where post_reactions.kind = 'spark') as sparks,
            count(post_reactions.post_id) filter (where post_reactions.kind = 'echo') as echoes,
            count(replies.id) as replies
          from public.posts
          left join public.profiles on profiles.id = posts.author_id
          left join public.post_reactions on post_reactions.post_id = posts.id
          left join public.replies on replies.post_id = posts.id
          group by posts.id, profiles.display_name, profiles.handle
          order by (
            count(post_reactions.post_id) filter (where post_reactions.kind = 'spark') * 3
            + count(post_reactions.post_id) filter (where post_reactions.kind = 'echo') * 4
            + count(replies.id) * 2
          ) desc, posts.created_at desc
          limit 8
        ) ranked
      ), '[]'::jsonb),
      'dailyActivity', coalesce((
        select jsonb_agg(row_to_json(day_row) order by day_row.day)
        from (
          select
            to_char(day, 'Mon DD') as day,
            (select count(*) from public.posts where created_at >= day and created_at < day + interval '1 day') as posts,
            (select count(*) from public.replies where created_at >= day and created_at < day + interval '1 day') as replies,
            (select count(*) from public.messages where created_at >= day and created_at < day + interval '1 day') as messages,
            (select count(*) from public.moderation_reports where created_at >= day and created_at < day + interval '1 day') as reports
          from generate_series(
            date_trunc('day', now()) - interval '13 days',
            date_trunc('day', now()),
            interval '1 day'
          ) as day
        ) day_row
      ), '[]'::jsonb)
    )
  end;
$$;

drop policy if exists "Posts are publicly readable" on public.posts;
drop policy if exists "Users create their posts" on public.posts;
drop policy if exists "Users update their posts" on public.posts;
drop policy if exists "Users delete their posts" on public.posts;
create policy "Visible posts are publicly readable" on public.posts
for select
to anon, authenticated
using (
  moderation_status = 'visible'
  or public.current_user_has_moderation_permission('moderate_content')
);
create policy "Unrestricted users create their posts" on public.posts
for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and not public.current_user_is_restricted()
  and moderation_status = 'visible'
);
create policy "Users update unmoderated posts" on public.posts
for update
to authenticated
using (
  (select auth.uid()) = author_id
  and moderation_status = 'visible'
)
with check (
  (select auth.uid()) = author_id
  and moderation_status = 'visible'
  and moderated_by is null
  and moderated_at is null
);
create policy "Users delete unmoderated posts" on public.posts
for delete
to authenticated
using (
  (select auth.uid()) = author_id
  and moderation_status = 'visible'
);

drop policy if exists "Replies are publicly readable" on public.replies;
drop policy if exists "Users create their replies" on public.replies;
drop policy if exists "Users update their replies" on public.replies;
drop policy if exists "Users delete their replies" on public.replies;
create policy "Visible replies are publicly readable" on public.replies
for select
to anon, authenticated
using (
  moderation_status = 'visible'
  or public.current_user_has_moderation_permission('moderate_content')
);
create policy "Unrestricted users create their replies" on public.replies
for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and not public.current_user_is_restricted()
  and moderation_status = 'visible'
);
create policy "Users update unmoderated replies" on public.replies
for update
to authenticated
using (
  (select auth.uid()) = author_id
  and moderation_status = 'visible'
)
with check (
  (select auth.uid()) = author_id
  and moderation_status = 'visible'
  and moderated_by is null
  and moderated_at is null
);
create policy "Users delete unmoderated replies" on public.replies
for delete
to authenticated
using (
  (select auth.uid()) = author_id
  and moderation_status = 'visible'
);

drop policy if exists "Participants send messages" on public.messages;
create policy "Unrestricted participants send messages" on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and not public.current_user_is_restricted()
  and deleted_for_everyone_at is null
  and deleted_for = '{}'::uuid[]
  and exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = messages.conversation_id
      and conversation_participants.user_id = (select auth.uid())
  )
);

create policy "Moderators read role assignments" on public.moderation_role_members
for select
to authenticated
using (public.current_user_has_moderation_permission('view_admin'));

create policy "Users create reports" on public.moderation_reports
for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

create policy "Users read their own reports" on public.moderation_reports
for select
to authenticated
using (
  reporter_id = (select auth.uid())
  or public.current_user_has_moderation_permission('manage_reports')
);

create policy "Moderators read restrictions" on public.moderation_user_restrictions
for select
to authenticated
using (public.current_user_has_moderation_permission('view_admin'));

create policy "Moderators read audit actions" on public.moderation_actions
for select
to authenticated
using (public.current_user_has_moderation_permission('view_admin'));

grant select on public.moderation_role_members, public.moderation_reports, public.moderation_user_restrictions, public.moderation_actions to authenticated;
grant insert on public.moderation_reports to authenticated;
grant all on public.moderation_role_members, public.moderation_reports, public.moderation_user_restrictions, public.moderation_actions to service_role;

revoke all on function public.current_user_has_moderation_permission(text) from public, anon;
revoke all on function public.current_user_is_restricted() from public, anon;
revoke all on function public.current_moderation_role() from public, anon;
revoke all on function public.submit_moderation_report(text, text, text) from public, anon;
revoke all on function public.set_moderation_role(uuid, text, text[], text) from public, anon;
revoke all on function public.moderate_post(uuid, text, text) from public, anon;
revoke all on function public.moderate_reply(uuid, text, text) from public, anon;
revoke all on function public.set_user_restriction(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.resolve_moderation_report(uuid, text, text) from public, anon;
revoke all on function public.admin_analytics() from public, anon;

grant execute on function public.current_user_has_moderation_permission(text) to authenticated;
grant execute on function public.current_user_is_restricted() to authenticated;
grant execute on function public.current_moderation_role() to authenticated;
grant execute on function public.submit_moderation_report(text, text, text) to authenticated;
grant execute on function public.set_moderation_role(uuid, text, text[], text) to authenticated;
grant execute on function public.moderate_post(uuid, text, text) to authenticated;
grant execute on function public.moderate_reply(uuid, text, text) to authenticated;
grant execute on function public.set_user_restriction(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.resolve_moderation_report(uuid, text, text) to authenticated;
grant execute on function public.admin_analytics() to authenticated;
