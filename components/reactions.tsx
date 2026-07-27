"use client";

import { useTransition, useOptimistic } from "react";
import { toggleReaction } from "@/app/(app)/actions";

const EMOJIS = ["👍", "🔥", "✅"];

type ReactionState = {
  counts: Record<string, number>;
  mine: string[];
};

export function Reactions({
  postId,
  counts,
  mine,
  who,
  adminRead,
}: {
  postId: string;
  counts: Record<string, number>;
  mine: string[];
  /** admin only: emoji -> names of who reacted */
  who?: Record<string, string[]>;
  /** admin only: read tracking chip (x/y with who's-missing tooltip) */
  adminRead?: { readers: number; total: number; waiting: string[] };
}) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic<ReactionState, string>(
    { counts, mine },
    (state, emoji) => {
      const has = state.mine.includes(emoji);
      return {
        counts: {
          ...state.counts,
          [emoji]: Math.max(0, (state.counts[emoji] ?? 0) + (has ? -1 : 1)),
        },
        mine: has
          ? state.mine.filter((e) => e !== emoji)
          : [...state.mine, emoji],
      };
    }
  );

  const onToggle = (emoji: string) => {
    startTransition(async () => {
      applyOptimistic(emoji);
      await toggleReaction(postId, emoji);
    });
  };

  return (
    <div className="reactions">
      {EMOJIS.map((emoji) => {
        const count = optimistic.counts[emoji] ?? 0;
        const on = optimistic.mine.includes(emoji);
        const names = who?.[emoji];
        return (
          <span className="react-wrap" key={emoji}>
            <button
              type="button"
              className={`react${on ? " on" : ""}`}
              onClick={() => onToggle(emoji)}
              aria-pressed={on}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="n">{count}</span>}
            </button>
            {names && names.length > 0 && (
              <span className="who-tip">{names.join(", ")}</span>
            )}
          </span>
        );
      })}
      {adminRead && (
        <span className="react-wrap" style={{ marginLeft: "auto" }}>
          <span
            className={`read-chip${adminRead.waiting.length === 0 ? " all" : ""}`}
          >
            {adminRead.readers}/{adminRead.total}
          </span>
          <span className="who-tip">
            {adminRead.waiting.length === 0
              ? "Everyone's read it 🎉"
              : `Waiting on: ${adminRead.waiting.join(", ")}`}
          </span>
        </span>
      )}
    </div>
  );
}
