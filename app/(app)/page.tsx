import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee, locationName, isAdminRole } from "@/lib/get-franchisee";
import { Feed, type FeedPost } from "@/components/feed";
import { BoardEditor } from "@/components/board-editor";
import { NotesBoard, type Note } from "@/components/notes-board";
import { currentPhase, phaseProgress, type BoardPhase } from "@/lib/board";
import { HqHome } from "@/app/(app)/hq-home";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; loc?: string }>;
}) {
  const franchisee = await getFranchisee();
  const { tab, loc: locParam } = await searchParams;

  // HQ gets the franchise-wide command center instead
  if (isAdminRole(franchisee)) {
    return <HqHome franchisee={franchisee} tab={tab} loc={locParam} />;
  }

  const supabase = await createClient();

  const loc = franchisee.locations;

  const [
    { data: posts },
    { data: notes },
    { data: saves },
    { data: myPhases },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, title, body, media_url, media_type, requires_action, created_at, topics(name), reactions(franchisee_id, emoji, franchisees(location_name, email))"
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("notes").select("*").order("created_at"),
    supabase.from("saves").select("post_id, resource_id"),
    franchisee.location_id
      ? supabase
          .from("phases")
          .select(
            "id, location_id, name, tag, sort_order, tasks(id, phase_id, title, owner, status, due_date, sort_order)"
          )
          .eq("location_id", franchisee.location_id)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
  ]);

  const savedPostIds = (saves ?? [])
    .map((s) => s.post_id)
    .filter(Boolean) as string[];

  const allPosts = (posts ?? []) as unknown as FeedPost[];
  const unread = allPosts.filter(
    (p) => !p.reactions.some((r) => r.franchisee_id === franchisee.id)
  );
  const banner = unread.find((p) => p.requires_action) ?? null;

  const board = ((myPhases ?? []) as unknown as BoardPhase[]).map((p) => ({
    ...p,
    tasks: [...p.tasks].sort((a, b) => a.sort_order - b.sort_order),
  }));
  const boardPct = phaseProgress(board.flatMap((p) => p.tasks));

  // "Club Operating" = every task in the official (non-marketing) phases done
  const official = board.filter((p) => p.tag !== "marketing" && p.tasks.length > 0);
  const clubOperating =
    official.length > 0 &&
    official.every((p) => p.tasks.every((t) => t.status === "done"));
  const phase = currentPhase(official);
  const phaseShort = clubOperating
    ? "Club Operating"
    : phase
      ? phase.name.split("—")[0].trim()
      : "—";

  // 6-month marketing plan: current month + that month's progress
  const marketing = board.filter((p) => p.tag === "marketing" && p.tasks.length > 0);
  const mPhase = currentPhase(marketing);
  const mShort = mPhase ? mPhase.name.split("—")[0].trim() : "—";
  const mPct = mPhase ? phaseProgress(mPhase.tasks) : 0;
  const marketingDone =
    marketing.length > 0 &&
    marketing.every((p) => p.tasks.every((t) => t.status === "done"));

  let goCountdown = "grand opening date TBD";
  if (loc?.grand_opening) {
    const days = Math.ceil(
      (new Date(loc.grand_opening + "T00:00:00").getTime() - Date.now()) /
        (24 * 3600 * 1000)
    );
    if (days < 0) goCountdown = "grand opening complete 🎉";
    else if (days === 0) goCountdown = "grand opening is TODAY 🎉";
    else if (days <= 45) goCountdown = `${days} days to grand open`;
    else goCountdown = `${Math.round(days / 30.44)} months to grand open`;
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const showChecklist = tab === "checklist";

  return (
    <>
      <div className="page-head">
        <h1>Welcome back, {locationName(franchisee)}</h1>
        <span className="date">{today}</span>
      </div>
      <p className="subtitle">
        Everything you need to run your location — resources, updates, and your
        onboarding, all in one place.
      </p>

      <div className="home-tabs">
        <Link href="/" className={`tab${!showChecklist ? " on" : ""}`}>
          Feed
        </Link>
        <Link href="/?tab=checklist" className={`tab${showChecklist ? " on" : ""}`}>
          Checklist
        </Link>
      </div>

      {showChecklist ? (
        <>
          <div className="checklist-head">
            <span className="panel-note" style={{ margin: 0 }}>
              Your onboarding — {boardPct}% complete
            </span>
            <div className="phase-bar" style={{ maxWidth: 220 }}>
              <div className="phase-bar-fill" style={{ width: `${boardPct}%` }} />
            </div>
          </div>
          {board.length === 0 ? (
            <section className="panel">
              <p className="panel-note">
                Your checklist is being set up by HQ — check back soon.
              </p>
            </section>
          ) : (
            <BoardEditor
              phases={board}
              locationId={franchisee.location_id}
              adminMode={isAdminRole(franchisee)}
            />
          )}
        </>
      ) : (
        <>
          <section className="stats" style={{ gridTemplateColumns: `repeat(${clubOperating ? 2 : 3}, 1fr)` }}>
            <div className="stat accent">
              <div className="k">Your phase</div>
              <div className="v" style={{ fontSize: phaseShort.length > 10 ? 28 : 40 }}>
                {phaseShort}
              </div>
              <div className="sub">
                {clubOperating ? "all phases complete 🎉" : goCountdown}
              </div>
            </div>
            <div className="stat">
              <div className="k">6-Mo marketing plan</div>
              <div className="v" style={{ fontSize: mShort.length > 10 ? 28 : 40 }}>
                {marketingDone ? "Complete" : mShort}
              </div>
              <div className="phase-bar" style={{ maxWidth: "none", margin: "8px 0 4px" }}>
                <div className="phase-bar-fill" style={{ width: `${marketingDone ? 100 : mPct}%` }} />
              </div>
              <div className="sub">
                {marketingDone ? "every month checked off 🎉" : `${mPct}% of this month done`}
              </div>
            </div>
            {!clubOperating && (
              <div className="stat">
                <div className="k">Founding members</div>
                <div className="v">{loc?.founding_members ?? "—"}</div>
                <div className="sub">goal: {loc?.founding_goal ?? 100} by launch</div>
              </div>
            )}
          </section>

          {banner && (
            <div className="banner">
              <div>
                <h3>{banner.title || "Action needed"}</h3>
                <p>
                  {banner.body.slice(0, 120)}
                  {banner.body.length > 120 ? "…" : ""}
                </p>
              </div>
              <a className="btn" href={`#post-${banner.id}`}>
                View update
              </a>
            </div>
          )}

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
                  isAdmin={isAdminRole(franchisee)}
                  savedPostIds={savedPostIds}
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
        </>
      )}
    </>
  );
}
