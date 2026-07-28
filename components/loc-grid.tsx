"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type LocCard = {
  id: string;
  name: string;
  phaseName: string;
  members: number;
  pct: number;
  founders: number;
  goal: number;
  go: string;
};

/**
 * Location cards that collapse to a single compact row — automatically
 * when a checklist is open (so the checklist gets the screen), or
 * manually via the toggle. Scales to 50 locations.
 */
export function LocGrid({
  cards,
  selectedId,
}: {
  cards: LocCard[];
  selectedId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(!!selectedId);

  // Opening a checklist collapses the grid; Close expands it back.
  useEffect(() => {
    setCollapsed(!!selectedId);
  }, [selectedId]);

  return (
    <div>
      {collapsed ? (
        <div className="loc-strip">
          {cards.map((c) => (
            <Link
              href={`/?tab=checklists&loc=${c.id}`}
              className={`loc-pill${selectedId === c.id ? " on" : ""}`}
              key={c.id}
              title={`${c.phaseName} · ${c.members} member${c.members === 1 ? "" : "s"} · ⭐ ${c.founders}/${c.goal} · ${c.go}`}
            >
              {c.name} <span className="pct">{c.pct}%</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="loc-grid">
          {cards.map((c) => (
            <Link
              href={`/?tab=checklists&loc=${c.id}`}
              className={`loc-card${selectedId === c.id ? " on" : ""}`}
              key={c.id}
            >
              <div className="t">{c.name}</div>
              <div className="m">
                {c.phaseName} · {c.members} member{c.members === 1 ? "" : "s"}
              </div>
              <div className="phase-bar">
                <div className="phase-bar-fill" style={{ width: `${c.pct}%` }} />
              </div>
              <div className="loc-stats">
                <span>{c.pct}% complete</span>
                <span>⭐ {c.founders}/{c.goal}</span>
                <span>{c.go}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        className="loc-toggle"
        onClick={() => setCollapsed((v) => !v)}
      >
        {collapsed ? "⌄ Expand locations" : "⌃ Collapse to one row"}
      </button>
    </div>
  );
}
