import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { createBoard } from "@/app/(app)/actions";
import { PostComposer } from "@/components/post-composer";
import { ResourceForm } from "@/components/resource-form";
import { RosterManager } from "@/components/roster-manager";
import { StatusCalendar, type CalEvent } from "@/components/status-calendar";
import { timeAgo } from "@/lib/format";
import { currentPhase, phaseProgress, type BoardPhase } from "@/lib/board";
import type { Franchisee } from "@/lib/types";

const TABS = [
  ["status", "Location Status"],
  ["post", "Post"],
  ["resource", "Resource"],
  ["board", "Board"],
  ["roster", "Roster"],
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const franchisee = await getFranchisee();
  if (franchisee.role !== "admin") redirect("/");

  const { tab: rawTab, error } = await searchParams;
  const tab = TABS.some(([t]) => t === rawTab) ? rawTab! : "status";
  const supabase = await createClient();

  const calStart = new Date(Date.now() - 62 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const calEnd = new Date(Date.now() + 370 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    { data: topics },
    { data: roster },
    { data: locations },
    { data: recentPosts },
    { data: allPhases },
    { data: dueTasks },
  ] = await Promise.all([
    supabase.from("topics").select("id, name, status").order("sort_order"),
    supabase
      .from("franchisees")
      .select("*, locations(name)")
      .order("created_at", { ascending: true }),
    supabase.from("locations").select("*").order("created_at"),
    tab === "status"
      ? supabase
          .from("posts")
          .select("id, title, body, created_at, reactions(franchisee_id)")
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    tab === "status"
      ? supabase
          .from("phases")
          .select("id, location_id, name, tag, sort_order, tasks(id, phase_id, title, owner, status, due_date, sort_order)")
          .not("location_id", "is", null)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    tab === "status"
      ? supabase
          .from("tasks")
          .select("title, status, due_date, phases!inner(location_id)")
          .not("due_date", "is", null)
          .gte("due_date", calStart)
          .lte("due_date", calEnd)
          .limit(2000)
      : Promise.resolve({ data: [] }),
  ]);

  const liveTopics = (topics ?? []).filter((t) => t.status === "live");
  const activeRoster = (roster ?? []).filter((f) => f.status === "active");
  const locNames = new Map((locations ?? []).map((l) => [l.id, l.name]));

  const boardsByLocation = new Map<string, BoardPhase[]>();
  for (const p of (allPhases ?? []) as unknown as BoardPhase[]) {
    if (!p.location_id) continue;
    const list = boardsByLocation.get(p.location_id) ?? [];
    list.push(p);
    boardsByLocation.set(p.location_id, list);
  }

  const calEvents: CalEvent[] = ((dueTasks ?? []) as unknown as {
    title: string;
    status: string;
    due_date: string;
    phases: { location_id: string | null } | null;
  }[])
    .filter((t) => t.phases?.location_id)
    .map((t) => ({
      date: t.due_date,
      locationId: t.phases!.location_id!,
      locationName: locNames.get(t.phases!.location_id!) ?? "Location",
      title: t.title,
      status: t.status,
    }));

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <p className="subtitle">
        Everything HQ — locations, posts, resources, boards, and the roster.
      </p>

      <div className="home-tabs">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={key === "status" ? "/admin" : `/admin?tab=${key}`}
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

      {tab === "status" && (
        <>
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
              {(locations ?? []).map((loc) => {
                const board = boardsByLocation.get(loc.id) ?? [];
                const allTasks = board.flatMap((p) => p.tasks);
                const pct = phaseProgress(allTasks);
                const phase = currentPhase(board);
                const members = activeRoster.filter((f) => f.location_id === loc.id);
                return (
                  <Link href={`/admin/boards/${loc.id}`} className="loc-card" key={loc.id}>
                    <div className="t">{loc.name}</div>
                    <div className="m">
                      {phase ? phase.name : "No board yet"} · {members.length}{" "}
                      member{members.length === 1 ? "" : "s"}
                    </div>
                    <div className="phase-bar">
                      <div className="phase-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="loc-stats">
                      <span>{pct}% complete</span>
                      <span>⭐ {loc.founding_members ?? 0}/{loc.founding_goal ?? 100}</span>
                      <span>
                        {loc.grand_opening
                          ? `GO ${new Date(loc.grand_opening + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}`
                          : "GO tbd"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="panel" style={{ marginBottom: 22 }}>
            <div className="panel-head">
              <h2>Due dates</h2>
            </div>
            <p className="panel-note">
              Every dated task across every location — hover a chip for the
              details. Colors are per location.
            </p>
            <StatusCalendar events={calEvents} />
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
        </>
      )}

      {tab === "post" && (
        <section className="panel" style={{ maxWidth: 640 }}>
          <div className="panel-head">
            <h2>New post</h2>
          </div>
          <PostComposer topics={liveTopics} />
        </section>
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
        <div className="cols" style={{ alignItems: "start" }}>
          <section className="panel">
            <div className="panel-head">
              <h2>Template board</h2>
            </div>
            <p className="panel-note">
              Every new location starts with a copy of the template — phases,
              tasks, and the 6-month marketing plan.
            </p>
            <Link href="/admin/boards/template" className="btn" style={{ textDecoration: "none", display: "inline-block" }}>
              Edit template board
            </Link>
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
      )}

      {tab === "roster" && (
        <section className="panel" style={{ maxWidth: 760 }}>
          <div className="panel-head">
            <h2>Franchisee roster</h2>
          </div>
          <p className="panel-note">
            The roster is the login allowlist. Adding a location creates its
            board and its manager — managers invite their own team from their
            Team page.
          </p>
          <RosterManager roster={(roster ?? []) as Franchisee[]} meId={franchisee.id} />
        </section>
      )}
    </>
  );
}
