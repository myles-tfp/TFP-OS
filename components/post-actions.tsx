"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SaveButton } from "@/components/save-button";

export function PostActions({
  postId,
  meId,
  saved,
  isAdmin,
}: {
  postId: string;
  meId: string;
  saved: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const remove = async () => {
    if (
      !window.confirm(
        "Delete this post for everyone? Reactions and read history go with it."
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      window.alert(`Couldn't delete: ${error.message}`);
      return;
    }
    router.refresh();
  };

  return (
    <span className="post-actions">
      <SaveButton meId={meId} postId={postId} saved={saved} />
      {isAdmin && (
        <>
          <Link
            href={`/admin/edit/${postId}`}
            className="icon-btn"
            title="Edit post"
          >
            ✎
          </Link>
          <button
            type="button"
            className="icon-btn danger"
            onClick={remove}
            title="Delete post"
          >
            🗑
          </button>
        </>
      )}
    </span>
  );
}
