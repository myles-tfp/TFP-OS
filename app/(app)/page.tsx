import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee, locationName } from "@/lib/get-franchisee";
import { Feed, type FeedPost } from "@/components/feed";
import { ResourceRow, type Resource } from "@/components/resource-row";
import { BoardEditor } from "@/components/board-editor";
import { currentPhase, phaseProgress, type BoardPhase } from "@/lib/board";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const franchisee = await getFranchisee();
  const { tab } = await searchParams;
  const supabase = await createClient();

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const loc = franchisee.locations;

  const [
    { data: posts },
    { data: rosterCount },
    { data: resources },
    { data: saves },
    { count: newResourceCount },
    { data: myPhases },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, title, body, media_url, media_type, requires_action, created_at, topics(name), reactions(franchisee_id, emoji, franchisees(location_name, email))"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.rpc("roster_count"),
    supabase
      .from("resources")
      .select("id, title, type, url, updated_at, topics(name)")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("saves").select("post_id, resource_id"),
    supabase
      .from("resources")
      .select("id", { count: "exact", head: true })
      .gte("updated_at", weekAgo),
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
  const savedResourceIds = new Set(
    (saves ?? []).map((s) => s.resource_id).filter(Boolean)
  );

  const allPosts = (posts ?? []) as unknown as FeedPost[];
  const unread = allPosts.filter(
    (p) => !p.reactions.some((r) => r.franchisee_id === franchisee.id)
  );
  const banner = unread.find((p) => p.requires_action) ?? null;

  const board = ((myPhases ?? []) as unknown as BoardPhase[]).map((p) => ({
    ...p,
    tasks: [...p.tasks].sort((a, b) => a.sort_order - b.sort_order),
  }));
  const phase = currentPhase(board);
  const phaseShort = phase ? phase.name.split("—")[0].trim() : "—";
  const boardPct = phaseProgress(board.flatMap((p) => p.tasks));

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
              adminMode={franchisee.role === "admin"}
            />
          )}
        </>
      ) : (
        <>
          <section className="stats">
            <div className="stat accent">
              <div className="k">Your phase</div>
              <div className="v" style={{ fontSize: phaseShort.length > 10 ? 28 : 40 }}>
                {phaseShort}
              </div>
              <div className="sub">{goCountdown}</div>
            </div>
            <div className="stat">
              <div className="k">Founding members</div>
              <div className="v">{loc?.founding_members ?? "—"}</div>
              <div className="sub">goal: {loc?.founding_goal ?? 100} by launch</div>
            </div>
            <div className="stat">
              <div className="k">New resources</div>
              <div className="v">{newResourceCount ?? 0}</div>
              <div className="sub">added this week</div>
            </div>
            <div className={`stat${unread.length > 0 ? " warn" : ""}`}>
              <div className="k">Needs your read</div>
              <div className="v">{unread.length}</div>
              <div className="sub">
                {unread.length === 0 ? "all caught up 🎉" : "unread updates below"}
              </div>
            </div>
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
                <h2>From the franchisor</h2>
              </div>
              <p className="panel-note">
                React to confirm you&apos;ve read each update — we track reads
                by reaction.
              </p>
              <Feed
                posts={allPosts}
                meId={franchisee.id}
                isAdmin={franchisee.role === "admin"}
                savedPostIds={savedPostIds}
                rosterCount={rosterCount ?? 1}
              />
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Latest resources</h2>
              </div>
              {(resources ?? []).length === 0 ? (
                <p className="panel-note">
                  No resources yet — HQ adds them from the Admin page and they
                  show up here.
                </p>
              ) : (
                <>
                  <p className="panel-note">
                    The newest additions across every board.
                  </p>
                  {(resources ?? []).map((r) => (
                    <ResourceRow
                      key={r.id}
                      resource={r as unknown as Resource}
                      meId={franchisee.id}
                      saved={savedResourceIds.has(r.id)}
                      isAdmin={franchisee.role === "admin"}
                    />
                  ))}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
