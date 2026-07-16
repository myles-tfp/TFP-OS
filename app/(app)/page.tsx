import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { Feed, type FeedPost } from "@/components/feed";

export default async function HomePage() {
  const franchisee = await getFranchisee();
  const supabase = await createClient();

  const [{ data: posts }, { data: rosterCount }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, title, body, media_url, media_type, requires_action, created_at, channels(name), reactions(franchisee_id, emoji)"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.rpc("roster_count"),
  ]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const name = franchisee.location_name || "pickler";

  return (
    <>
      <div className="page-head">
        <h1>Welcome back, {name}</h1>
        <span className="date">{today}</span>
      </div>
      <p className="subtitle">
        Everything you need to run your location — resources, updates, and your
        onboarding, all in one place.
      </p>

      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>From the franchisor</h2>
          </div>
          <p className="panel-note">
            React to confirm you&apos;ve read each update — we track reads by
            reaction.
          </p>
          <Feed
            posts={(posts ?? []) as unknown as FeedPost[]}
            meId={franchisee.id}
            rosterCount={rosterCount ?? 1}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Latest resources</h2>
          </div>
          <p className="panel-note">
            The resource library is up next — Marketing lands here first.
          </p>
        </section>
      </div>
    </>
  );
}
