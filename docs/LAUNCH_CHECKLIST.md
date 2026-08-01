# Launch Checklist

Use this checklist before opening Pulse to public traffic. Items marked
dashboard-only must be completed in the relevant vendor account.

## 1. Supabase Migrations

- Run `npx supabase migration list --linked` and confirm local and remote
  history match.
- If remote history contains old versions that are missing locally, inspect the
  live schema before using `supabase migration repair`.
- After history is reconciled, apply migrations with `npx supabase db push
--linked`.
- Run `npx supabase db lint --local --fail-on error`.
- Run `npm run check:supabase:advisors` against staging or production.

Known current state on this machine:

- Remote history includes legacy versions `20260723000001` through
  `20260725000007` that are not present in this repo.
- Local history includes the current app migrations from `20260801024729`
  through `20260801190510`.
- Do not repair remote migration history until the live schema is confirmed to
  match the committed migrations.

## 2. Production Secrets

Set these Cloudflare Worker variables/secrets:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_TRACES_SAMPLE_RATE`

Keep `SUPABASE_SERVICE_ROLE_KEY` out of browser-exposed variables. Only add it as
a server-only secret when a trusted server feature needs it.

## 3. Supabase Platform Protections

Dashboard-only:

- Enable email/password auth.
- Keep email confirmation enabled for production.
- Configure Site URL and redirect URLs for production, staging, and local
  previews.
- Configure custom SMTP for reliable auth email delivery.
- Create the `pulse-media` bucket.
- Enforce bucket MIME and size limits for uploaded media.
- Confirm Auth platform rate limits are enabled.
- Enable scheduled backups and point-in-time recovery on a paid plan.

## 4. First Admin

- Create or identify the first production profile.
- Insert that profile into `public.moderation_role_members` as `admin`, using
  the SQL in `docs/PRODUCTION.md`.
- Sign in as that user and verify `/admin` loads.
- Sign in as a non-admin user and verify `/admin` denies access.

## 5. Browser QA

Run these against staging before production:

- Sign up, confirm email, sign in, sign out, and reset password.
- Create posts with text, single image, image album, video, and URL content.
- Verify profile tabs, feed, explore, search, post detail, comments, likes,
  reposts, bookmarks, and notifications.
- Start at least two conversations with different users.
- Send text, images, albums, videos, and URLs in messages.
- Verify messages are private to conversation participants.
- Delete a message for yourself and for everyone.
- Delete a full chat.
- Report a post and a profile.
- Re-report the same target and confirm no duplicate pending report appears.
- Use `/admin` to hide/restore/remove content and restrict/unrestrict users.
- Confirm destructive admin actions require typed confirmation.
- Confirm moderation notifications appear for affected users.
- Repeat core flows on a mobile viewport.

## 6. Monitoring and Alerts

Cloudflare dashboard:

- Enable Workers Observability.
- Add alerts for Worker 5xx spikes.
- Add alerts for unusual request volume.
- Review Worker errors after each deployment.

Supabase dashboard:

- Monitor Auth errors, Postgres API errors, Storage failures, and database
  resource usage.
- Review RLS denial spikes after each policy change.
- Run production advisors before launches.

Sentry:

- Create the project.
- Set `VITE_SENTRY_DSN`.
- Trigger one staging test error.
- Add alert rules for new issues and high error volume.

## 7. Legal and Policy Review

Dashboard/review-only:

- Review `/terms`, `/privacy`, `/guidelines`, and `/appeals` with counsel before
  public launch.
- Add a real support/contact address to the policy text before launch.
- Confirm the privacy policy reflects actual analytics, logs, cookies, and data
  retention practices.

## 8. Moderation Operations

- Assign at least one admin and one backup moderator.
- Define report response time targets.
- Define escalation rules for illegal content, abuse, impersonation, spam, and
  repeat violations.
- Define appeal handling rules and record outcomes in the admin audit trail.
- Review the moderation queue daily while public traffic is active.

## 9. Performance and Security Audit

- Run `npm run check`.
- Run `npm run check:security`.
- Run `npm run deploy:cloudflare:dry-run`.
- Run Lighthouse or browser performance checks against staging.
- Confirm no service-role keys or private tokens are exposed in client bundles.
- Confirm RLS policies prevent cross-user access to messages, drafts, and
  notifications.
- Confirm uploads reject unsupported media types and oversized files.
