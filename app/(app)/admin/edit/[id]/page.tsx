import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { PostComposer, type EditablePost } from "@/components/post-composer";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const franchisee = await getFranchisee();
  if (franchisee.role !== "admin") redirect("/");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: post }, { data: topics }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, topic_id, title, body, media_url, media_type, requires_action")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("topics")
      .select("id, name, status")
      .order("sort_order"),
  ]);

  if (!post) notFound();

  return (
    <>
      <div className="page-head">
        <h1>Edit post</h1>
      </div>
      <p className="subtitle">
        Changes go live for everyone the moment you save.
      </p>

      <section className="panel" style={{ maxWidth: 640 }}>
        <PostComposer
          topics={(topics ?? []).filter((t) => t.status === "live")}
          initial={post as EditablePost}
        />
      </section>
    </>
  );
}
