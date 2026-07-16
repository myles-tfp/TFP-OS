import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { createPost } from "@/app/(app)/actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const franchisee = await getFranchisee();
  if (franchisee.role !== "admin") redirect("/");

  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: channels } = await supabase
    .from("channels")
    .select("id, name")
    .order("sort_order");

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <p className="subtitle">
        Post an update to the franchisor feed. Full admin tools (roster,
        resources, read stats) are coming in a later step.
      </p>

      <section className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-head">
          <h2>New post</h2>
        </div>
        {error && (
          <div className="auth-error">
            Couldn&apos;t publish: {error === "missing" ? "a channel and message are required." : error}
          </div>
        )}
        <form action={createPost}>
          <div className="field">
            <label htmlFor="channel_id">Channel</label>
            <select id="channel_id" name="channel_id" required className="select">
              {(channels ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="title">Title (optional)</label>
            <input id="title" name="title" type="text" placeholder="Q3 Founders push starts Monday" />
          </div>
          <div className="field">
            <label htmlFor="body">Message</label>
            <textarea
              id="body"
              name="body"
              required
              rows={5}
              placeholder="What do franchisees need to know?"
            />
          </div>
          <div className="field">
            <label htmlFor="media_url">Media or link URL (optional)</label>
            <input id="media_url" name="media_url" type="url" placeholder="https://…" />
          </div>
          <label className="check">
            <input type="checkbox" name="requires_action" />
            Requires action (shows the lime &quot;Action needed&quot; tag)
          </label>
          <button type="submit" className="btn" style={{ marginTop: 16 }}>
            Publish to feed
          </button>
        </form>
      </section>
    </>
  );
}
