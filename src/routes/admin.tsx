import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Ban, BarChart3, CheckCircle2, EyeOff, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { Avatar } from "@/components/pulse/avatar";
import { Button } from "@/components/ui/button";
import {
  fetchAdminDashboard,
  moderateAdminPost,
  resolveModerationReport,
  setModerationRole,
  setUserRestriction,
  type AdminDashboard,
  type AdminPermission,
  type AdminPost,
  type AdminReport,
  type AdminUser,
} from "@/lib/social-api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Pulse" },
      {
        name: "description",
        content: "Pulse moderation, role management, analytics, reports, and audit tools.",
      },
    ],
  }),
  component: AdminPage,
});

const permissionLabels: Record<AdminPermission, string> = {
  view_admin: "View admin",
  moderate_content: "Moderate content",
  manage_reports: "Manage reports",
  manage_users: "Manage users",
  manage_roles: "Manage roles",
  view_analytics: "Analytics",
};

const permissionOrder = Object.keys(permissionLabels) as AdminPermission[];

function AdminPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "queue" | "users" | "audit">("overview");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setDashboard(await fetchAdminDashboard());
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : "Admin dashboard unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const can = useMemo(() => {
    const permissions = dashboard?.access.permissions ?? [];
    return {
      moderateContent:
        dashboard?.access.role === "admin" || permissions.includes("moderate_content"),
      manageReports: dashboard?.access.role === "admin" || permissions.includes("manage_reports"),
      manageUsers: dashboard?.access.role === "admin" || permissions.includes("manage_users"),
      manageRoles: dashboard?.access.role === "admin" || permissions.includes("manage_roles"),
      viewAnalytics: dashboard?.access.role === "admin" || permissions.includes("view_analytics"),
    };
  }, [dashboard]);

  return (
    <AppShell>
      <TopBar title="Admin" subtitle="Moderation, roles, safety operations, and analytics" />

      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="grid grid-cols-4 rounded-lg border border-border bg-surface text-sm font-semibold">
          {(
            [
              ["overview", "Overview"],
              ["queue", "Queue"],
              ["users", "Users"],
              ["audit", "Audit"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`min-w-0 px-2 py-3 transition-colors ${
                tab === key ? "bg-surface-2 text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <StateMessage
          title="Loading admin data"
          body="Checking access and gathering live metrics."
        />
      ) : error ? (
        <StateMessage
          title="Admin access required"
          body={error}
          action={
            <Button asChild className="rounded-full">
              <Link to="/auth">Sign in</Link>
            </Button>
          }
        />
      ) : dashboard ? (
        <div className="space-y-6 px-4 py-5 sm:px-6">
          <AccessBanner dashboard={dashboard} />
          {tab === "overview" && <Overview dashboard={dashboard} canView={can.viewAnalytics} />}
          {tab === "queue" && (
            <ModerationQueue
              reports={dashboard.reports}
              posts={dashboard.posts}
              canModerate={can.moderateContent}
              canResolve={can.manageReports}
              onChanged={load}
            />
          )}
          {tab === "users" && (
            <UsersPanel
              users={dashboard.users}
              canManageUsers={can.manageUsers}
              canManageRoles={can.manageRoles}
              onChanged={load}
            />
          )}
          {tab === "audit" && <AuditPanel dashboard={dashboard} />}
        </div>
      ) : null}
    </AppShell>
  );
}

function AccessBanner({ dashboard }: { dashboard: AdminDashboard }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold capitalize">{dashboard.access.role} tools</p>
          <p className="text-sm text-muted-foreground">
            {dashboard.access.permissions.length
              ? dashboard.access.permissions.map((p) => permissionLabels[p]).join(", ")
              : "No admin permissions granted."}
          </p>
        </div>
        <ShieldCheck className="size-8 text-signal" />
      </div>
    </section>
  );
}

function Overview({ dashboard, canView }: { dashboard: AdminDashboard; canView: boolean }) {
  if (!canView) {
    return <StateMessage title="Analytics locked" body="Analytics permission is required." />;
  }

  const totals = dashboard.analytics.totals;
  const last24h = dashboard.analytics.last24h;
  const metrics = [
    ["Users", totals["users"], last24h["newUsers"]],
    ["Posts", totals["posts"], last24h["posts"]],
    ["Replies", totals["replies"], last24h["replies"]],
    ["Messages", totals["messages"], last24h["messages"]],
    ["Open reports", totals["reportsOpen"], last24h["reports"]],
    ["Restricted", totals["restrictedUsers"], 0],
  ] as const;
  const maxDaily = Math.max(
    1,
    ...dashboard.analytics.dailyActivity.map(
      (day) => day.posts + day.replies + day.messages + day.reports,
    ),
  );

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, total, recent]) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl font-black">{total ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">{recent ?? 0} in the last 24h</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="size-5 text-signal" />
          <h2 className="font-display text-lg font-bold">14 day activity</h2>
        </div>
        <div className="grid h-72 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1 border-b border-l border-border px-2 pt-4">
          {dashboard.analytics.dailyActivity.map((day) => {
            const total = day.posts + day.replies + day.messages + day.reports;
            return (
              <div key={day.day} className="flex h-full min-w-0 flex-col justify-end gap-1">
                <div
                  title={`${day.day}: ${total} events`}
                  className="flex min-h-1 w-full flex-col justify-end overflow-hidden rounded-t bg-surface-2"
                  style={{ height: `${Math.max(4, (total / maxDaily) * 100)}%` }}
                >
                  <span
                    className="block bg-[#e85d35]"
                    style={{ height: `${total ? (day.posts / total) * 100 : 0}%` }}
                  />
                  <span
                    className="block bg-[#2f80ed]"
                    style={{ height: `${total ? (day.replies / total) * 100 : 0}%` }}
                  />
                  <span
                    className="block bg-[#16a34a]"
                    style={{ height: `${total ? (day.messages / total) * 100 : 0}%` }}
                  />
                  <span
                    className="block bg-[#9333ea]"
                    style={{ height: `${total ? (day.reports / total) * 100 : 0}%` }}
                  />
                </div>
                <span className="truncate text-center text-[10px] text-muted-foreground">
                  {day.day}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Legend color="#e85d35" label="Posts" />
          <Legend color="#2f80ed" label="Replies" />
          <Legend color="#16a34a" label="Messages" />
          <Legend color="#9333ea" label="Reports" />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <PanelHeader icon={BarChart3} title="High engagement posts" />
        <div className="divide-y divide-border">
          {dashboard.analytics.topPosts.map((post) => (
            <div key={post.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold">
                  @{post.author_handle ?? "member"} · {post.status}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {post.sparks} sparks · {post.echoes} echoes · {post.replies} replies
              </p>
            </div>
          ))}
          {dashboard.analytics.topPosts.length === 0 && (
            <EmptyRow text="High engagement posts appear after live data is available." />
          )}
        </div>
      </section>
    </>
  );
}

function ModerationQueue({
  reports,
  posts,
  canModerate,
  canResolve,
  onChanged,
}: {
  reports: AdminReport[];
  posts: AdminPost[];
  canModerate: boolean;
  canResolve: boolean;
  onChanged: () => Promise<void>;
}) {
  return (
    <>
      <section className="rounded-lg border border-border bg-surface">
        <PanelHeader icon={CheckCircle2} title="Reports" />
        <div className="divide-y divide-border">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              disabled={!canResolve}
              onChanged={onChanged}
            />
          ))}
          {reports.length === 0 && <EmptyRow text="No reports are waiting for review." />}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <PanelHeader icon={EyeOff} title="Recent posts" />
        <div className="divide-y divide-border">
          {posts.map((post) => (
            <PostModerationRow
              key={post.id}
              post={post}
              disabled={!canModerate}
              onChanged={onChanged}
            />
          ))}
          {posts.length === 0 && <EmptyRow text="Posts appear here after Supabase data loads." />}
        </div>
      </section>
    </>
  );
}

function ReportRow({
  report,
  disabled,
  onChanged,
}: {
  report: AdminReport;
  disabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function resolve(status: "actioned" | "dismissed") {
    setBusy(true);
    try {
      await resolveModerationReport(
        report.id,
        status,
        status === "actioned" ? "Action taken" : "Dismissed",
      );
      toast.success("Report updated");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <p className="font-display text-sm font-bold">
          {report.target_type} · {report.status}
        </p>
        <p className="mt-1 break-words text-sm">{report.reason}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Reported by @{report.reporter?.handle ?? "unknown"} ·{" "}
          {new Date(report.created_at).toLocaleString()}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || busy || report.status !== "pending"}
          onClick={() => void resolve("dismissed")}
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          disabled={disabled || busy || report.status !== "pending"}
          onClick={() => void resolve("actioned")}
        >
          Mark actioned
        </Button>
      </div>
    </div>
  );
}

function PostModerationRow({
  post,
  disabled,
  onChanged,
}: {
  post: AdminPost;
  disabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function act(action: "hide" | "remove" | "restore") {
    setBusy(true);
    try {
      await moderateAdminPost(post.id, action, `${action} from admin queue`);
      toast.success("Post moderation updated");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not moderate post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Avatar initials={post.author.initials} className="size-8" />
          <p className="truncate font-display text-sm font-bold">
            @{post.author.handle} · {post.moderation_status}
          </p>
        </div>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
          {post.body || "Media post"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || busy || post.moderation_status === "hidden"}
          onClick={() => void act("hide")}
        >
          Hide
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={disabled || busy || post.moderation_status === "removed"}
          onClick={() => void act("remove")}
        >
          Remove
        </Button>
        <Button
          size="sm"
          disabled={disabled || busy || post.moderation_status === "visible"}
          onClick={() => void act("restore")}
        >
          Restore
        </Button>
      </div>
    </div>
  );
}

function UsersPanel({
  users,
  canManageUsers,
  canManageRoles,
  onChanged,
}: {
  users: AdminUser[];
  canManageUsers: boolean;
  canManageRoles: boolean;
  onChanged: () => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <PanelHeader icon={UserCog} title="Users and moderator abilities" />
      <div className="divide-y divide-border">
        {users.map((user) => (
          <UserAdminRow
            key={user.id}
            user={user}
            canManageUsers={canManageUsers}
            canManageRoles={canManageRoles}
            onChanged={onChanged}
          />
        ))}
        {users.length === 0 && <EmptyRow text="Users appear after profiles exist." />}
      </div>
    </section>
  );
}

function UserAdminRow({
  user,
  canManageUsers,
  canManageRoles,
  onChanged,
}: {
  user: AdminUser;
  canManageUsers: boolean;
  canManageRoles: boolean;
  onChanged: () => Promise<void>;
}) {
  const [role, setRole] = useState<"admin" | "moderator" | "none">(
    user.role === "member" ? "none" : user.role,
  );
  const [permissions, setPermissions] = useState<AdminPermission[]>(user.permissions);
  const [restriction, setRestriction] = useState<"active" | "suspended" | "banned">(
    user.restriction?.status ?? "active",
  );
  const [busy, setBusy] = useState(false);

  function togglePermission(permission: AdminPermission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  async function saveRole() {
    setBusy(true);
    try {
      await setModerationRole(
        user.id,
        role,
        role === "admin" ? permissionOrder : permissions,
        "Admin panel update",
      );
      toast.success("Moderator abilities updated");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update role");
    } finally {
      setBusy(false);
    }
  }

  async function saveRestriction() {
    setBusy(true);
    try {
      await setUserRestriction(
        user.id,
        restriction,
        restriction === "active" ? "" : "Admin panel restriction",
      );
      toast.success("User restriction updated");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update restriction");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <Avatar initials={user.initials} className="size-10" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold">{user.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{user.handle} · {user.role}
              {user.restriction ? ` · ${user.restriction.status}` : ""}
            </p>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {user.bio || "No bio yet."}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Role for ${user.handle}`}
            value={role}
            disabled={!canManageRoles || busy}
            onChange={(event) => setRole(event.target.value as "admin" | "moderator" | "none")}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="none">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
          <Button size="sm" disabled={!canManageRoles || busy} onClick={() => void saveRole()}>
            Save role
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {permissionOrder.map((permission) => (
            <label
              key={permission}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <input
                type="checkbox"
                checked={role === "admin" || permissions.includes(permission)}
                disabled={!canManageRoles || role === "admin" || busy}
                onChange={() => togglePermission(permission)}
              />
              {permissionLabels[permission]}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Restriction for ${user.handle}`}
            value={restriction}
            disabled={!canManageUsers || busy}
            onChange={(event) =>
              setRestriction(event.target.value as "active" | "suspended" | "banned")
            }
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <Button
            variant={restriction === "active" ? "secondary" : "destructive"}
            size="sm"
            disabled={!canManageUsers || busy}
            onClick={() => void saveRestriction()}
          >
            Update access
          </Button>
        </div>
      </div>
    </div>
  );
}

function AuditPanel({ dashboard }: { dashboard: AdminDashboard }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <PanelHeader icon={Ban} title="Moderation audit log" />
      <div className="divide-y divide-border">
        {dashboard.actions.map((action) => (
          <div key={action.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="font-display text-sm font-bold">
                {action.action_type.replaceAll("_", " ")} · {action.target_type}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                By @{action.moderator?.handle ?? "system"} against{" "}
                {action.target?.handle ? `@${action.target.handle}` : action.target_id}
              </p>
              {action.reason ? <p className="mt-1 break-words text-sm">{action.reason}</p> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(action.created_at).toLocaleString()}
            </p>
          </div>
        ))}
        {dashboard.actions.length === 0 && <EmptyRow text="Audit entries appear after actions." />}
      </div>
    </section>
  );
}

function PanelHeader({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border p-4">
      <Icon className="size-5 text-signal" />
      <h2 className="font-display text-lg font-bold">{title}</h2>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="p-4 text-sm text-muted-foreground">{text}</p>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function StateMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-16 text-center sm:px-6">
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
