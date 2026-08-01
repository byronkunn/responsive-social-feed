import { supabase } from "@/integrations/supabase/client";
import {
  conversations as seedConversations,
  postById,
  type Author,
  type ChatAttachment,
  type ChatMessage,
  type Conversation,
  type Draft,
  type Post,
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

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to continue");
  return data.user.id;
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

function toPost(
  post: PersistedPost,
  counts: { spark: number; echo: number; bookmark: number } = { spark: 0, echo: 0, bookmark: 0 },
): Post {
  const mediaUrls = post.media_urls;
  const imageUrls = mediaUrls.filter((url) => !isVideoUrl(url));
  const videoUrls = mediaUrls.filter(isVideoUrl);

  return {
    id: post.id,
    author: toAuthor(post.profiles),
    time: age(post.created_at),
    body: post.body,
    replies: 0,
    echoes: counts.echo,
    sparks: counts.spark,
    views: "—",
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
    return postById(id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("posts")
    .select(
      "id, body, created_at, author_id, media_urls, profiles!posts_author_id_fkey(display_name, handle, initials)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return postById(id) ?? null;
  }

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

export async function seed10UsersAndAlbumPosts() {
  const dummyUsers = [
    { name: "Maya Lin", handle: "mayalin", initials: "ML" },
    { name: "Alex Rivera", handle: "arivera", initials: "AR" },
    { name: "Sarah Chen", handle: "schen", initials: "SC" },
    { name: "Kai Vance", handle: "kvance", initials: "KV" },
    { name: "Leo Miller", handle: "lmiller", initials: "LM" },
    { name: "Chloe Bennett", handle: "cbennett", initials: "CB" },
    { name: "Samira Khan", handle: "skhan", initials: "SK" },
    { name: "Liam O'Connor", handle: "loconnor", initials: "LO" },
    { name: "Nina Patel", handle: "npatel", initials: "NP" },
    { name: "Ethan Brooks", handle: "ebrooks", initials: "EB" },
  ];

  const albumImages = [
    "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1561948955-570b270e7c36?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=800&auto=format&fit=crop&q=80",
  ];

  const tagsList = [
    "#cuties",
    "#photography",
    "#cats",
    "#vibes",
    "#nature",
    "#design",
    "#art",
    "#pets",
  ];

  let currentUserIdVal: string | null = null;
  try {
    currentUserIdVal = await currentUserId();
  } catch {
    currentUserIdVal = null;
  }

  // Insert dummy profile rows if possible
  for (const user of dummyUsers) {
    const fakeId = `dummy-${user.handle}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").upsert({
      id: currentUserIdVal ?? fakeId,
      display_name: user.name,
      handle: user.handle,
      initials: user.initials,
    });
  }

  // Insert 10 album posts with multiple attached images and random tags
  for (let i = 0; i < dummyUsers.length; i++) {
    const user = dummyUsers[i]!;
    const randomTag = tagsList[i % tagsList.length];
    const imageSlice = albumImages.slice(
      (i * 2) % albumImages.length,
      ((i * 2) % albumImages.length) + 3,
    );
    if (imageSlice.length === 0 && albumImages[0]) {
      imageSlice.push(albumImages[0]);
    }

    const body = `Album by @${user.handle} - ${user.name}'s collection! ${randomTag}`;

    if (currentUserIdVal) {
      await createPost(body, "Everyone", imageSlice);
    }
  }
}
