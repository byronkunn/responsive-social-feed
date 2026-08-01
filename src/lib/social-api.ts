import { supabase } from "@/integrations/supabase/client";
import {
  type Author,
  type ChatAttachment,
  type ChatMessage,
  type Community,
  type Connection,
  type Conversation,
  type Draft,
  type Post,
  type PulseList,
  type Reply,
} from "@/lib/pulse-data";

type PersistedPost = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  media_urls: string[];
  profiles: {
    display_name: string;
    handle: string;
    initials: string;
  } | null;
};

type PersistedProfile = {
  id: string;
  display_name: string;
  handle: string;
  initials: string;
  bio: string | null;
};

type PersistedFollow = {
  follower_id: string;
  followee_id: string;
};

type PersistedCommunity = {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
};

type PersistedList = {
  id: string;
  slug: string;
  name: string;
  description: string;
  owner_id: string;
  is_private: boolean;
  created_at: string;
  profiles: PersistedProfile | null;
};

type PersistedConversation = {
  id: string;
  creator_id: string;
  created_at: string;
  updated_at: string;
  conversation_participants?: {
    user_id: string;
    profiles: PersistedProfile | null;
  }[];
  messages?: {
    id: string;
    body: string;
    sender_id: string;
    attachments: ChatAttachment[] | null;
    deleted_for_everyone_at: string | null;
    created_at: string;
  }[];
};

type PersistedMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachments: ChatAttachment[] | null;
  deleted_for_everyone_at: string | null;
  created_at: string;
};

export type PulseNotification = {
  id: string;
  kind: "spark" | "echo" | "follow" | "mention" | "reply" | "message" | "system";
  text: string;
  time: string;
  href?: string;
  read: boolean;
};

export type ExploreTrend = {
  tag: string;
  topic: string;
  title: string;
  count: string;
  posts: number;
};

export type ExploreData = {
  posts: Post[];
  trends: ExploreTrend[];
  suggestedTags: string[];
};

const POST_BODY_LIMIT = 280;
const REPLY_BODY_LIMIT = 280;
const MAX_MEDIA_ATTACHMENTS = 20;

function age(iso: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function toAuthor(profile: PersistedPost["profiles"]): Author {
  return {
    name: profile?.display_name || "Pulse user",
    handle: profile?.handle || "member",
    initials: profile?.initials || "PU",
  };
}

function toConnection(profile: PersistedProfile, follows: boolean = false): Connection {
  return {
    ...toAuthor(profile),
    bio: profile.bio || "No bio yet.",
    follows,
  };
}

function formatCount(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to continue");
  return data.user.id;
}

async function maybeCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function isLocalProfileId(id?: string | null) {
  return !!id && id.startsWith("local-");
}

function normalizeTextBody(body: string, limit: number) {
  const trimmed = body.trim();
  if (trimmed.length > limit) {
    throw new Error(`Use ${limit} characters or fewer`);
  }
  return trimmed;
}

function normalizeMediaUrls(imageUrls?: string[]) {
  const cleaned = (imageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  if (cleaned.length > MAX_MEDIA_ATTACHMENTS) {
    throw new Error(`Attach up to ${MAX_MEDIA_ATTACHMENTS} images per post`);
  }
  return cleaned;
}

function normalizeAttachmentUrls(attachments?: ChatAttachment[]) {
  return (attachments ?? []).map((attachment) => ({
    id: attachment.id,
    type: attachment.type,
    url: attachment.url,
    ...(attachment.label ? { label: attachment.label } : {}),
  }));
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
}

function extractHashtags(body: string) {
  return Array.from(body.matchAll(/(^|\s)#([a-z0-9][a-z0-9_-]{1,48})/gi))
    .map((match) => match[2]?.toLowerCase())
    .filter((tag): tag is string => !!tag);
}

function postTags(post: Post) {
  return [
    ...new Set([...(post.tag ? [post.tag.toLowerCase()] : []), ...extractHashtags(post.body)]),
  ];
}

function toPost(
  post: PersistedPost,
  counts: { spark: number; echo: number; bookmark: number } = { spark: 0, echo: 0, bookmark: 0 },
): Post {
  const mediaUrls = post.media_urls;
  const imageUrls = mediaUrls.filter((url) => !isVideoUrl(url));
  const videoUrls = mediaUrls.filter(isVideoUrl);
  const hashtags = extractHashtags(post.body);

  return {
    id: post.id,
    author: toAuthor(post.profiles),
    time: age(post.created_at),
    body: post.body,
    replies: 0,
    echoes: counts.echo,
    sparks: counts.spark,
    views: "—",
    ...(hashtags[0] ? { tag: hashtags[0] } : {}),
    ...(imageUrls.length > 0 ? { imageUrls, imageUrl: imageUrls[0] } : {}),
    ...(videoUrls.length > 0 ? { videoUrls, videoUrl: videoUrls[0] } : {}),
  };
}

export async function fetchPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, body, created_at, author_id, media_urls, profiles!posts_author_id_fkey(display_name, handle, initials)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const rows = (data ?? []) as unknown as PersistedPost[];
  const ids = rows.map((post) => post.id);
  const counts = new Map<string, { spark: number; echo: number; bookmark: number }>();

  if (ids.length > 0) {
    const { data: reactions, error: reactionError } = await supabase
      .from("post_reactions")
      .select("post_id, kind")
      .in("post_id", ids);
    if (reactionError) throw reactionError;
    for (const reaction of reactions ?? []) {
      const entry = counts.get(reaction.post_id) ?? { spark: 0, echo: 0, bookmark: 0 };
      if (reaction.kind === "spark" || reaction.kind === "echo" || reaction.kind === "bookmark") {
        entry[reaction.kind] += 1;
      }
      counts.set(reaction.post_id, entry);
    }
  }

  return rows.map((post) => toPost(post, counts.get(post.id)));
}

export async function fetchExploreData(): Promise<ExploreData> {
  const posts = await fetchPosts();
  const tagCounts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of postTags(post)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const trends = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({
      tag,
      topic: "Trending tag",
      title: `#${tag}`,
      count: `${count} pulse${count === 1 ? "" : "s"}`,
      posts: count,
    }));

  const popularPosts = [...posts].sort((a, b) => {
    const bScore = b.sparks * 3 + b.echoes * 4 + b.replies * 2;
    const aScore = a.sparks * 3 + a.echoes * 4 + a.replies * 2;
    return bScore - aScore;
  });

  return {
    posts: popularPosts,
    trends,
    suggestedTags: trends.map((trend) => trend.tag),
  };
}

export async function uploadMedia(file: File): Promise<string> {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/ogg",
  ];
  const maxBytes = 50 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Upload an image or browser-playable video file");
  }
  if (file.size > maxBytes) {
    throw new Error("Media uploads must be 50 MB or smaller");
  }

  try {
    const userId = await currentUserId();
    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { data, error } = await supabase.storage.from("pulse-media").upload(filePath, file);
    if (!error && data) {
      const { data: publicUrlData } = supabase.storage.from("pulse-media").getPublicUrl(data.path);
      if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
    }
    if (error) throw error;
  } catch (error) {
    if (!import.meta.env.DEV) {
      throw error instanceof Error ? error : new Error("Upload failed");
    }
    // Local prototype fallback when Supabase Storage is not configured.
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadMultipleMedia(files: File[]): Promise<string[]> {
  const limited = files.slice(0, 20);
  return Promise.all(limited.map((file) => uploadMedia(file)));
}

export async function createPost(
  body: string,
  audience: "Everyone" | "Followers" = "Everyone",
  imageUrls?: string[],
) {
  const authorId = await currentUserId();
  const trimmedBody = normalizeTextBody(body, POST_BODY_LIMIT);
  const mediaUrls = normalizeMediaUrls(imageUrls);

  if (!trimmedBody && mediaUrls.length === 0) {
    throw new Error("Write something or attach at least one image");
  }

  const { error } = await supabase.from("posts").insert({
    author_id: authorId,
    body: trimmedBody,
    audience: audience.toLowerCase(),
    media_urls: mediaUrls,
  });
  if (error) throw error;
}

export async function toggleReaction(
  postId: string,
  kind: "spark" | "echo" | "bookmark",
  active: boolean,
) {
  const userId = await currentUserId();
  if (active) {
    const { error } = await supabase.from("post_reactions").delete().match({
      post_id: postId,
      user_id: userId,
      kind,
    });
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from("post_reactions").insert({
    post_id: postId,
    user_id: userId,
    kind,
  });
  if (error) throw error;
  return true;
}

export async function saveDraft(body: string, audience: "Everyone" | "Followers" = "Everyone") {
  const authorId = await currentUserId();
  const trimmedBody = normalizeTextBody(body, POST_BODY_LIMIT);
  const { error } = await supabase.from("drafts").insert({
    author_id: authorId,
    body: trimmedBody,
    audience: audience.toLowerCase(),
  });
  if (error) throw error;
}

export async function updateDraft(id: string, body: string, audience: "Everyone" | "Followers") {
  const trimmedBody = normalizeTextBody(body, POST_BODY_LIMIT);
  const { error } = await supabase
    .from("drafts")
    .update({ body: trimmedBody, audience: audience.toLowerCase() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchDrafts(): Promise<Draft[]> {
  const authorId = await currentUserId();
  const { data, error } = await supabase
    .from("drafts")
    .select("id, body, updated_at")
    .eq("author_id", authorId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((draft) => ({
    id: draft.id,
    body: draft.body,
    savedAt: age(draft.updated_at),
  }));
}

export async function deleteDraft(id: string) {
  const { error } = await supabase.from("drafts").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPostById(id: string): Promise<Post | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(id);
  if (!isUuid) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("posts")
    .select(
      "id, body, created_at, author_id, media_urls, profiles!posts_author_id_fkey(display_name, handle, initials)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const post = data as unknown as PersistedPost;
  const { data: reactions } = await supabase
    .from("post_reactions")
    .select("kind")
    .eq("post_id", id);

  const counts = { spark: 0, echo: 0, bookmark: 0 };
  for (const r of reactions ?? []) {
    if (r.kind === "spark" || r.kind === "echo" || r.kind === "bookmark") {
      counts[r.kind] += 1;
    }
  }

  return toPost(post, counts);
}

export async function deletePost(id: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from("posts").delete().eq("id", id).eq("author_id", userId);
  if (error) throw error;
}

export async function fetchBookmarkedPosts(): Promise<Post[]> {
  const userId = await currentUserId();
  const { data: reactions, error: rErr } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("user_id", userId)
    .eq("kind", "bookmark");
  if (rErr) throw rErr;
  if (!reactions || reactions.length === 0) return [];

  const postIds = reactions.map((r) => r.post_id);
  const { data: postsData, error: pErr } = await supabase
    .from("posts")
    .select(
      "id, body, created_at, author_id, media_urls, profiles!posts_author_id_fkey(display_name, handle, initials)",
    )
    .in("id", postIds)
    .order("created_at", { ascending: false });
  if (pErr) throw pErr;

  const rows = (postsData ?? []) as unknown as PersistedPost[];
  return rows.map((post) => toPost(post));
}

export async function fetchReactedPosts(kind: "spark" | "echo" | "bookmark"): Promise<Post[]> {
  const userId = await currentUserId();
  const { data: reactions, error: rErr } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("user_id", userId)
    .eq("kind", kind);
  if (rErr) throw rErr;
  if (!reactions || reactions.length === 0) return [];

  const postIds = reactions.map((r) => r.post_id);
  const { data: postsData, error: pErr } = await supabase
    .from("posts")
    .select(
      "id, body, created_at, author_id, media_urls, profiles!posts_author_id_fkey(display_name, handle, initials)",
    )
    .in("id", postIds)
    .order("created_at", { ascending: false });
  if (pErr) throw pErr;

  const rows = (postsData ?? []) as unknown as PersistedPost[];
  return rows.map((post) => toPost(post));
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("posts")
    .select(
      "id, body, created_at, author_id, media_urls, profiles!posts_author_id_fkey(display_name, handle, initials)",
    )
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as PersistedPost[];
  return rows.map((post) => toPost(post));
}

export async function fetchProfileByHandle(handle: string): Promise<PersistedProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle, initials, bio")
    .ilike("handle", handle)
    .maybeSingle();

  if (error) throw error;
  return data as PersistedProfile | null;
}

export async function searchProfiles(query: string): Promise<Author[]> {
  const term = query.trim();
  const request = supabase
    .from("profiles")
    .select("id, display_name, handle, initials, bio")
    .order("display_name", { ascending: true })
    .limit(12);
  const { data, error } = term
    ? await request.or(`display_name.ilike.%${term}%,handle.ilike.%${term}%`)
    : await request;

  if (error) throw error;
  return ((data ?? []) as PersistedProfile[]).map(toAuthor);
}

export async function fetchSuggestedProfiles(
  query: string = "",
  limit: number = 5,
): Promise<Connection[]> {
  const userId = await maybeCurrentUserId();
  const term = query.trim();
  const request = supabase
    .from("profiles")
    .select("id, display_name, handle, initials, bio")
    .order("display_name", { ascending: true })
    .limit(limit + 1);
  const { data, error } = term
    ? await request.or(`display_name.ilike.%${term}%,handle.ilike.%${term}%`)
    : await request;
  if (error) throw error;

  const profiles = ((data ?? []) as PersistedProfile[])
    .filter((profile) => profile.id !== userId)
    .slice(0, limit);
  if (!userId || profiles.length === 0) return profiles.map((profile) => toConnection(profile));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: followsData, error: followsError } = await (supabase as any)
    .from("follows")
    .select("followee_id")
    .eq("follower_id", userId)
    .in(
      "followee_id",
      profiles.map((profile) => profile.id),
    );
  if (followsError) throw followsError;

  const followingIds = new Set(
    ((followsData ?? []) as Pick<PersistedFollow, "followee_id">[]).map(
      (follow) => follow.followee_id,
    ),
  );
  return profiles.map((profile) => toConnection(profile, followingIds.has(profile.id)));
}

export async function toggleFollowProfile(handle: string, active: boolean) {
  const followerId = await currentUserId();
  const profile = await fetchProfileByHandle(handle);
  if (!profile) throw new Error("User not found");
  if (profile.id === followerId) throw new Error("You cannot follow yourself");

  if (active) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("follows")
      .delete()
      .match({ follower_id: followerId, followee_id: profile.id });
    if (error) throw error;
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("follows").insert({
    follower_id: followerId,
    followee_id: profile.id,
  });
  if (error) throw error;
  return true;
}

export async function fetchConnections(kind: "followers" | "following"): Promise<Connection[]> {
  const userId = await currentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: followsData, error } = await (supabase as any)
    .from("follows")
    .select("follower_id, followee_id, created_at")
    .eq(kind === "followers" ? "followee_id" : "follower_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const follows = (followsData ?? []) as unknown as PersistedFollow[];
  const profileIds = follows.map((follow) =>
    kind === "followers" ? follow.follower_id : follow.followee_id,
  );
  if (profileIds.length === 0) return [];

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, handle, initials, bio")
    .in("id", profileIds);
  if (profilesError) throw profilesError;

  const profiles = new Map(
    ((profilesData ?? []) as PersistedProfile[]).map((profile) => [profile.id, profile]),
  );

  if (kind === "following") {
    return profileIds
      .map((id) => profiles.get(id))
      .filter((profile): profile is PersistedProfile => !!profile)
      .map((profile) => toConnection(profile, true));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myFollowsData, error: myFollowsError } = await (supabase as any)
    .from("follows")
    .select("followee_id")
    .eq("follower_id", userId)
    .in("followee_id", profileIds);
  if (myFollowsError) throw myFollowsError;

  const followingBackIds = new Set(
    ((myFollowsData ?? []) as Pick<PersistedFollow, "followee_id">[]).map(
      (follow) => follow.followee_id,
    ),
  );
  return profileIds
    .map((id) => profiles.get(id))
    .filter((profile): profile is PersistedProfile => !!profile)
    .map((profile) => toConnection(profile, followingBackIds.has(profile.id)));
}

export async function fetchPostsByHandle(handle: string): Promise<Post[]> {
  const profile = await fetchProfileByHandle(handle);
  if (!profile) return [];
  return fetchUserPosts(profile.id);
}

export async function fetchReplies(postId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(postId);
  if (!isUuid) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("replies")
    .select(
      "id, post_id, body, created_at, author_id, profiles!replies_author_id_fkey(display_name, handle, initials)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    postId: row.post_id,
    author: toAuthor(row.profiles),
    time: age(row.created_at),
    body: row.body,
    sparks: 0,
  }));
}

export async function fetchUserReplies(userId: string): Promise<Reply[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("replies")
    .select(
      "id, post_id, body, created_at, author_id, profiles!replies_author_id_fkey(display_name, handle, initials)",
    )
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    postId: row.post_id,
    author: toAuthor(row.profiles),
    time: age(row.created_at),
    body: row.body,
    sparks: 0,
  }));
}

export async function createReply(postId: string, body: string) {
  const authorId = await currentUserId();
  const trimmedBody = normalizeTextBody(body, REPLY_BODY_LIMIT);
  if (!trimmedBody) {
    throw new Error("Write a reply before sending");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("replies").insert({
    post_id: postId,
    author_id: authorId,
    body: trimmedBody,
  });
  if (error) throw error;
}

function toChatMessage(row: PersistedMessage, myUserId: string): ChatMessage {
  return {
    id: row.id,
    from: row.sender_id === myUserId ? "me" : "them",
    body: row.deleted_for_everyone_at ? "" : row.body,
    time: age(row.created_at),
    attachments: row.deleted_for_everyone_at ? [] : normalizeAttachmentUrls(row.attachments ?? []),
    ...(row.deleted_for_everyone_at ? { deletedForBoth: true } : {}),
  };
}

function toConversation(row: PersistedConversation, myUserId: string): Conversation {
  const otherParticipant =
    row.conversation_participants?.find((participant) => participant.user_id !== myUserId) ??
    row.conversation_participants?.[0];
  const person = toAuthor(otherParticipant?.profiles ?? null);
  const latest = row.messages?.[0];
  const latestMessage = latest ? toChatMessage(latest as PersistedMessage, myUserId) : null;

  return {
    id: row.id,
    person,
    preview:
      latestMessage?.body ||
      latestMessage?.attachments?.[0]?.label ||
      "Start a private conversation...",
    time: latest ? age(latest.created_at) : age(row.updated_at),
    messages: latestMessage ? [latestMessage] : [],
  };
}

export async function fetchConversations(): Promise<Conversation[]> {
  const userId = await currentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("conversations")
    .select(
      "id, creator_id, created_at, updated_at, conversation_participants(user_id, profiles!conversation_participants_user_id_fkey(id, display_name, handle, initials, bio)), messages(id, body, sender_id, attachments, deleted_for_everyone_at, created_at)",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as PersistedConversation[]).map((row) =>
    toConversation(row, userId),
  );
}

export async function fetchConversation(conversationId: string): Promise<Conversation | null> {
  const userId = await currentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("conversations")
    .select(
      "id, creator_id, created_at, updated_at, conversation_participants(user_id, profiles!conversation_participants_user_id_fkey(id, display_name, handle, initials, bio)), messages(id, conversation_id, body, sender_id, attachments, deleted_for_everyone_at, created_at)",
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as PersistedConversation;
  const conversation = toConversation(row, userId);
  conversation.messages = ((row.messages ?? []) as unknown as PersistedMessage[])
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((message) => toChatMessage(message, userId));
  return conversation;
}

export async function createConversationWith(handle: string): Promise<Conversation> {
  const userId = await currentUserId();
  const profile = await fetchProfileByHandle(handle);
  if (!profile) throw new Error("User not found");
  if (profile.id === userId) throw new Error("Choose another user to message");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conversation, error } = await (supabase as any)
    .from("conversations")
    .insert({ creator_id: userId })
    .select("id, creator_id, created_at, updated_at")
    .single();
  if (error) throw error;

  const conversationId = conversation.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: participantError } = await (supabase as any)
    .from("conversation_participants")
    .insert([
      { conversation_id: conversationId, user_id: userId },
      { conversation_id: conversationId, user_id: profile.id },
    ]);
  if (participantError) throw participantError;

  return {
    id: conversationId,
    person: toAuthor(profile),
    preview: "Start a private conversation...",
    time: "now",
    messages: [],
  };
}

export async function sendMessage(
  conversationId: string,
  body: string,
  attachments?: ChatAttachment[],
): Promise<ChatMessage> {
  const userId = await currentUserId();
  const trimmed = body.trim();
  const cleanedAttachments = normalizeAttachmentUrls(attachments);
  if (!trimmed && cleanedAttachments.length === 0) {
    throw new Error("Write a message or attach media");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      body: trimmed,
      attachments: cleanedAttachments,
    })
    .select(
      "id, conversation_id, body, sender_id, attachments, deleted_for_everyone_at, created_at",
    )
    .single();
  if (error) throw error;

  return toChatMessage(data as unknown as PersistedMessage, userId);
}

export async function deleteMessageForMe(messageId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("delete_message_for_me", {
    target_message_id: messageId,
  });
  if (error) throw error;
}

export async function deleteMessageForBoth(messageId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("delete_message_for_everyone", {
    target_message_id: messageId,
  });
  if (error) throw error;
}

export async function deleteConversationForMe(conversationId: string) {
  const userId = await currentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("conversation_participants")
    .delete()
    .match({ conversation_id: conversationId, user_id: userId });
  if (error) throw error;
}

export async function deleteMessageAttachmentForBoth(messageId: string, attachmentId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("delete_message_attachment_for_everyone", {
    target_message_id: messageId,
    target_attachment_id: attachmentId,
  });
  if (error) throw error;
}

export async function fetchNotifications(): Promise<PulseNotification[]> {
  const userId = await currentUserId();
  if (isLocalProfileId(userId)) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("notifications")
    .select(
      "id, kind, post_id, read_at, created_at, actor:profiles!notifications_actor_id_fkey(display_name, handle)",
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((notification) => {
    const actor = notification.actor?.display_name ?? notification.actor?.handle ?? "Someone";
    const kind = notification.kind as PulseNotification["kind"];
    const postHref = notification.post_id ? `/post/${notification.post_id}` : undefined;
    const textByKind: Record<PulseNotification["kind"], string> = {
      spark: `${actor} sparked your pulse.`,
      echo: `${actor} echoed your pulse.`,
      follow: `${actor} started following you.`,
      mention: `${actor} mentioned you.`,
      reply: `${actor} replied to your pulse.`,
      message: `${actor} sent you a message.`,
      system: "Pulse has an update for you.",
    };
    return {
      id: String(notification.id),
      kind,
      text: textByKind[kind] ?? "You have a new notification.",
      time: age(notification.created_at),
      ...(kind === "message" ? { href: "/messages" } : postHref ? { href: postHref } : {}),
      read: !!notification.read_at,
    };
  });
}

export async function markNotificationRead(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchLists(): Promise<PulseList[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("lists")
    .select("id, slug, name, description, owner_id, is_private, created_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as PersistedList[];
  if (rows.length === 0) return [];

  const ownerIds = [...new Set(rows.map((list) => list.owner_id))];
  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, handle, initials, bio")
    .in("id", ownerIds);
  if (profilesError) throw profilesError;

  const profiles = new Map(
    ((profilesData ?? []) as PersistedProfile[]).map((profile) => [profile.id, profile]),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membersData } = await (supabase as any)
    .from("list_members")
    .select("list_id")
    .in(
      "list_id",
      rows.map((list) => list.id),
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (membersData ?? []) as any[];
  const memberCounts = new Map<string, number>();
  for (const member of members) {
    memberCounts.set(member.list_id, (memberCounts.get(member.list_id) ?? 0) + 1);
  }

  return rows.map((list) => ({
    slug: list.slug,
    name: list.name,
    description: list.description || "Custom curated feed",
    curator: toAuthor(profiles.get(list.owner_id) ?? null),
    members: memberCounts.get(list.id) ?? 0,
    posts: 0,
    pinned: list.is_private,
  }));
}

export async function createList(name: string, description: string, isPrivate: boolean = false) {
  const ownerId = await currentUserId();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("lists").insert({
    owner_id: ownerId,
    slug,
    name: name.trim(),
    description: description.trim(),
    is_private: isPrivate,
  });
  if (error) throw error;
}

export async function fetchCommunities(): Promise<Community[]> {
  const userId = await maybeCurrentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("communities")
    .select("id, slug, name, description, owner_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as PersistedCommunity[];
  if (rows.length === 0) return [];

  const ids = rows.map((community) => community.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membersData, error: membersError } = await (supabase as any)
    .from("community_members")
    .select("community_id, user_id")
    .in("community_id", ids);
  if (membersError) throw membersError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (membersData ?? []) as any[];
  const counts = new Map<string, number>();
  const joined = new Set<string>();
  for (const member of members) {
    counts.set(member.community_id, (counts.get(member.community_id) ?? 0) + 1);
    if (userId && member.user_id === userId) joined.add(member.community_id);
  }

  return rows.map((community) => ({
    slug: community.slug,
    name: community.name,
    blurb: community.description || "A shared room for related posts and people.",
    members: formatCount(counts.get(community.id) ?? 0),
    activity: age(community.created_at),
    joined: joined.has(community.id),
  }));
}

export async function createCommunity(name: string, description: string) {
  const ownerId = await currentUserId();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("communities").insert({
    owner_id: ownerId,
    slug,
    name: name.trim(),
    description: description.trim(),
  });
  if (error) throw error;
}

export async function toggleCommunityMembership(slug: string, active: boolean) {
  const userId = await currentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: community, error: communityError } = await (supabase as any)
    .from("communities")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (communityError) throw communityError;
  if (!community) throw new Error("Community not found");

  if (active) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("community_members")
      .delete()
      .match({ community_id: community.id, user_id: userId });
    if (error) throw error;
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("community_members").insert({
    community_id: community.id,
    user_id: userId,
  });
  if (error) throw error;
  return true;
}
