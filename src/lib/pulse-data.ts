export type Author = {
  name: string;
  handle: string;
  initials: string;
  verified?: boolean;
};

export type Post = {
  id: string;
  author: Author;
  time: string;
  body: string;
  replies: number;
  echoes: number;
  sparks: number;
  views: string;
  tag?: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
};

export const currentUser: Author = {
  name: "Pulse Member",
  handle: "member",
  initials: "PM",
};

const demoAuthors = {
  ada: { name: "Ada Rowe", handle: "adarowe", initials: "AR", verified: true },
  miles: { name: "Miles Chen", handle: "mileschen", initials: "MC" },
  sora: { name: "Sora Kim", handle: "sorakim", initials: "SK", verified: true },
  nina: { name: "Nina Patel", handle: "ninap", initials: "NP" },
  theo: { name: "Theo Grant", handle: "theog", initials: "TG" },
} satisfies Record<string, Author>;

export const posts: Post[] = [
  {
    id: "demo-020",
    author: demoAuthors.ada,
    time: "4m",
    body: "Launch-day smoke test: image albums, video clips, link-only posts, and quote-style updates all need to feel native before this feed is production ready.",
    replies: 8,
    echoes: 18,
    sparks: 86,
    views: "8.9K",
    tag: "release",
    imageUrls: ["/demo-media/photo-10.jpg", "/demo-media/photo-23.jpg", "/demo-media/photo-29.jpg"],
  },
  {
    id: "demo-019",
    author: demoAuthors.miles,
    time: "11m",
    body: "Short video check: autoplay stays off, controls stay reachable, and the card keeps its layout on mobile.",
    replies: 3,
    echoes: 9,
    sparks: 44,
    views: "3.2K",
    tag: "video",
    videoUrl: "/demo-media/flower.mp4",
  },
  {
    id: "demo-018",
    author: demoAuthors.sora,
    time: "18m",
    body: "Single-image post for the art board. The viewer should open cleanly without shifting the surrounding feed.",
    replies: 5,
    echoes: 11,
    sparks: 73,
    views: "6.4K",
    tag: "visual",
    imageUrl: "/demo-media/photo-42.jpg",
  },
  {
    id: "demo-017",
    author: demoAuthors.nina,
    time: "27m",
    body: "Reference drop: https://www.pixiv.net/ and https://www.behance.net/ are useful patterns for creator profiles, galleries, saves, and mature content controls.",
    replies: 12,
    echoes: 28,
    sparks: 121,
    views: "12K",
    tag: "research",
  },
  {
    id: "demo-016",
    author: demoAuthors.theo,
    time: "39m",
    body: "Four-image album stress test. The +more overlay should be legible, and each image should preserve a stable aspect ratio.",
    replies: 2,
    echoes: 6,
    sparks: 37,
    views: "2.8K",
    tag: "albums",
    imageUrls: [
      "/demo-media/photo-64.jpg",
      "/demo-media/photo-76.jpg",
      "/demo-media/photo-101.jpg",
      "/demo-media/photo-119.jpg",
      "/demo-media/photo-164.jpg",
    ],
  },
  {
    id: "demo-015",
    author: demoAuthors.ada,
    time: "48m",
    body: "Production note: authenticated posting needs a friendly offline or signed-out demo path. Right now real writes depend on Supabase auth.",
    replies: 7,
    echoes: 14,
    sparks: 65,
    views: "5.1K",
    tag: "auth",
  },
  {
    id: "demo-014",
    author: demoAuthors.miles,
    time: "1h",
    body: "WebM compatibility check for browsers that prefer it.",
    replies: 1,
    echoes: 5,
    sparks: 29,
    views: "1.9K",
    tag: "video",
    videoUrl: "/demo-media/flower.webm",
  },
  {
    id: "demo-013",
    author: demoAuthors.sora,
    time: "1h",
    body: "Link-only posts should still have useful spacing: https://dribbble.com/ https://www.artstation.com/ https://www.deviantart.com/",
    replies: 6,
    echoes: 17,
    sparks: 91,
    views: "7.7K",
    tag: "links",
  },
  {
    id: "demo-012",
    author: demoAuthors.nina,
    time: "2h",
    body: "Moodboard pair: compare how two attachments crop in the compact grid.",
    replies: 4,
    echoes: 8,
    sparks: 53,
    views: "4.4K",
    tag: "design",
    imageUrls: ["/demo-media/photo-188.jpg", "/demo-media/photo-219.jpg"],
  },
  {
    id: "demo-011",
    author: demoAuthors.theo,
    time: "2h",
    body: "Production gap: optimistic updates, retry states, and empty/error/loading surfaces should be explicit for every network path.",
    replies: 9,
    echoes: 21,
    sparks: 118,
    views: "10K",
    tag: "quality",
  },
  {
    id: "demo-010",
    author: demoAuthors.ada,
    time: "3h",
    body: "Another single image, this time to check high-detail thumbnails against dense text.",
    replies: 3,
    echoes: 12,
    sparks: 58,
    views: "4.9K",
    tag: "visual",
    imageUrl: "/demo-media/photo-255.jpg",
  },
  {
    id: "demo-009",
    author: demoAuthors.miles,
    time: "3h",
    body: "Video plus context should stay scannable in the feed, not turn the timeline into a media wall.",
    replies: 5,
    echoes: 13,
    sparks: 72,
    views: "6.8K",
    tag: "video",
    videoUrl: "/demo-media/flower.mp4",
  },
  {
    id: "demo-008",
    author: demoAuthors.sora,
    time: "4h",
    body: "Gallery route inspiration: Pixiv ranking pages, creator collections, and tag pages suggest strong next steps after MVP feed posting.",
    replies: 11,
    echoes: 26,
    sparks: 137,
    views: "14K",
    tag: "roadmap",
  },
  {
    id: "demo-007",
    author: demoAuthors.nina,
    time: "5h",
    body: "Three-up album: first image spans wide, then the supporting frames sit below.",
    replies: 2,
    echoes: 7,
    sparks: 46,
    views: "3.5K",
    tag: "albums",
    imageUrls: [
      "/demo-media/photo-310.jpg",
      "/demo-media/photo-338.jpg",
      "/demo-media/photo-10.jpg",
    ],
  },
  {
    id: "demo-006",
    author: demoAuthors.theo,
    time: "5h",
    body: "Security pass before prod: RLS tests, service-role key audit, upload MIME checks, rate limits, and abuse reporting.",
    replies: 13,
    echoes: 33,
    sparks: 154,
    views: "18K",
    tag: "security",
  },
  {
    id: "demo-005",
    author: demoAuthors.ada,
    time: "6h",
    body: "Tiny update with one attachment. This should still feel worth posting.",
    replies: 1,
    echoes: 4,
    sparks: 24,
    views: "1.2K",
    tag: "daily",
    imageUrl: "/demo-media/photo-23.jpg",
  },
  {
    id: "demo-004",
    author: demoAuthors.miles,
    time: "7h",
    body: "External URL card candidates for later: Open Graph unfurling, blocked domains, moderation queues, and safe preview fetching.",
    replies: 4,
    echoes: 18,
    sparks: 84,
    views: "7.1K",
    tag: "links",
  },
  {
    id: "demo-003",
    author: demoAuthors.sora,
    time: "8h",
    body: "Album with many images to test the +more state.",
    replies: 6,
    echoes: 19,
    sparks: 102,
    views: "9.8K",
    tag: "albums",
    imageUrls: [
      "/demo-media/photo-29.jpg",
      "/demo-media/photo-42.jpg",
      "/demo-media/photo-64.jpg",
      "/demo-media/photo-76.jpg",
      "/demo-media/photo-101.jpg",
      "/demo-media/photo-119.jpg",
    ],
  },
  {
    id: "demo-002",
    author: demoAuthors.nina,
    time: "9h",
    body: "Prod-readiness checklist needs observability: server logs, client error capture, analytics events, and alerting around auth/upload failures.",
    replies: 8,
    echoes: 24,
    sparks: 131,
    views: "11K",
    tag: "ops",
  },
  {
    id: "demo-001",
    author: demoAuthors.theo,
    time: "10h",
    body: "Baseline text-only post. If this card looks boring but readable, the feed has a reliable floor.",
    replies: 3,
    echoes: 10,
    sparks: 57,
    views: "4.2K",
    tag: "baseline",
  },
];

export const trends: { topic: string; title: string; count: string }[] = [];

export const suggestions: Author[] = [];

export type Reply = {
  id: string;
  postId: string;
  author: Author;
  time: string;
  body: string;
  sparks: number;
};

export const replies: Reply[] = [];

export function repliesFor(postId: string) {
  return replies.filter((r) => r.postId === postId);
}

export function postById(id: string) {
  return posts.find((p) => p.id === id);
}

export function searchPosts(q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return posts.filter(
    (p) =>
      p.body.toLowerCase().includes(term) ||
      p.author.name.toLowerCase().includes(term) ||
      p.author.handle.toLowerCase().includes(term) ||
      (p.tag ?? "").toLowerCase().includes(term),
  );
}

export function postsByTag(tag: string) {
  const t = tag.toLowerCase();
  return posts.filter((p) => (p.tag ?? "").toLowerCase() === t);
}

export type PulseList = {
  slug: string;
  name: string;
  description: string;
  curator: Author;
  members: number;
  posts: number;
  pinned?: boolean;
};

export const lists: PulseList[] = [];

export type Community = {
  slug: string;
  name: string;
  blurb: string;
  members: string;
  activity: string;
  joined?: boolean;
};

export const communities: Community[] = [];

export type Draft = {
  id: string;
  body: string;
  savedAt: string;
};

export const drafts: Draft[] = [];

export type Connection = Author & { bio: string; follows?: boolean };

export const followers: Connection[] = [];

export const following: Connection[] = [];

export type ChatMessage = { id: string; from: "me" | "them"; body: string; time: string };

export type Conversation = {
  id: string;
  person: Author;
  preview: string;
  time: string;
  unread?: number;
  messages: ChatMessage[];
};

export const conversations: Conversation[] = [];

export function conversationById(id: string) {
  return conversations.find((c) => c.id === id);
}

export type MediaItem = { id: string; alt: string; hue: string };

export const gallery: Record<string, MediaItem[]> = {};
