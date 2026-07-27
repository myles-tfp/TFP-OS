import { createClient } from "@/lib/supabase/server";
import { getFranchisee, isAdminRole } from "@/lib/get-franchisee";
import { Feed, type FeedPost } from "@/components/feed";
import { ResourceRow, type Resource } from "@/components/resource-row";

export default async function SavedPage() {
  const franchisee = await getFranchisee();
  const supabase = await createClient();

  const { data: saves } = await supabase
    .from("saves")
    .select("post_id, resource_id")
    .order("created_at", { ascending: false });

  const postIds = (saves ?? []).map((s) => s.post_id).filter(Boolean) as string[];
  const resourceIds = (saves ?? [])
    .map((s) => s.resource_id)
    .filter(Boolean) as string[];

  const [{ data: posts }, { data: rosterCount }, { data: resources }] =
    await Promise.all([
      postIds.length
        ? supabase
            .from("posts")
            .select(
              "id, title, body, media_url, media_type, requires_action, created_at, topics(name), reactions(franchisee_id, emoji, franchisees(location_name, email))"
            )
            .in("id", postIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.rpc("roster_count"),
      resourceIds.length
        ? supabase
            .from("resources")
            .select("id, title, type, url, updated_at, topics(name)")
            .in("id", resourceIds)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <>
      <div className="page-head">
        <h1>Saved</h1>
      </div>
      <p className="subtitle">
        Posts and resources you starred — your quick-access shelf.
      </p>

      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>Saved posts</h2>
          </div>
          {postIds.length === 0 ? (
            <p className="panel-note">
              Nothing saved yet — hover a post and hit the ☆.
            </p>
          ) : (
            <Feed
              posts={(posts ?? []) as unknown as FeedPost[]}
              meId={franchisee.id}
              isAdmin={isAdminRole(franchisee)}
              savedPostIds={postIds}
              rosterCount={rosterCount ?? 1}
            />
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Saved resources</h2>
          </div>
          {resourceIds.length === 0 ? (
            <p className="panel-note">
              Nothing saved yet — hover a resource and hit the ☆.
            </p>
          ) : (
            (resources ?? []).map((r) => (
              <ResourceRow
                key={r.id}
                resource={r as unknown as Resource}
                meId={franchisee.id}
                saved
                isAdmin={isAdminRole(franchisee)}
              />
            ))
          )}
        </section>
      </div>
    </>
  );
}
