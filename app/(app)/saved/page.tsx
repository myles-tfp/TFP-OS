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

  const [{ data: posts }, { data: resources }, { data: roster }] =
    await Promise.all([
      postIds.length
        ? supabase
            .from("posts")
            .select(
              "id, title, body, media_url, media_type, requires_action, created_at, topics(name), reactions(franchisee_id, emoji, franchisees(location_name, email, locations(name)))"
            )
            .in("id", postIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      resourceIds.length
        ? supabase
            .from("resources")
            .select("id, title, type, url, updated_at, topics(name)")
            .in("id", resourceIds)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      isAdminRole(franchisee)
        ? supabase
            .from("franchisees")
            .select("id, email, display_name, locations(name)")
            .eq("status", "active")
        : Promise.resolve({ data: [] }),
    ]);

  const readRoster = isAdminRole(franchisee)
    ? ((roster ?? []) as unknown as {
        id: string;
        email: string;
        display_name: string | null;
        locations: { name: string } | null;
      }[]).map((f) => ({
        id: f.id,
        name: f.locations?.name || f.display_name || f.email,
      }))
    : undefined;

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
              readRoster={readRoster}
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
