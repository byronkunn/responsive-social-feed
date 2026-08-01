# Responsive Social Feed

A responsive social feed prototype built with TanStack Start, React, TypeScript,
Tailwind CSS, Supabase, and Lovable's TanStack Vite configuration.

The app includes a seeded demo timeline with 20 posts covering text updates,
external URLs, single images, image albums, and video posts. Authenticated
posting and persistence are wired through Supabase.

## Features

- Responsive desktop and mobile social feed layout
- Seeded demo posts for blank or local Supabase environments
- Image albums with gallery viewer
- Video post rendering with native browser controls
- Composer with image and video preview support
- Protected routes for profile, bookmarks, drafts, settings, messages, and
  notifications
- Supabase migrations for posts, profiles, reactions, follows, drafts,
  communities, lists, conversations, and notifications

## Development

Use Node.js 22.13 or newer.

```sh
nvm use
npm ci
cp .env.example .env
npm run dev
```

The dev server runs with Vite. By default, it is available at:

```txt
http://127.0.0.1:8080/
```

If that port is already in use, Vite will choose the next available port.

## Environment

Populate `.env` with the Supabase URL and publishable key from the project
dashboard.

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `VITE_` prefix.

## Quality Checks

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

Run everything with:

```sh
npm run check
```

## Demo Media

Demo images are downloaded from [Lorem Picsum](https://picsum.photos/). Demo
videos use the MDN CC0 flower sample from the
[HTML video example](https://interactive-examples.mdn.mozilla.net/pages/tabbed/video.html).

## Production Notes

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for the Supabase and Cloudflare
setup checklist.
