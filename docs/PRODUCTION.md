# Production Setup

This app builds to a Cloudflare Worker with static assets and uses Supabase for
auth, database, and media storage.

## Supabase

Apply the migrations in `supabase/migrations` before sending production traffic.
Use `docs/LAUNCH_CHECKLIST.md` as the launch gate.

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
  - Keep `rate_limit_events` private; it is only used by security-definer
    rate-limit checks.
  - If the Supabase project uses explicit Data API exposure, grant Data API
    access for the public tables used by the app while keeping RLS policies in
    place.
- Storage:
  - Create the `pulse-media` bucket.
  - Use a public bucket only if uploaded media should be public.
  - Enforce upload MIME/size limits in Storage policies before accepting
    untrusted production uploads.

### Migration Reconciliation

Before pushing migrations to the linked production project, run:

```sh
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

If the remote migration history has versions that are not present locally, do
not mark them reverted until the live schema has been inspected. Pull or
recreate the missing migration files when possible. If the live schema already
matches the committed migrations, use `supabase migration repair --linked
--status applied <version>` only for versions that were genuinely applied.

### First Admin

Bootstrap the first admin before public launch. Use one of these approaches from
the Supabase dashboard SQL editor with service-role/admin privileges:

```sql
insert into public.moderation_role_members (profile_id, role, permissions)
values (
  '<your-profile-uuid>',
  'admin',
  array[
    'view_admin',
    'moderate_content',
    'manage_reports',
    'manage_users',
    'manage_roles',
    'view_analytics'
  ]::text[]
)
on conflict (profile_id) do update
set role = excluded.role,
    permissions = excluded.permissions,
    updated_at = now();
```

Alternatively, set the user's Supabase Auth `app_metadata.role` to `admin`.
Do not use `user_metadata` for authorization; users can edit it.

### Rate Limits and Abuse Controls

Database-enforced limits are in the latest migrations:

- Posts: 30 per hour per user.
- Replies: 60 per hour per user.
- Messages: 120 per hour per user.
- Reports: 10 per hour per user.
- Media uploads: 80 per hour per user.
- Duplicate pending reports by the same reporter for the same target are
  coalesced instead of creating more queue items.

Supabase Auth has its own platform-level rate limits. The app also has a
client-side auth attempt limiter to reduce accidental or scripted retries from
the UI, but the server-side Supabase Auth limits remain the authoritative layer.

### Backups

Before launch:

- Use a paid Supabase plan for scheduled backups and point-in-time recovery.
- Confirm the recovery point objective that matches the risk of losing posts,
  messages, reports, and moderation audit logs.
- Test a restore into a staging project before relying on backups.
- Export a schema snapshot after every migration batch.
- Keep migration files reviewed and committed before deploying app code that
  depends on them.

### Moderation Operations

Public users can report posts and profiles. Admins should review `/admin` daily
while the site has active users.

Moderation actions that remove content, restrict users, or change elevated roles
require typed confirmation in the admin UI. Moderation outcomes create system
notifications for affected users and audit entries for admins.

Policy pages included in the app:

- `/terms`
- `/privacy`
- `/guidelines`
- `/appeals`

Auth behavior:

- When email confirmations are enabled, Supabase returns a user with no session
  after signup. The app now shows a confirmation message and waits for the user
  to confirm by email.
- Confirmation links should redirect to `/auth`; that route exchanges the auth
  code for a session and then sends the user to the feed.
- Local prototype fallback auth is disabled by default. Only set
  `VITE_ENABLE_LOCAL_AUTH_FALLBACK=true` for offline UI prototyping; leave it
  false for online Supabase testing and all production builds.

## Cloudflare

Use Node.js `22.13.0` or newer.

Set these Worker variables/secrets in Cloudflare:

```txt
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_ENABLE_LOCAL_AUTH_FALLBACK
VITE_SENTRY_DSN
VITE_SENTRY_TRACES_SAMPLE_RATE
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

## Monitoring and Logging

Cloudflare:

- Keep Workers Observability enabled in the generated Wrangler config.
- Review Worker invocation errors after each deploy.
- Add alerts for elevated 5xx responses, high request volume, and auth/upload
  routes if available in your Cloudflare plan.

Supabase:

- Monitor Auth errors, Postgres API errors, Storage upload errors, and database
  resource saturation from the Supabase dashboard.
- Review RLS denial spikes after policy changes.
- Run `npx supabase db lint --local --fail-on error` before deploys and use the
  Supabase advisors against production before major launches.
- Use `npm run check:supabase:advisors` after the project is linked and the user
  has permission to run remote advisors.

Sentry:

- Set `VITE_SENTRY_DSN` to enable frontend error capture.
- Set `VITE_SENTRY_TRACES_SAMPLE_RATE` conservatively, for example `0.05`.
- Do not send service-role keys, auth tokens, or private message bodies to
  Sentry.
- Verify one test error in staging before enabling alerts for production.

## Release Gate

Before promoting a deploy:

```sh
npm run check
npm run check:security
npm run deploy:cloudflare:dry-run
```

Then verify in browser:

- Signup creates a Supabase user and shows a confirmation-email message.
- Email confirmation redirects back to `/auth` and signs the user in.
- Sign-in with confirmed email/password reaches `/`.
- Protected routes `/profile`, `/settings`, `/compose`, `/bookmarks`,
  `/drafts`, and `/notifications` redirect when signed out and load when signed
  in.
- Posting with image/video media writes to Supabase and reloads in the feed.
- Reporting a post/profile creates one pending moderation queue item.
- Re-reporting the same target as the same user does not create duplicate
  pending reports.
- A user beyond posting/messaging/upload limits gets a friendly failure.
- Admin destructive actions require typed confirmation.
- Sentry receives a staging test error when `VITE_SENTRY_DSN` is set.
