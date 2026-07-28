"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Location } from "@/lib/types";

/**
 * Location details — name (source of truth), grand opening, founders numbers.
 * Fully controlled inputs that re-sync whenever a different location is
 * selected, so switching locations can never show or save stale values.
 */
export function BoardMeta({ location }: { location: Location }) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(location.name);
  const [go, setGo] = useState(location.grand_opening ?? "");
  const [members, setMembers] = useState(
    location.founding_members != null ? String(location.founding_members) : ""
  );
  const [goal, setGoal] = useState(String(location.founding_goal ?? 100));

  // Re-sync the fields any time the selected location (or its data) changes.
  useEffect(() => {
    setName(location.name);
    setGo(location.grand_opening ?? "");
    setMembers(
      location.founding_members != null ? String(location.founding_members) : ""
    );
    setGoal(String(location.founding_goal ?? 100));
  }, [
    location.id,
    location.name,
    location.grand_opening,
    location.founding_members,
    location.founding_goal,
  ]);

  const update = async (patch: Record<string, unknown>) => {
    await supabase.from("locations").update(patch).eq("id", location.id);
    router.refresh();
  };

  return (
    <div className="board-meta">
      <label>
        Location name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim();
            if (v && v !== location.name) update({ name: v });
          }}
          title="Source of truth — renaming updates every member's title, chat, and cards across the OS"
        />
      </label>
      <label>
        Grand opening
        <input
          type="date"
          value={go}
          onChange={(e) => setGo(e.target.value)}
          onBlur={() => {
            const v = go || null;
            if (v !== (location.grand_opening ?? null)) update({ grand_opening: v });
          }}
        />
      </label>
      <label>
        Founding members
        <input
          type="number"
          min={0}
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          onBlur={() => {
            const v = members === "" ? null : Number(members);
            if (v !== (location.founding_members ?? null))
              update({ founding_members: v });
          }}
        />
      </label>
      <label>
        Goal
        <input
          type="number"
          min={0}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => {
            const v = Number(goal) || 100;
            if (v !== location.founding_goal) update({ founding_goal: v });
          }}
        />
      </label>
    </div>
  );
}
