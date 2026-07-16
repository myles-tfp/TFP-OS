import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { createBoard } from "@/app/(app)/actions";
import { PostComposer } from "@/components/post-composer";
import { ResourceForm } from "@/components/resource-form";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const franchisee = await getFranchisee();
  if (franchisee.role !== "admin") redirect("/");

  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: topics } = await supabase
    .from("topics")
    .select("id, name, status")
    .order("sort_order");

  const liveTopics = (topics ?? []).filter((t) => t.status === "live");

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <p className="subtitle">
        Post updates and manage the library. Full admin tools (roster, read
        stats) are coming in a later step.
      </p>

      {error && (
        <div className="auth-error" style={{ maxWidth: 640 }}>
          Couldn&apos;t save:{" "}
          {error === "missing" ? "required fields are missing." : error}
        </div>
      )}

      <div className="cols" style={{ alignItems: "start" }}>
        <section className="panel">
          <div className="panel-head">
            <h2>New post</h2>
          </div>
          <PostComposer topics={liveTopics} />
        </section>

        <div style={{ display: "grid", gap: 22 }}>
          <section className="panel">
            <div className="panel-head">
              <h2>New resource</h2>
            </div>
            <p className="panel-note">
              Link something from Drive or Canva, or upload a file directly.
            </p>
            <ResourceForm topics={liveTopics} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>New board</h2>
            </div>
            <p className="panel-note">
              Boards appear in everyone&apos;s sidebar and collect posts +
              resources on one topic.
            </p>
            <form action={createBoard}>
              <div className="field">
                <label htmlFor="b-name">Name</label>
                <input
                  id="b-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Training"
                />
              </div>
              <label className="check" style={{ marginBottom: 14 }}>
                <input type="checkbox" name="coming_soon" />
                Grayed out for now (&quot;coming soon&quot;)
              </label>
              <button type="submit" className="btn ghost">
                Add board
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
