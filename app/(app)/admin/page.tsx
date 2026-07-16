import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { createPost, createResource, createCategory } from "@/app/(app)/actions";

const RESOURCE_TYPES = [
  ["doc", "Google Doc"],
  ["sheet", "Google Sheet"],
  ["slides", "Slides"],
  ["pdf", "PDF"],
  ["video", "Video"],
  ["image", "Image / photo"],
  ["canva", "Canva project"],
  ["link", "Other link"],
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const franchisee = await getFranchisee();
  if (franchisee.role !== "admin") redirect("/");

  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: channels }, { data: categories }] = await Promise.all([
    supabase.from("channels").select("id, name").order("sort_order"),
    supabase.from("resource_categories").select("id, name").order("sort_order"),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <p className="subtitle">
        Post updates and manage the resource library. Full admin tools
        (roster, read stats) are coming in a later step.
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
          <form action={createPost}>
            <div className="field">
              <label htmlFor="channel_id">Channel</label>
              <select id="channel_id" name="channel_id" required>
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

        <div style={{ display: "grid", gap: 22 }}>
          <section className="panel">
            <div className="panel-head">
              <h2>New resource</h2>
            </div>
            <p className="panel-note">
              Paste a link from Drive, Canva, or anywhere else — it opens in a
              new tab for franchisees.
            </p>
            <form action={createResource}>
              <div className="field">
                <label htmlFor="r-title">Title</label>
                <input
                  id="r-title"
                  name="title"
                  type="text"
                  required
                  placeholder="Grand Opening Playbook"
                />
              </div>
              <div className="field">
                <label htmlFor="r-category">Category</label>
                <select id="r-category" name="category_id" required>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="r-type">Type</label>
                <select id="r-type" name="type" required defaultValue="doc">
                  {RESOURCE_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="r-url">Link</label>
                <input
                  id="r-url"
                  name="url"
                  type="url"
                  required
                  placeholder="https://docs.google.com/…"
                />
              </div>
              <button type="submit" className="btn">
                Add resource
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>New category</h2>
            </div>
            <p className="panel-note">
              Categories appear in everyone&apos;s sidebar under Resources.
            </p>
            <form action={createCategory}>
              <div className="field">
                <label htmlFor="c-name">Name</label>
                <input
                  id="c-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Training"
                />
              </div>
              <button type="submit" className="btn ghost">
                Add category
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
