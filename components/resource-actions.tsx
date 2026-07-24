"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaveButton } from "@/components/save-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconTrash } from "@/components/icons";

export function ResourceActions({
  resourceId,
  resourceTitle,
  meId,
  saved,
  isAdmin,
}: {
  resourceId: string;
  resourceTitle: string;
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
    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", resourceId);
    setBusy(false);
    setConfirming(false);
    if (error) {
      window.alert(`Couldn't delete: ${error.message}`);
      return;
    }
    router.refresh();
  };

  return (
    <span
      className="res-actions"
      onClick={(e) => {
        // keep clicks on the action buttons from opening the resource link
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <SaveButton meId={meId} resourceId={resourceId} saved={saved} />
      {isAdmin && (
        <>
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => setConfirming(true)}
            title="Delete resource"
          >
            <IconTrash size={13} />
          </button>
          <ConfirmDialog
            open={confirming}
            title="Delete this resource?"
            message={`"${resourceTitle}" will disappear from every board and everyone's saved list. This can't be undone.`}
            onConfirm={remove}
            onCancel={() => setConfirming(false)}
            busy={busy}
          />
        </>
      )}
    </span>
  );
}
