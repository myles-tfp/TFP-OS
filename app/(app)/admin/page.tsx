import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee, isAdminRole } from "@/lib/get-franchisee";
import { createBoard } from "@/app/(app)/actions";
import { PostComposer } from "@/components/post-composer";
import { ResourceForm } from "@/components/resource-form";
import { RosterManager } from "@/components/roster-manager";
import { timeAgo } from "@/lib/format";
import type { Franchisee } from "@/lib/types";

const TABS = [
  ["post", "Post"],
  ["resource", "Resource"],
  ["board", "Board"],
  ["checklist", "Checklist"],
  ["roster", "Roster"],
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const franchisee = await getFranchisee();
  if (!isAdminRole(franchisee)) redirect("/");

  const { tab: rawTab, error } = await searchParams;
  const tab = TABS.some(([t]) => t === rawTab) ? rawTab! : "post";
  const supabase = await createClient();

  const [{ data: topics }, { data: roster }, { data: locations }, { data: recentPosts }] =
    await Promise.all([
      supabase.from("topics").select("id, name, status").order("sort_order"),
      supabase
        .from("franchisees")
        .select("*, locations(name)")
        .order("created_at", { ascending: true }),
      supabase.from("locations").select("id, name").order("name"),
      tab === "post"
        ? supabase
            .from("posts")
            .select("id, title, body, created_at, reactions(franchisee_id)")
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] }),
    ]);

  const liveTopics = (topics ?? []).filter((t) => t.status === "live");
  const activeRoster = (roster ?? []).filter((f) => f.status === "active");

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <p className="subtitle">
        Publish and manage — location status lives on your Home overview now.
      </p>

      <div className="home-tabs">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={key === "post" ? "/admin" : `/admin?tab=${key}`}
            className={`tab${tab === key ? " on" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="auth-error" style={{ maxWidth: 640 }}>
          Couldn&apos;t save:{" "}
          {error === "missing" ? "required fields are missing." : error}
        </div>
      )}

      {tab === "post" && (
        <div className="cols" style={{ alignItems: "start" }}>
          <section className="panel">
            <div className="panel-head">
              <h2>New post</h2>
            </div>
            <PostComposer topics={liveTopics} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Read tracking</h2>
            </div>
            <p className="panel-note">
              Who has (and hasn&apos;t) confirmed each recent announcement.
            </p>
            {(recentPosts ?? []).map((p) => {
              const readerIds = new Set(
                (p.reactions ?? []).map((r: { franchisee_id: string }) => r.franchisee_id)
              );
              const waiting = activeRoster.filter((f) => !readerIds.has(f.id));
              return (
                <div className="read-row" key={p.id}>
                  <div className="read-title">
                    {p.title || p.body.slice(0, 60)}
                    <span className="read-when"> · {timeAgo(p.created_at)}</span>
                  </div>
                  <div className="read-stat">
                    <strong>{readerIds.size}/{activeRoster.length}</strong> read
                    {waiting.length > 0 && (
                      <span className="read-waiting">
                        {" "}· waiting on{" "}
                        {waiting.map((f) => f.locations?.name || f.email).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {(recentPosts ?? []).length === 0 && (
              <p className="panel-note">No posts yet.</p>
            )}
          </section>
        </div>
      )}

      {tab === "resource" && (
        <section className="panel" style={{ maxWidth: 640 }}>
          <div className="panel-head">
            <h2>New resource</h2>
          </div>
          <p className="panel-note">
            Link something from Drive or Canva, or upload a file directly.
          </p>
          <ResourceForm topics={liveTopics} />
        </section>
      )}

      {tab === "board" && (
        <section className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-head">
            <h2>New board</h2>
          </div>
          <p className="panel-note">
            Boards appear in everyone&apos;s sidebar and hold a how-to
            description plus resources for one topic.
          </p>
          <form action={createBoard}>
            <div className="field">
              <label htmlFor="b-name">Name</label>
              <input id="b-name" name="name" type="text" required placeholder="Training" />
            </div>
            <label className="check" style={{ marginBottom: 14 }}>
              <input type="checkbox" name="coming_soon" />
              Grayed out for now (&quot;coming soon&quot;)
            </label>
            <button type="submit" className="btn ghost">
              Add board
            </button>
          </form>
        </section>
      )}

      {tab === "checklist" && (
        <section className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-head">
            <h2>Checklist Template</h2>
          </div>
          <p className="panel-note">
            Every new location starts with a copy of this checklist — the
            official phases plus the 6-month marketing plan. Editing it only
            affects future locations. Individual location checklists live on
            your Home → Location Checklists tab.
          </p>
          <Link href="/admin/boards/template" className="btn" style={{ textDecoration: "none", display: "inline-block" }}>
            Edit Checklist Template
          </Link>
        </section>
      )}

      {tab === "roster" && (
        <section className="panel" style={{ maxWidth: 760 }}>
          <div className="panel-head">
            <h2>Franchisee roster</h2>
          </div>
          <p className="panel-note">
            The roster is the login allowlist. Pick &quot;New location&quot; to
            create a checklist + manager together, or pick an existing
            checklist to attach a manager to it (the kickoff flow). The
            location dropdown on each row moves a member to another location.
          </p>
          <RosterManager
            roster={(roster ?? []) as Franchisee[]}
            meId={franchisee.id}
            locations={locations ?? []}
          />
        </section>
      )}
    </>
  );
}
