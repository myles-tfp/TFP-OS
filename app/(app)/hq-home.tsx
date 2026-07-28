import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Feed, type FeedPost } from "@/components/feed";
import { BoardEditor } from "@/components/board-editor";
import { BoardMeta } from "@/components/board-meta";
import { StatusCalendar, type CalEvent } from "@/components/status-calendar";
import { ColumnChart, FoundersTimeline, type ColumnDatum } from "@/components/hq-charts";
import { CreateChecklist } from "@/components/create-checklist";
import { LocGrid } from "@/components/loc-grid";
import { NotesBoard, type Note } from "@/components/notes-board";
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
    { data: snapshots },
    { data: notes },
    { data: mySaves },
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
        "id, title, body, media_url, media_type, requires_action, created_at, topics(name), reactions(franchisee_id, emoji, franchisees(location_name, email, locations(name)))"
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("franchisees").select("*, locations(name)").eq("status", "active"),
    tab === "overview"
      ? supabase
          .from("founders_snapshots")
          .select("location_id, day, members")
          .gte("day", new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10))
          .order("day")
      : Promise.resolve({ data: [] }),
    tab === "overview"
      ? supabase.from("notes").select("*").order("created_at")
      : Promise.resolve({ data: [] }),
    supabase.from("saves").select("post_id"),
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

  // ---- column charts: x = locations, y = phase / marketing month ----
  const phaseNameOrder = new Map<string, number>();
  const monthNameOrder = new Map<string, number>();
  for (const board of boardsByLocation.values()) {
    for (const p of board) {
      if (p.tasks.length === 0) continue;
      const short = p.name.split("—")[0].trim();
      if (p.tag === "marketing") {
        if (!monthNameOrder.has(short)) monthNameOrder.set(short, p.sort_order);
      } else if (!phaseNameOrder.has(short)) {
        phaseNameOrder.set(short, p.sort_order);
      }
    }
  }
  const phaseSteps = [
    "Not started",
    ...[...phaseNameOrder.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n),
    "Club Operating",
  ];
  const monthSteps = [
    ...[...monthNameOrder.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n),
    "Complete",
  ];

  const phaseData: ColumnDatum[] = [];
  const monthData: ColumnDatum[] = [];
  for (const loc of locs) {
    const board = boardsByLocation.get(loc.id) ?? [];
    const official = board.filter((p) => p.tag !== "marketing" && p.tasks.length > 0);
    const operating =
      official.length > 0 &&
      official.every((p) => p.tasks.every((t) => t.status === "done"));
    const cur = operating ? null : currentPhase(official);
    const label = operating
      ? "Club Operating"
      : cur
        ? cur.name.split("—")[0].trim()
        : "Not started";
    phaseData.push({
      locationId: loc.id,
      locationName: loc.name,
      step: Math.max(0, phaseSteps.indexOf(label)),
      label: operating ? "Club Operating" : cur ? cur.name : "Not started",
    });

    const marketing = board.filter((p) => p.tag === "marketing" && p.tasks.length > 0);
    if (marketing.length > 0) {
      const allDone = marketing.every((p) => p.tasks.every((t) => t.status === "done"));
      const m = allDone ? null : currentPhase(marketing);
      const mLabel = allDone ? "Complete" : m ? m.name.split("—")[0].trim() : monthSteps[0];
      monthData.push({
        locationId: loc.id,
        locationName: loc.name,
        step: Math.max(0, monthSteps.indexOf(mLabel)),
        label: allDone ? "Plan complete" : m ? m.name : mLabel,
      });
    }
  }

  // founders history: one series per location
  const foundersSeries = locs
    .map((l) => ({
      id: l.id,
      name: l.name,
      points: ((snapshots ?? []) as { location_id: string; day: string; members: number }[])
        .filter((s) => s.location_id === l.id)
        .map((s) => ({ day: s.day, members: s.members })),
    }))
    .filter((s) => s.points.length > 0);

  const activeRosterForRead = ((roster ?? []) as Franchisee[]).map((f) => ({
    id: f.id,
    name: f.locations?.name || f.display_name || f.email,
  }));
  const savedPostIds = ((mySaves ?? []) as { post_id: string | null }[])
    .map((s) => s.post_id)
    .filter(Boolean) as string[];

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
                Each column is a location — hover for details. Scrolls sideways.
              </p>
              {phaseData.length === 0 ? (
                <p className="panel-note">No location checklists yet.</p>
              ) : (
                <ColumnChart steps={phaseSteps} data={phaseData} />
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>6-Mo marketing plan</h2>
              </div>
              <p className="panel-note">Which month each location is working.</p>
              {monthData.length === 0 ? (
                <p className="panel-note">No marketing plans in motion yet.</p>
              ) : (
                <ColumnChart steps={monthSteps} data={monthData} />
              )}
            </section>
          </div>

          <section className="panel" style={{ marginBottom: 22 }}>
            <div className="panel-head">
              <h2>Founding members</h2>
            </div>
            <p className="panel-note">
              One line per location, one point per day — plateaus mean the
              marketing push has stalled. History records daily from here on
              (PlayByPoint will feed this automatically later).
            </p>
            {foundersSeries.length === 0 ? (
              <p className="panel-note">
                No history yet — run the 0017 script and today becomes day one.
              </p>
            ) : (
              <FoundersTimeline series={foundersSeries} />
            )}
          </section>

          <div className="cols" style={{ marginBottom: 22 }}>
            <section className="panel">
              <div className="panel-head">
                <h2>Announcements</h2>
              </div>
              <p className="panel-note">
                Hover the x/y chip on a post to see who hasn&apos;t read it.
              </p>
              <div className="feed-scroll">
                <Feed
                  posts={allPosts}
                  meId={franchisee.id}
                  isAdmin
                  savedPostIds={savedPostIds}
                  readRoster={activeRosterForRead}
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Notes</h2>
              </div>
              <NotesBoard
                notes={(notes ?? []) as unknown as Note[]}
                meId={franchisee.id}
              />
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Calendar</h2>
            </div>
            <StatusCalendar events={calEvents} />
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
              Create a checklist at kickoff — before the location even has an
              email. Attach their account later from Admin → Roster. Click a
              location to open its checklist right here.
            </p>
            <div style={{ marginBottom: 16 }}>
              <CreateChecklist />
            </div>
            <LocGrid
              selectedId={selected?.id}
              cards={locs.map((loc) => {
                const board = boardsByLocation.get(loc.id) ?? [];
                const phase = currentPhase(board);
                return {
                  id: loc.id,
                  name: loc.name,
                  phaseName: phase ? phase.name : "No checklist yet",
                  members: activeRoster.filter((f) => f.location_id === loc.id).length,
                  pct: phaseProgress(board.flatMap((p) => p.tasks)),
                  founders: loc.founding_members ?? 0,
                  goal: loc.founding_goal ?? 100,
                  go: loc.grand_opening
                    ? `GO ${new Date(loc.grand_opening + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}`
                    : "GO tbd",
                };
              })}
            />
          </section>

          {selected && (
            <section className="panel" id="loc-board">
              <div className="panel-head">
                <h2>{selected.name}</h2>
                <Link href="/?tab=checklists" className="link" style={{ fontSize: 12, color: "var(--backcourt)" }}>
                  Close
                </Link>
              </div>
              <BoardMeta key={selected.id} location={selected} />
              {selectedBoard.length === 0 ? (
                <p className="panel-note">No checklist yet for this location.</p>
              ) : (
                <BoardEditor key={selected.id} phases={selectedBoard} locationId={selected.id} adminMode />
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
