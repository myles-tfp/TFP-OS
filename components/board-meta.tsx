"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Franchisee } from "@/lib/types";

/** Grand opening date + founders numbers — editable inline. */
export function BoardMeta({ franchisee }: { franchisee: Franchisee }) {
  const router = useRouter();
  const supabase = createClient();

  const update = async (patch: Record<string, unknown>) => {
    await supabase.from("franchisees").update(patch).eq("id", franchisee.id);
    router.refresh();
  };

  return (
    <div className="board-meta">
      <label>
        Grand opening
        <input
          type="date"
          defaultValue={franchisee.grand_opening ?? ""}
          onBlur={(e) => {
            const v = e.target.value || null;
            if (v !== (franchisee.grand_opening ?? null)) update({ grand_opening: v });
          }}
        />
      </label>
      <label>
        Founding members
        <input
          type="number"
          min={0}
          defaultValue={franchisee.founding_members ?? ""}
          onBlur={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            if (v !== (franchisee.founding_members ?? null)) update({ founding_members: v });
          }}
        />
      </label>
      <label>
        Goal
        <input
          type="number"
          min={0}
          defaultValue={franchisee.founding_goal ?? 100}
          onBlur={(e) => {
            const v = Number(e.target.value) || 100;
            if (v !== franchisee.founding_goal) update({ founding_goal: v });
          }}
        />
      </label>
    </div>
  );
}
