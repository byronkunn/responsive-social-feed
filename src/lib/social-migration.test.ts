import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../supabase/migrations/20260801032310_social_feed_domains.sql", import.meta.url),
);
const sql = readFileSync(migrationPath, "utf8").toLowerCase();
const followupMigrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260801043000_post_media_and_profile_fixes.sql",
    import.meta.url,
  ),
);
const followupSql = readFileSync(followupMigrationPath, "utf8").toLowerCase();

const exposedTables = [
  "posts",
  "replies",
  "post_reactions",
  "follows",
  "drafts",
  "communities",
  "community_members",
  "lists",
  "list_members",
  "conversations",
  "conversation_participants",
  "messages",
  "notifications",
];

describe("social feed migration security", () => {
  it.each(exposedTables)("enables RLS on %s", (table) => {
    expect(sql).toContain(`alter table public.${table} enable row level security`);
  });

  it("restricts the account deletion RPC to authenticated users", () => {
    expect(sql).toContain("caller_id uuid := (select auth.uid())");
    expect(sql).toContain("revoke all on function public.delete_current_user() from public, anon");
    expect(sql).toContain(
      "grant execute on function public.delete_current_user() to authenticated",
    );
  });

  it("indexes the principal ownership and feed access paths", () => {
    expect(sql).toContain("posts_author_created_idx");
    expect(sql).toContain("messages_conversation_created_idx");
    expect(sql).toContain("notifications_recipient_created_idx");
  });

  it("stores post media separately and allows image-only posts", () => {
    expect(followupSql).toContain("add column media_urls text[] not null default '{}'::text[]");
    expect(followupSql).toContain("drop constraint posts_body_check");
    expect(followupSql).toContain("coalesce(array_length(media_urls, 1), 0) <= 20");
    expect(followupSql).toContain(
      "(char_length(body) >= 1 or coalesce(array_length(media_urls, 1), 0) > 0)",
    );
  });

  it("backfills legacy markdown image bodies into media_urls", () => {
    expect(followupSql).toContain("regexp_matches(body, '!\\[image\\]\\((.*?)\\)', 'g')");
    expect(followupSql).toContain("regexp_replace(body, '!\\[image\\]\\((.*?)\\)', '', 'g')");
  });
});
