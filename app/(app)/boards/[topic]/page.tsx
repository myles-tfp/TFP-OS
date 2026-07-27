import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { ResourceRow, type Resource } from "@/components/resource-row";
import { BoardEditor } from "@/components/board-editor";
import { TopicDescription } from "@/components/topic-description";
import { COLLECTIONS, collectionLabel } from "@/lib/collections";
import { phaseProgress, type BoardPhase } from "@/lib/board";

/** A board: how-to description + resource cards (posts live on Home). */
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
    .select("id, name, status, description, media_url, media_type")
    .eq("id", topic)
    .maybeSingle();

  if (!board) notFound();

  const isMarketing = board.name.toLowerCase() === "marketing";
  const isAdmin = franchisee.role === "admin";

  const [{ data: resources }, { data: saves }, { data: planPhases }] =
    await Promise.all([
      supabase
        .from("resources")
        .select("id, title, type, url, collection, updated_at, topics(name)")
        .eq("topic_id", board.id)
        .order("updated_at", { ascending: false }),
      supabase.from("saves").select("resource_id"),
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

  const savedResourceIds = new Set(
    (saves ?? []).map((s) => s.resource_id).filter(Boolean)
  );

  const plan = ((planPhases ?? []) as unknown as BoardPhase[]).map((p) => ({
    ...p,
    tasks: [...p.tasks].sort((a, b) => a.sort_order - b.sort_order),
  }));
  const planTasks = plan.flatMap((p) => p.tasks);
  const planPct = phaseProgress(planTasks);

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
        Everything {board.name.toLowerCase()} — how-tos and resources in one
        place.
      </p>

      <TopicDescription topic={board} isAdmin={isAdmin} />

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
              Franchisees see their own 6-month plan here. To edit plans, open
              a location from the admin Locations grid.
            </p>
          </div>
          <Link className="btn" href="/admin">
            Open Locations
          </Link>
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Resources</h2>
        </div>
        {resourceList.length === 0 ? (
          <p className="panel-note">
            No resources on this board yet — HQ adds them from Admin →
            Resource.
          </p>
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
    </>
  );
}
