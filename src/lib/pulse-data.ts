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

export const demoAuthors = {
  ada: { name: "Ada Rowe", handle: "adarowe", initials: "AR", verified: true },
  miles: { name: "Miles Chen", handle: "mileschen", initials: "MC" },
  sora: { name: "Sora Kim", handle: "sorakim", initials: "SK", verified: true },
  nina: { name: "Nina Patel", handle: "ninap", initials: "NP" },
  theo: { name: "Theo Grant", handle: "theog", initials: "TG" },
} satisfies Record<string, Author>;

export function authorByHandle(handle: string) {
  const normalized = handle.toLowerCase();
  return Object.values(demoAuthors).find((author) => author.handle.toLowerCase() === normalized);
}

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

export const replies: Reply[] = [
  {
    id: "reply-demo-020-1",
    postId: "demo-020",
    author: demoAuthors.miles,
    time: "2m",
    body: "The album grid feels stable now. I would still verify the +more state on a narrow phone before release.",
    sparks: 12,
  },
  {
    id: "reply-demo-020-2",
    postId: "demo-020",
    author: demoAuthors.sora,
    time: "1m",
    body: "Video and image posts both keep their controls reachable on my pass.",
    sparks: 9,
  },
  {
    id: "reply-demo-019-1",
    postId: "demo-019",
    author: demoAuthors.nina,
    time: "6m",
    body: "Controls are visible, and the card does not jump when metadata loads.",
    sparks: 5,
  },
  {
    id: "reply-demo-018-1",
    postId: "demo-018",
    author: demoAuthors.theo,
    time: "12m",
    body: "Single image opens cleanly. Pagination only appears when there is more than one asset, which is right.",
    sparks: 7,
  },
  {
    id: "reply-demo-017-1",
    postId: "demo-017",
    author: demoAuthors.ada,
    time: "18m",
    body: "Pixiv-style creator pages need strong media tabs, but the first pass can stay post-focused.",
    sparks: 16,
  },
  {
    id: "reply-demo-016-1",
    postId: "demo-016",
    author: demoAuthors.sora,
    time: "24m",
    body: "The fourth image overlay is readable on desktop and mobile.",
    sparks: 4,
  },
  {
    id: "reply-demo-011-1",
    postId: "demo-011",
    author: demoAuthors.nina,
    time: "1h",
    body: "Every optimistic action should have a clear signed-out error and a persisted signed-in path.",
    sparks: 21,
  },
];

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

export function postsByAuthorHandle(handle: string) {
  const normalized = handle.toLowerCase();
  return posts.filter((p) => p.author.handle.toLowerCase() === normalized);
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

export type ChatAttachment = {
  id: string;
  type: "image" | "video" | "url";
  url: string;
  label?: string;
};

export type ChatMessage = {
  id: string;
  from: "me" | "them";
  body: string;
  time: string;
  attachments?: ChatAttachment[];
  deletedForMe?: boolean;
  deletedForBoth?: boolean;
};

export type Conversation = {
  id: string;
  person: Author;
  preview: string;
  time: string;
  unread?: number;
  messages: ChatMessage[];
};

export const messageContacts: Author[] = [
  { name: "Ada Rowe", handle: "adarowe", initials: "AR", verified: true },
  { name: "Miles Chen", handle: "mileschen", initials: "MC" },
  { name: "Sora Kim", handle: "sorakim", initials: "SK", verified: true },
  { name: "Nina Patel", handle: "ninap", initials: "NP" },
  { name: "Theo Grant", handle: "theog", initials: "TG" },
  { name: "Jules Park", handle: "julespark", initials: "JP" },
  { name: "Mina Ortiz", handle: "minaortiz", initials: "MO" },
  { name: "Remy Stone", handle: "remystone", initials: "RS" },
];

export const conversations: Conversation[] = [
  {
    id: "ada-rowe",
    person: messageContacts[0]!,
    preview: "Album looks good. Can you send the video too?",
    time: "4m",
    unread: 2,
    messages: [
      {
        id: "ada-1",
        from: "them",
        body: "Can you review this album layout before we ship?",
        time: "9:12 AM",
        attachments: [
          { id: "ada-img-1", type: "image", url: "/demo-media/photo-10.jpg", label: "Hero crop" },
          { id: "ada-img-2", type: "image", url: "/demo-media/photo-23.jpg", label: "Mobile crop" },
          {
            id: "ada-img-3",
            type: "image",
            url: "/demo-media/photo-29.jpg",
            label: "Gallery crop",
          },
        ],
      },
      {
        id: "ada-2",
        from: "me",
        body: "The album grid holds up. I would keep the first image wide and cap the preview at four tiles.",
        time: "9:16 AM",
      },
      {
        id: "ada-3",
        from: "them",
        body: "Album looks good. Can you send the video too?",
        time: "9:21 AM",
      },
    ],
  },
  {
    id: "miles-chen",
    person: messageContacts[1]!,
    preview: "Sent a video sample for playback testing.",
    time: "18m",
    messages: [
      {
        id: "miles-1",
        from: "me",
        body: "Here is the clip I used to verify native controls.",
        time: "8:44 AM",
        attachments: [
          {
            id: "miles-video-1",
            type: "video",
            url: "/demo-media/flower.mp4",
            label: "MP4 sample",
          },
        ],
      },
      {
        id: "miles-2",
        from: "them",
        body: "Playback, pause, and fullscreen are working here.",
        time: "8:50 AM",
      },
    ],
  },
  {
    id: "sora-kim",
    person: messageContacts[2]!,
    preview: "Pixiv and portfolio URLs are in the thread.",
    time: "42m",
    unread: 1,
    messages: [
      {
        id: "sora-1",
        from: "them",
        body: "References for creator profile patterns.",
        time: "8:05 AM",
        attachments: [
          { id: "sora-url-1", type: "url", url: "https://www.pixiv.net/", label: "Pixiv" },
          { id: "sora-url-2", type: "url", url: "https://www.behance.net/", label: "Behance" },
        ],
      },
      {
        id: "sora-2",
        from: "me",
        body: "Good references. We should not copy the content model, but the media tabs are useful.",
        time: "8:08 AM",
      },
    ],
  },
  {
    id: "nina-patel",
    person: messageContacts[3]!,
    preview: "Two image options attached.",
    time: "1h",
    messages: [
      {
        id: "nina-1",
        from: "them",
        body: "Which thumbnail feels better for the message media tab?",
        time: "7:24 AM",
        attachments: [
          { id: "nina-img-1", type: "image", url: "/demo-media/photo-188.jpg", label: "Option A" },
          { id: "nina-img-2", type: "image", url: "/demo-media/photo-219.jpg", label: "Option B" },
        ],
      },
      {
        id: "nina-2",
        from: "me",
        body: "Option A reads faster at small sizes.",
        time: "7:29 AM",
      },
    ],
  },
  {
    id: "theo-grant",
    person: messageContacts[4]!,
    preview: "Delete controls need both scopes.",
    time: "2h",
    messages: [
      {
        id: "theo-1",
        from: "them",
        body: "For deletion, we need remove for me and remove for both parties.",
        time: "6:10 AM",
      },
      {
        id: "theo-2",
        from: "me",
        body: "Agreed. I will expose those scopes per message and for the whole chat.",
        time: "6:13 AM",
        attachments: [
          {
            id: "theo-video-1",
            type: "video",
            url: "/demo-media/flower.webm",
            label: "WebM sample",
          },
          { id: "theo-url-1", type: "url", url: "https://developer.mozilla.org/", label: "MDN" },
        ],
      },
    ],
  },
];

export function conversationById(id: string) {
  return conversations.find((c) => c.id === id);
}

export type MediaItem = { id: string; alt: string; hue: string };

export const gallery: Record<string, MediaItem[]> = {};
