import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { Feed, type FeedPost } from "@/components/feed";
import { ResourceRow, type Resource } from "@/components/resource-row";
import { BoardEditor } from "@/components/board-editor";
import { COLLECTIONS, collectionLabel } from "@/lib/collections";
import { phaseProgress, type BoardPhase } from "@/lib/board";

/** A board collects everything on one topic: posts AND resources. */
export default async function BoardPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const franchisee = await getFranchisee();
  const { topic } = await params;
  const supabase = await createClient();

  const { data: board } = await supabase
    .from("topics")
    .select("id, name, status")
    .eq("id", topic)
    .maybeSingle();

  if (!board) notFound();

  const isMarketing = board.name.toLowerCase() === "marketing";
  const isAdmin = franchisee.role === "admin";

  const [
    { data: posts },
    { data: rosterCount },
    { data: resources },
    { data: saves },
    { data: planPhases },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, title, body, media_url, media_type, requires_action, created_at, topics(name), reactions(franchisee_id, emoji, franchisees(location_name, email))"
      )
      .eq("topic_id", board.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("roster_count"),
    supabase
      .from("resources")
      .select("id, title, type, url, collection, updated_at, topics(name)")
      .eq("topic_id", board.id)
      .order("updated_at", { ascending: false }),
    supabase.from("saves").select("post_id, resource_id"),
    isMarketing && !isAdmin && franchisee.location_id
      ? supabase
          .from("phases")
          .select(
            "id, location_id, name, tag, sort_order, tasks(id, phase_id, title, owner, status, due_date, sort_order)"
          )
          .eq("location_id", franchisee.location_id)
          .eq("tag", "marketing")
          .order("sort_order")
      : Promise.resolve({ data: null }),
  ]);

  const savedPostIds = (saves ?? [])
    .map((s) => s.post_id)
    .filter(Boolean) as string[];
  const savedResourceIds = new Set(
    (saves ?? []).map((s) => s.resource_id).filter(Boolean)
  );

  const plan = ((planPhases ?? []) as unknown as BoardPhase[]).map((p) => ({
    ...p,
    tasks: [...p.tasks].sort((a, b) => a.sort_order - b.sort_order),
  }));
  const planTasks = plan.flatMap((p) => p.tasks);
  const planPct = phaseProgress(planTasks);

  // group resources into collection cards when any resource uses one
  const resourceList = (resources ?? []) as unknown as (Resource & {
    collection: string | null;
  })[];
  const useCollections = resourceList.some((r) => r.collection);
  const groups = useCollections
    ? [...COLLECTIONS.map(([k]) => k), null]
        .map((key) => ({
          key,
          label: collectionLabel(key),
          items: resourceList.filter((r) => (r.collection ?? null) === key),
        }))
        .filter((g) => g.items.length > 0)
    : null;

  return (
    <>
      <div className="page-head">
        <h1>{board.name}</h1>
      </div>
      <p className="subtitle">
        Everything {board.name.toLowerCase()} — updates and resources in one
        place.
      </p>

      {isMarketing && !isAdmin && plan.length > 0 && (
        <section className="panel" style={{ marginBottom: 22 }}>
          <div className="panel-head">
            <h2>Your 6-month marketing plan</h2>
            <span className="panel-note" style={{ margin: 0 }}>
              {planPct}% complete
            </span>
          </div>
          <p className="panel-note">
            Check things off as you go — HQ sees your progress live.
          </p>
          <BoardEditor phases={plan} locationId={franchisee.location_id} adminMode={false} />
        </section>
      )}

      {isMarketing && isAdmin && (
        <div className="banner" style={{ marginBottom: 22 }}>
          <div>
            <h3>Marketing plans live on each location&apos;s board</h3>
            <p>
              Franchisees see their own 6-month plan here. To edit plans, open a
              location from the admin Locations grid.
            </p>
          </div>
          <Link className="btn" href="/admin">
            Open Locations
          </Link>
        </div>
      )}

      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>Updates</h2>
          </div>
          <p className="panel-note">
            React to confirm you&apos;ve read each update.
          </p>
          <Feed
            posts={(posts ?? []) as unknown as FeedPost[]}
            meId={franchisee.id}
            isAdmin={isAdmin}
            savedPostIds={savedPostIds}
            rosterCount={rosterCount ?? 1}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Resources</h2>
          </div>
          {resourceList.length === 0 ? (
            <p className="panel-note">No resources on this board yet.</p>
          ) : groups ? (
            groups.map((g) => (
              <details className="res-group" key={g.label} open={groups.length === 1}>
                <summary>
                  {g.label}
                  <span className="res-group-count">{g.items.length}</span>
                </summary>
                <div className="res-group-body">
                  {g.items.map((r) => (
                    <ResourceRow
                      key={r.id}
                      resource={r as unknown as Resource}
                      showCategory={false}
                      meId={franchisee.id}
                      saved={savedResourceIds.has(r.id)}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </details>
            ))
          ) : (
            resourceList.map((r) => (
              <ResourceRow
                key={r.id}
                resource={r as unknown as Resource}
                showCategory={false}
                meId={franchisee.id}
                saved={savedResourceIds.has(r.id)}
                isAdmin={isAdmin}
              />
            ))
          )}
        </section>
      </div>
    </>
  );
}
