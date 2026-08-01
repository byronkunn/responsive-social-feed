create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  audience text not null default 'everyone' check (audience in ('everyone', 'followers')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('spark', 'echo', 'bookmark')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 280),
  audience text not null default 'everyone' check (audience in ('everyone', 'followers')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table public.list_members (
  list_id uuid not null references public.lists(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, profile_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('follow', 'reply', 'spark', 'echo', 'message', 'system')),
  post_id uuid references public.posts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);
create index replies_post_created_idx on public.replies (post_id, created_at);
create index replies_author_idx on public.replies (author_id);
create index post_reactions_user_kind_idx on public.post_reactions (user_id, kind);
create index follows_followee_idx on public.follows (followee_id);
create index drafts_author_updated_idx on public.drafts (author_id, updated_at desc);
create index communities_owner_idx on public.communities (owner_id);
create index community_members_user_idx on public.community_members (user_id);
create index lists_owner_idx on public.lists (owner_id);
create index list_members_profile_idx on public.list_members (profile_id);
create index conversations_creator_idx on public.conversations (creator_id);
create index conversation_participants_user_idx on public.conversation_participants (user_id);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx on public.messages (sender_id);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id);

create trigger posts_set_updated_at before update on public.posts
for each row execute function public.set_updated_at();
create trigger replies_set_updated_at before update on public.replies
for each row execute function public.set_updated_at();
create trigger drafts_set_updated_at before update on public.drafts
for each row execute function public.set_updated_at();
create trigger lists_set_updated_at before update on public.lists
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

alter table public.posts enable row level security;
alter table public.replies enable row level security;
alter table public.post_reactions enable row level security;
alter table public.follows enable row level security;
alter table public.drafts enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "Posts are publicly readable" on public.posts for select to anon, authenticated using (true);
create policy "Users create their posts" on public.posts for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Users update their posts" on public.posts for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "Users delete their posts" on public.posts for delete to authenticated using ((select auth.uid()) = author_id);

create policy "Replies are publicly readable" on public.replies for select to anon, authenticated using (true);
create policy "Users create their replies" on public.replies for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Users update their replies" on public.replies for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "Users delete their replies" on public.replies for delete to authenticated using ((select auth.uid()) = author_id);

create policy "Public reactions are readable" on public.post_reactions for select to anon using (kind <> 'bookmark');
create policy "Users read public and own reactions" on public.post_reactions for select to authenticated using (kind <> 'bookmark' or (select auth.uid()) = user_id);
create policy "Users create their reactions" on public.post_reactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete their reactions" on public.post_reactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Follows are publicly readable" on public.follows for select to anon, authenticated using (true);
create policy "Users create their follows" on public.follows for insert to authenticated with check ((select auth.uid()) = follower_id);
create policy "Users delete their follows" on public.follows for delete to authenticated using ((select auth.uid()) = follower_id);

create policy "Users manage their drafts" on public.drafts for all to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

create policy "Communities are publicly readable" on public.communities for select to anon, authenticated using (true);
create policy "Users create communities" on public.communities for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners update communities" on public.communities for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete communities" on public.communities for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "Community memberships are public" on public.community_members for select to anon, authenticated using (true);
create policy "Users join communities" on public.community_members for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users leave communities" on public.community_members for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Public lists and owned lists are readable" on public.lists for select to anon, authenticated using (not is_private or (select auth.uid()) = owner_id);
create policy "Users create their lists" on public.lists for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners update lists" on public.lists for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete lists" on public.lists for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "Visible list members are readable" on public.list_members for select to anon, authenticated using (
  exists (select 1 from public.lists where lists.id = list_members.list_id and (not lists.is_private or lists.owner_id = (select auth.uid())))
);
create policy "Owners manage list members" on public.list_members for all to authenticated using (
  exists (select 1 from public.lists where lists.id = list_members.list_id and lists.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.lists where lists.id = list_members.list_id and lists.owner_id = (select auth.uid()))
);

create policy "Participants read conversations" on public.conversations for select to authenticated using (
  creator_id = (select auth.uid()) or exists (
    select 1 from public.conversation_participants
    where conversation_participants.conversation_id = conversations.id
      and conversation_participants.user_id = (select auth.uid())
  )
);
create policy "Users create conversations" on public.conversations for insert to authenticated with check ((select auth.uid()) = creator_id);
create policy "Participants read memberships" on public.conversation_participants for select to authenticated using (user_id = (select auth.uid()));
create policy "Creators add participants" on public.conversation_participants for insert to authenticated with check (
  exists (select 1 from public.conversations where conversations.id = conversation_participants.conversation_id and conversations.creator_id = (select auth.uid()))
);
create policy "Users leave conversations" on public.conversation_participants for delete to authenticated using (user_id = (select auth.uid()));
create policy "Participants read messages" on public.messages for select to authenticated using (
  exists (select 1 from public.conversation_participants where conversation_participants.conversation_id = messages.conversation_id and conversation_participants.user_id = (select auth.uid()))
);
create policy "Participants send messages" on public.messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and exists (
    select 1 from public.conversation_participants where conversation_participants.conversation_id = messages.conversation_id and conversation_participants.user_id = (select auth.uid())
  )
);
create policy "Senders delete messages" on public.messages for delete to authenticated using (sender_id = (select auth.uid()));

create policy "Users read their notifications" on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
create policy "Users update their notifications" on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy "Users delete their notifications" on public.notifications for delete to authenticated using (recipient_id = (select auth.uid()));

grant select on public.posts, public.replies, public.post_reactions, public.follows, public.communities, public.community_members, public.lists, public.list_members to anon;
grant select, insert, update, delete on public.posts, public.replies, public.post_reactions, public.follows, public.drafts, public.communities, public.community_members, public.lists, public.list_members, public.conversations, public.conversation_participants, public.messages, public.notifications to authenticated;
grant usage, select on sequence public.notifications_id_seq to authenticated;
grant all on public.posts, public.replies, public.post_reactions, public.follows, public.drafts, public.communities, public.community_members, public.lists, public.list_members, public.conversations, public.conversation_participants, public.messages, public.notifications to service_role;
grant usage, select on sequence public.notifications_id_seq to service_role;

create or replace function public.delete_current_user()
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
  delete from auth.users where id = caller_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;
