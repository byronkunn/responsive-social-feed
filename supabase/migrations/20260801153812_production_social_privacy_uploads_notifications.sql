alter table public.messages
add column if not exists attachments jsonb not null default '[]'::jsonb,
add column if not exists deleted_for uuid[] not null default '{}'::uuid[],
add column if not exists deleted_for_everyone_at timestamptz;

alter table public.messages
drop constraint if exists messages_body_check;

alter table public.messages
add constraint messages_body_check check (
  char_length(body) <= 4000
  and (
    char_length(body) >= 1
    or jsonb_array_length(attachments) > 0
    or deleted_for_everyone_at is not null
  )
);

drop policy if exists "Participants read memberships" on public.conversation_participants;
create policy "Participants read conversation memberships"
on public.conversation_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants viewer
    where viewer.conversation_id = conversation_participants.conversation_id
      and viewer.user_id = (select auth.uid())
  )
);

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read visible messages"
on public.messages
for select
to authenticated
using (
  deleted_for_everyone_at is null
  and not ((select auth.uid()) = any(deleted_for))
  and exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = messages.conversation_id
      and conversation_participants.user_id = (select auth.uid())
  )
);

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and deleted_for_everyone_at is null
  and deleted_for = '{}'::uuid[]
  and exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = messages.conversation_id
      and conversation_participants.user_id = (select auth.uid())
  )
);

grant select, insert, delete on public.messages to authenticated;
revoke update on public.messages from authenticated;
grant select, insert, update, delete on public.conversation_participants to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pulse-media',
  'pulse-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Pulse media public read" on storage.objects;
create policy "Pulse media public read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'pulse-media');

drop policy if exists "Users upload their pulse media" on storage.objects;
create policy "Users upload their pulse media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pulse-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users update their pulse media" on storage.objects;
create policy "Users update their pulse media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pulse-media'
  and owner = (select auth.uid())
)
with check (
  bucket_id = 'pulse-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete their pulse media" on storage.objects;
create policy "Users delete their pulse media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pulse-media'
  and owner = (select auth.uid())
);

create or replace function public.create_notification(
  target_user_id uuid,
  actor_user_id uuid,
  notification_kind text,
  target_post_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null or actor_user_id is null or target_user_id = actor_user_id then
    return;
  end if;

  insert into public.notifications (recipient_id, actor_id, kind, post_id)
  values (target_user_id, actor_user_id, notification_kind, target_post_id);
end;
$$;

create or replace function public.delete_message_for_me(target_message_id uuid)
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

  update public.messages
  set deleted_for = (
    select array_agg(distinct user_id)
    from unnest(array_append(messages.deleted_for, caller_id)) as user_id
  )
  where id = target_message_id
    and exists (
      select 1
      from public.conversation_participants
      where conversation_participants.conversation_id = messages.conversation_id
        and conversation_participants.user_id = caller_id
    );

  if not found then
    raise exception 'Message not found' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.delete_message_for_everyone(target_message_id uuid)
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

  update public.messages
  set body = '',
      attachments = '[]'::jsonb,
      deleted_for_everyone_at = now()
  where id = target_message_id
    and sender_id = caller_id;

  if not found then
    raise exception 'Only the sender can delete this message for everyone' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.delete_message_attachment_for_everyone(
  target_message_id uuid,
  target_attachment_id text
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

  update public.messages
  set attachments = coalesce(
    (
      select jsonb_agg(attachment)
      from jsonb_array_elements(messages.attachments) as attachment
      where attachment->>'id' <> target_attachment_id
    ),
    '[]'::jsonb
  )
  where id = target_message_id
    and sender_id = caller_id;

  if not found then
    raise exception 'Only the sender can delete this attachment for everyone' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.notify_on_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  select author_id into target_user_id from public.posts where id = new.post_id;
  perform public.create_notification(target_user_id, new.author_id, 'reply', new.post_id);
  return new;
end;
$$;

create or replace function public.notify_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if new.kind not in ('spark', 'echo') then
    return new;
  end if;

  select author_id into target_user_id from public.posts where id = new.post_id;
  perform public.create_notification(target_user_id, new.user_id, new.kind, new.post_id);
  return new;
end;
$$;

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_notification(new.followee_id, new.follower_id, 'follow', null);
  return new;
end;
$$;

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, kind)
  select participant.user_id, new.sender_id, 'message'
  from public.conversation_participants participant
  where participant.conversation_id = new.conversation_id
    and participant.user_id <> new.sender_id;

  return new;
end;
$$;

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists replies_notify on public.replies;
create trigger replies_notify
after insert on public.replies
for each row execute function public.notify_on_reply();

drop trigger if exists post_reactions_notify on public.post_reactions;
create trigger post_reactions_notify
after insert on public.post_reactions
for each row execute function public.notify_on_reaction();

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
after insert on public.follows
for each row execute function public.notify_on_follow();

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
after insert on public.messages
for each row execute function public.notify_on_message();

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_on_message();

revoke all on function public.create_notification(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.notify_on_reply() from public, anon, authenticated;
revoke all on function public.notify_on_reaction() from public, anon, authenticated;
revoke all on function public.notify_on_follow() from public, anon, authenticated;
revoke all on function public.notify_on_message() from public, anon, authenticated;
revoke all on function public.touch_conversation_on_message() from public, anon, authenticated;
revoke all on function public.delete_message_for_me(uuid) from public, anon;
revoke all on function public.delete_message_for_everyone(uuid) from public, anon;
revoke all on function public.delete_message_attachment_for_everyone(uuid, text) from public, anon;
grant execute on function public.delete_message_for_me(uuid) to authenticated;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;
grant execute on function public.delete_message_attachment_for_everyone(uuid, text) to authenticated;
