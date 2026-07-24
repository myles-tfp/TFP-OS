"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SaveButton } from "@/components/save-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconPencil, IconTrash } from "@/components/icons";

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
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    setBusy(false);
    setConfirming(false);
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
            <IconPencil size={13} />
          </Link>
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => setConfirming(true)}
            title="Delete post"
          >
            <IconTrash size={13} />
          </button>
          <ConfirmDialog
            open={confirming}
            title="Delete this post?"
            message="It disappears for everyone, along with its reactions and read history. This can't be undone."
            onConfirm={remove}
            onCancel={() => setConfirming(false)}
            busy={busy}
          />
        </>
      )}
    </span>
  );
}
