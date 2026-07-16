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
  readCount,
  rosterCount,
}: {
  postId: string;
  counts: Record<string, number>;
  mine: string[];
  /** admin only: emoji -> names of who reacted */
  who?: Record<string, string[]>;
  readCount: number;
  rosterCount: number;
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
      <span className="read-count">
        Read by {readCount} of {rosterCount} franchisee
        {rosterCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
