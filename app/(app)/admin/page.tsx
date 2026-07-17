import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { createBoard } from "@/app/(app)/actions";
import { PostComposer } from "@/components/post-composer";
import { ResourceForm } from "@/components/resource-form";
import { RosterManager } from "@/components/roster-manager";
import { timeAgo } from "@/lib/format";
import { currentPhase, phaseProgress, type BoardPhase } from "@/lib/board";
import type { Franchisee } from "@/lib/types";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const franchisee = await getFranchisee();
  if (franchisee.role !== "admin") redirect("/");

  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: topics }, { data: roster }, { data: recentPosts }, { data: allPhases }] =
    await Promise.all([
      supabase.from("topics").select("id, name, status").order("sort_order"),
      supabase
        .from("franchisees")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("posts")
        .select("id, title, body, created_at, reactions(franchisee_id)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("phases")
        .select("id, franchisee_id, name, tag, sort_order, tasks(id, phase_id, title, owner, status, due_date, sort_order)")
        .not("franchisee_id", "is", null)
        .order("sort_order"),
    ]);

  const liveTopics = (topics ?? []).filter((t) => t.status === "live");
  const activeRoster = (roster ?? []).filter((f) => f.status === "active");

  // group phases per franchisee for the locations overview
  const boardsByFranchisee = new Map<string, BoardPhase[]>();
  for (const p of (allPhases ?? []) as unknown as BoardPhase[]) {
    if (!p.franchisee_id) continue;
    const list = boardsByFranchisee.get(p.franchisee_id) ?? [];
    list.push(p);
    boardsByFranchisee.set(p.franchisee_id, list);
  }

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <p className="subtitle">
        Post updates, manage the library, and run the franchisee roster.
      </p>

      {error && (
        <div className="auth-error" style={{ maxWidth: 640 }}>
          Couldn&apos;t save:{" "}
          {error === "missing" ? "required fields are missing." : error}
        </div>
      )}

      <section className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head">
          <h2>Locations</h2>
          <Link href="/admin/boards/template" className="link" style={{ fontSize: 12, color: "var(--dillball)" }}>
            Edit template board
          </Link>
        </div>
        <p className="panel-note">
          Where every location stands — click a card to open its full board.
        </p>
        <div className="loc-grid">
          {activeRoster.map((f) => {
            const board = boardsByFranchisee.get(f.id) ?? [];
            const allTasks = board.flatMap((p) => p.tasks);
            const pct = phaseProgress(allTasks);
            const phase = currentPhase(board);
            return (
              <Link href={`/admin/boards/${f.id}`} className="loc-card" key={f.id}>
                <div className="t">{f.location_name || f.email}</div>
                <div className="m">{phase ? phase.name : "No board yet"}</div>
                <div className="phase-bar">
                  <div className="phase-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="loc-stats">
                  <span>{pct}% complete</span>
                  <span>
                    ⭐ {f.founding_members ?? 0}/{f.founding_goal ?? 100}
                  </span>
                  <span>
                    {f.grand_opening
                      ? `GO ${new Date(f.grand_opening + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}`
                      : "GO tbd"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="cols" style={{ alignItems: "start", marginBottom: 22 }}>
        <section className="panel">
          <div className="panel-head">
            <h2>New post</h2>
          </div>
          <PostComposer topics={liveTopics} />
        </section>

        <div style={{ display: "grid", gap: 22 }}>
          <section className="panel">
            <div className="panel-head">
              <h2>New resource</h2>
            </div>
            <p className="panel-note">
              Link something from Drive or Canva, or upload a file directly.
            </p>
            <ResourceForm topics={liveTopics} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>New board</h2>
            </div>
            <p className="panel-note">
              Boards appear in everyone&apos;s sidebar and collect posts +
              resources on one topic.
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
        </div>
      </div>

      <div className="cols" style={{ alignItems: "start" }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Franchisee roster</h2>
          </div>
          <p className="panel-note">
            The roster is the login allowlist — adding someone here lets them
            sign in. FM = founding members (shows on their dashboard).
          </p>
          <RosterManager roster={(roster ?? []) as Franchisee[]} meId={franchisee.id} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Read tracking</h2>
          </div>
          <p className="panel-note">
            Who has (and hasn&apos;t) confirmed each recent update.
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
                  <strong>
                    {readerIds.size}/{activeRoster.length}
                  </strong>{" "}
                  read
                  {waiting.length > 0 && (
                    <span className="read-waiting">
                      {" "}
                      · waiting on{" "}
                      {waiting
                        .map((f) => f.location_name || f.email)
                        .join(", ")}
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
    </>
  );
}
