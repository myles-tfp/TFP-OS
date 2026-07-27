import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Feed, type FeedPost } from "@/components/feed";
import { BoardEditor } from "@/components/board-editor";
import { BoardMeta } from "@/components/board-meta";
import { StatusCalendar, type CalEvent } from "@/components/status-calendar";
import { timeAgo } from "@/lib/format";
import { currentPhase, phaseProgress, type BoardPhase } from "@/lib/board";
import type { Franchisee, Location } from "@/lib/types";

const TABS = [
  ["overview", "Overview"],
  ["checklists", "Location Checklists"],
  ["preview", "Franchisee View"],
] as const;

/** HQ home: the state of the whole franchise at a glance. */
export async function HqHome({
  franchisee,
  tab: rawTab,
  loc: selectedLoc,
}: {
  franchisee: Franchisee;
  tab?: string;
  loc?: string;
}) {
  const tab = TABS.some(([t]) => t === rawTab) ? rawTab! : "overview";
  const supabase = await createClient();

  const calStart = new Date(Date.now() - 62 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const calEnd = new Date(Date.now() + 370 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    { data: locations },
    { data: allPhases },
    { data: dueTasks },
    { data: posts },
    { data: roster },
    { data: rosterCount },
  ] = await Promise.all([
    supabase.from("locations").select("*").order("name"),
    supabase
      .from("phases")
      .select("id, location_id, name, tag, sort_order, tasks(id, phase_id, title, owner, status, due_date, sort_order)")
      .not("location_id", "is", null)
      .order("sort_order"),
    tab === "overview"
      ? supabase
          .from("tasks")
          .select("title, status, due_date, phases!inner(location_id)")
          .not("due_date", "is", null)
          .gte("due_date", calStart)
          .lte("due_date", calEnd)
          .limit(2000)
      : Promise.resolve({ data: [] }),
    supabase
      .from("posts")
      .select(
        "id, title, body, media_url, media_type, requires_action, created_at, topics(name), reactions(franchisee_id, emoji, franchisees(location_name, email))"
      )
      .order("created_at", { ascending: false })
      .limit(tab === "preview" ? 30 : 8),
    supabase.from("franchisees").select("*, locations(name)").eq("status", "active"),
    supabase.rpc("roster_count"),
  ]);

  const locs = (locations ?? []) as Location[];
  const locNames = new Map(locs.map((l) => [l.id, l.name]));

  const boardsByLocation = new Map<string, BoardPhase[]>();
  for (const p of (allPhases ?? []) as unknown as BoardPhase[]) {
    if (!p.location_id) continue;
    const list = boardsByLocation.get(p.location_id) ?? [];
    list.push({ ...p, tasks: [...p.tasks].sort((a, b) => a.sort_order - b.sort_order) });
    boardsByLocation.set(p.location_id, list);
  }

  // ---- distributions for the graphs ----
  type Dist = { name: string; order: number; locations: string[] };
  const phaseDist = new Map<string, Dist>();
  const monthDist = new Map<string, Dist>();
  const OPERATING = "Club Operating";

  for (const loc of locs) {
    const board = boardsByLocation.get(loc.id) ?? [];
    const official = board.filter((p) => p.tag !== "marketing" && p.tasks.length > 0);
    const operating =
      official.length > 0 &&
      official.every((p) => p.tasks.every((t) => t.status === "done"));
    const cur = operating ? null : currentPhase(official);
    const key = operating ? OPERATING : cur ? cur.name : "No checklist yet";
    const order = operating ? 9999 : cur ? cur.sort_order : -1;
    const d = phaseDist.get(key) ?? { name: key, order, locations: [] };
    d.locations.push(loc.name);
    phaseDist.set(key, d);

    const marketing = board.filter((p) => p.tag === "marketing" && p.tasks.length > 0);
    if (marketing.length > 0) {
      const allDone = marketing.every((p) => p.tasks.every((t) => t.status === "done"));
      const m = allDone ? null : currentPhase(marketing);
      const mKey = allDone ? "Plan complete" : m ? m.name.split("—")[0].trim() : "—";
      const mOrder = allDone ? 9999 : m ? m.sort_order : -1;
      const md = monthDist.get(mKey) ?? { name: mKey, order: mOrder, locations: [] };
      md.locations.push(loc.name);
      monthDist.set(mKey, md);
    }
  }

  const distBars = (dist: Map<string, Dist>) => {
    const rows = [...dist.values()].sort((a, b) => a.order - b.order);
    const max = Math.max(1, ...rows.map((r) => r.locations.length));
    return rows.map((r) => (
      <div className="hq-bar" key={r.name} title={r.locations.join(", ")}>
        <span className="hq-bar-label">{r.name.split("—")[0].trim()}</span>
        <div className="hq-bar-track">
          <div
            className="hq-bar-fill"
            style={{ width: `${(r.locations.length / max) * 100}%` }}
          />
        </div>
        <span className="hq-bar-n">{r.locations.length}</span>
      </div>
    ));
  };

  const founders = [...locs].sort(
    (a, b) =>
      (b.founding_members ?? 0) / (b.founding_goal || 100) -
      (a.founding_members ?? 0) / (a.founding_goal || 100)
  );

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

  const activeRoster = (roster ?? []) as Franchisee[];
  const allPosts = (posts ?? []) as unknown as FeedPost[];

  const selected = selectedLoc ? locs.find((l) => l.id === selectedLoc) : null;
  const selectedBoard = selected ? (boardsByLocation.get(selected.id) ?? []) : [];

  // preview: HQ's own board data stands in for a franchisee's
  const myBoard = franchisee.location_id
    ? (boardsByLocation.get(franchisee.location_id) ?? [])
    : [];
  const pOfficial = myBoard.filter((p) => p.tag !== "marketing" && p.tasks.length > 0);
  const pPhase = currentPhase(pOfficial);
  const pMarketing = myBoard.filter((p) => p.tag === "marketing" && p.tasks.length > 0);
  const pMonth = currentPhase(pMarketing);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <div className="page-head">
        <h1>Welcome back, TFP HQ</h1>
        <span className="date">{today}</span>
      </div>
      <p className="subtitle">
        The whole franchise at a glance — phases, marketing plans, founders,
        and every location&apos;s checklist.
      </p>

      <div className="home-tabs">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={key === "overview" ? "/" : `/?tab=${key}`}
            className={`tab${tab === key ? " on" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="cols" style={{ marginBottom: 22 }}>
            <section className="panel">
              <div className="panel-head">
                <h2>Locations by phase</h2>
              </div>
              <p className="panel-note">
                Hover a bar to see which locations are in it.
              </p>
              {phaseDist.size === 0 ? (
                <p className="panel-note">No location checklists yet.</p>
              ) : (
                distBars(phaseDist)
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>6-Mo marketing plan</h2>
              </div>
              <p className="panel-note">Which month each location is working.</p>
              {monthDist.size === 0 ? (
                <p className="panel-note">No marketing plans in motion yet.</p>
              ) : (
                distBars(monthDist)
              )}
            </section>
          </div>

          <section className="panel" style={{ marginBottom: 22 }}>
            <div className="panel-head">
              <h2>Founding members</h2>
            </div>
            <div className="hq-founders">
              {founders.map((l) => {
                const pct = Math.min(
                  100,
                  Math.round(((l.founding_members ?? 0) / (l.founding_goal || 100)) * 100)
                );
                return (
                  <div className="hq-bar" key={l.id}>
                    <span className="hq-bar-label">{l.name}</span>
                    <div className="hq-bar-track">
                      <div className="hq-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="hq-bar-n">
                      {l.founding_members ?? 0}/{l.founding_goal ?? 100}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel" style={{ marginBottom: 22 }}>
            <div className="panel-head">
              <h2>Due dates</h2>
            </div>
            <StatusCalendar events={calEvents} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Read tracking</h2>
            </div>
            {allPosts.slice(0, 8).map((p) => {
              const readerIds = new Set(p.reactions.map((r) => r.franchisee_id));
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
            {allPosts.length === 0 && <p className="panel-note">No posts yet.</p>}
          </section>
        </>
      )}

      {tab === "checklists" && (
        <>
          <section className="panel" style={{ marginBottom: 22 }}>
            <div className="panel-head">
              <h2>Locations</h2>
              <Link href="/admin/boards/template" className="link" style={{ fontSize: 12, color: "var(--dillball)" }}>
                Edit Checklist Template
              </Link>
            </div>
            <p className="panel-note">
              Click a location to open its checklist right here.
            </p>
            <div className="loc-grid">
              {locs.map((loc) => {
                const board = boardsByLocation.get(loc.id) ?? [];
                const allTasks = board.flatMap((p) => p.tasks);
                const pct = phaseProgress(allTasks);
                const phase = currentPhase(board);
                const members = activeRoster.filter((f) => f.location_id === loc.id);
                return (
                  <Link
                    href={`/?tab=checklists&loc=${loc.id}`}
                    className={`loc-card${selected?.id === loc.id ? " on" : ""}`}
                    key={loc.id}
                  >
                    <div className="t">{loc.name}</div>
                    <div className="m">
                      {phase ? phase.name : "No checklist yet"} · {members.length}{" "}
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

          {selected && (
            <section className="panel" id="loc-board">
              <div className="panel-head">
                <h2>{selected.name}</h2>
                <Link href="/?tab=checklists" className="link" style={{ fontSize: 12, color: "var(--backcourt)" }}>
                  Close
                </Link>
              </div>
              <BoardMeta location={selected} />
              {selectedBoard.length === 0 ? (
                <p className="panel-note">No checklist yet for this location.</p>
              ) : (
                <BoardEditor phases={selectedBoard} locationId={selected.id} adminMode />
              )}
            </section>
          )}
        </>
      )}

      {tab === "preview" && (
        <>
          <div className="banner" style={{ marginBottom: 22 }}>
            <div>
              <h3>Franchisee view — read-only preview</h3>
              <p>
                This is the home page as a franchisee sees it (using TFP HQ&apos;s
                own data as the stand-in). Interactions are disabled here.
              </p>
            </div>
          </div>

          <div className="preview-lock">
            <section className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="stat accent">
                <div className="k">Your phase</div>
                <div className="v" style={{ fontSize: 28 }}>
                  {pPhase ? pPhase.name.split("—")[0].trim() : "Phase 1"}
                </div>
                <div className="sub">grand opening date TBD</div>
              </div>
              <div className="stat">
                <div className="k">6-Mo marketing plan</div>
                <div className="v" style={{ fontSize: 28 }}>
                  {pMonth ? pMonth.name.split("—")[0].trim() : "Month 1"}
                </div>
                <div className="phase-bar" style={{ maxWidth: "none", margin: "8px 0 4px" }}>
                  <div
                    className="phase-bar-fill"
                    style={{ width: `${pMonth ? phaseProgress(pMonth.tasks) : 0}%` }}
                  />
                </div>
                <div className="sub">progress this month</div>
              </div>
              <div className="stat">
                <div className="k">Founding members</div>
                <div className="v">{franchisee.locations?.founding_members ?? "—"}</div>
                <div className="sub">goal: {franchisee.locations?.founding_goal ?? 100} by launch</div>
              </div>
            </section>

            <div className="cols">
              <section className="panel">
                <div className="panel-head">
                  <h2>Announcements</h2>
                </div>
                <p className="panel-note">
                  React to confirm you&apos;ve read each update — we track reads
                  by reaction.
                </p>
                <div className="feed-scroll">
                  <Feed
                    posts={allPosts}
                    meId={franchisee.id}
                    isAdmin={false}
                    savedPostIds={[]}
                    rosterCount={rosterCount ?? 1}
                  />
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Notes</h2>
                </div>
                <p className="panel-note">
                  Each member&apos;s private scratchpad lives here — notes with
                  checkboxes, photos, and videos only they can see.
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
