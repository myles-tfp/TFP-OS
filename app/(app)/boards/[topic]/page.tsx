import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { Feed, type FeedPost } from "@/components/feed";
import { ResourceRow, type Resource } from "@/components/resource-row";

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

  const [{ data: posts }, { data: rosterCount }, { data: resources }, { data: saves }] =
    await Promise.all([
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
        .select("id, title, type, url, updated_at, topics(name)")
        .eq("topic_id", board.id)
        .order("updated_at", { ascending: false }),
      supabase.from("saves").select("post_id, resource_id"),
    ]);

  const savedPostIds = (saves ?? [])
    .map((s) => s.post_id)
    .filter(Boolean) as string[];
  const savedResourceIds = new Set(
    (saves ?? []).map((s) => s.resource_id).filter(Boolean)
  );

  return (
    <>
      <div className="page-head">
        <h1>{board.name}</h1>
      </div>
      <p className="subtitle">
        Everything {board.name.toLowerCase()} — updates and resources in one
        place.
      </p>

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
            isAdmin={franchisee.role === "admin"}
            savedPostIds={savedPostIds}
            rosterCount={rosterCount ?? 1}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Resources</h2>
          </div>
          {(resources ?? []).length === 0 ? (
            <p className="panel-note">No resources on this board yet.</p>
          ) : (
            (resources ?? []).map((r) => (
              <ResourceRow
                key={r.id}
                resource={r as unknown as Resource}
                showCategory={false}
                meId={franchisee.id}
                saved={savedResourceIds.has(r.id)}
              />
            ))
          )}
        </section>
      </div>
    </>
  );
}
