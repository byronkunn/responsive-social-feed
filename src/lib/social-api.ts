import { supabase } from "@/integrations/supabase/client";
import { postById, type Author, type Draft, type Post } from "@/lib/pulse-data";

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
  try {
    const fileExt = file.name.split(".").pop();
    const filePath = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { data, error } = await supabase.storage.from("pulse-media").upload(filePath, file);
    if (!error && data) {
      const { data: publicUrlData } = supabase.storage.from("pulse-media").getPublicUrl(data.path);
      if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
    }
  } catch {
    // Fallback to Data URL
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

  const { data, error } = await supabase
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

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
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
