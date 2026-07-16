"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SaveButton({
  meId,
  postId,
  resourceId,
  saved,
  className = "",
}: {
  meId: string;
  postId?: string;
  resourceId?: string;
  saved: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(saved);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const next = !isSaved;
    setIsSaved(next);

    if (next) {
      await supabase.from("saves").insert({
        franchisee_id: meId,
        post_id: postId ?? null,
        resource_id: resourceId ?? null,
      });
    } else {
      let q = supabase.from("saves").delete().eq("franchisee_id", meId);
      q = postId ? q.eq("post_id", postId) : q.eq("resource_id", resourceId!);
      await q;
    }

    setBusy(false);
    router.refresh();
  };

  return (
    <button
      type="button"
      className={`icon-btn${isSaved ? " on" : ""} ${className}`}
      onClick={toggle}
      title={isSaved ? "Remove from Saved" : "Save for later"}
      aria-pressed={isSaved}
    >
      {isSaved ? "★" : "☆"}
    </button>
  );
}
