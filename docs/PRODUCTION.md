# Production Setup

This app builds to a Cloudflare Worker with static assets and uses Supabase for
auth, database, and media storage.

## Supabase

Apply the migrations in `supabase/migrations` before sending production traffic.

Required project settings:

- Authentication providers:
  - Enable email/password auth.
  - For production security, keep email confirmations enabled.
  - Set the Site URL to the Cloudflare production URL.
  - Add redirect URLs for:
    - `https://<production-domain>/auth`
    - `https://<staging-domain>/auth` when using staging
    - `http://127.0.0.1:8080/auth` for local development
    - `http://127.0.0.1:4174/auth` for local Worker preview
  - Configure custom SMTP for reliable confirmation and password reset email.
  - If Google login is enabled, configure the OAuth provider in Supabase and
    add the Cloudflare production callback/redirect URL to Google Cloud.
- Database:
  - Run all migrations.
  - Keep RLS enabled on every public table.
  - If the Supabase project uses explicit Data API exposure, grant Data API
    access for the public tables used by the app while keeping RLS policies in
    place.
- Storage:
  - Create the `pulse-media` bucket.
  - Use a public bucket only if uploaded media should be public.
  - Enforce upload MIME/size limits in Storage policies before accepting
    untrusted production uploads.

Auth behavior:

- When email confirmations are enabled, Supabase returns a user with no session
  after signup. The app now shows a confirmation message and waits for the user
  to confirm by email.
- Confirmation links should redirect to `/auth`; that route exchanges the auth
  code for a session and then sends the user to the feed.
- Local prototype fallback auth is development-only and is not active in
  production builds.

## Cloudflare

Use Node.js `22.13.0` or newer.

Set these Worker variables/secrets in Cloudflare:

```txt
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Only set `SUPABASE_SERVICE_ROLE_KEY` if a trusted server-only feature actually
needs it. Never expose it with a `VITE_` prefix.

Deploy:

```sh
npm ci
npm run check
npm run preview
npm run deploy:cloudflare:dry-run
npm run deploy:cloudflare
```

Notes:

- `npm run build` generates `.output/server/wrangler.json`.
- `npm run prepare:cloudflare` patches that generated config to enable Workers
  observability before deploy.
- `npm run preview` builds the app, prepares the generated config, and serves
  the production Worker locally with Wrangler.
- `deploy:cloudflare` uses `--keep-vars`, so dashboard-managed secrets and
  variables are preserved.
- The Worker response wrapper adds baseline security headers:
  `x-content-type-options`, `referrer-policy`, `x-frame-options`, and
  `permissions-policy`.

## Release Gate

Before promoting a deploy:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run prepare:cloudflare
wrangler deploy --config .output/server/wrangler.json --dry-run
```

Then verify in browser:

- Signup creates a Supabase user and shows a confirmation-email message.
- Email confirmation redirects back to `/auth` and signs the user in.
- Sign-in with confirmed email/password reaches `/`.
- Protected routes `/profile`, `/settings`, `/compose`, `/bookmarks`,
  `/drafts`, and `/notifications` redirect when signed out and load when signed
  in.
- Posting with image/video media writes to Supabase and reloads in the feed.
