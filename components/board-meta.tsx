"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Location } from "@/lib/types";

/** Grand opening date + founders numbers — editable inline (location-level). */
export function BoardMeta({ location }: { location: Location }) {
  const router = useRouter();
  const supabase = createClient();

  const update = async (patch: Record<string, unknown>) => {
    await supabase.from("locations").update(patch).eq("id", location.id);
    router.refresh();
  };

  return (
    <div className="board-meta">
      <label>
        Grand opening
        <input
          type="date"
          defaultValue={location.grand_opening ?? ""}
          onBlur={(e) => {
            const v = e.target.value || null;
            if (v !== (location.grand_opening ?? null)) update({ grand_opening: v });
          }}
        />
      </label>
      <label>
        Founding members
        <input
          type="number"
          min={0}
          defaultValue={location.founding_members ?? ""}
          onBlur={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            if (v !== (location.founding_members ?? null)) update({ founding_members: v });
          }}
        />
      </label>
      <label>
        Goal
        <input
          type="number"
          min={0}
          defaultValue={location.founding_goal ?? 100}
          onBlur={(e) => {
            const v = Number(e.target.value) || 100;
            if (v !== location.founding_goal) update({ founding_goal: v });
          }}
        />
      </label>
    </div>
  );
}
