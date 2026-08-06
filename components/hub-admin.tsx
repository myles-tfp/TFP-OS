"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addHubMember, removeHubMember } from "@/app/(app)/actions";

export type HubMemberRow = {
  franchisee_id: string;
  role: string;
  name: string;
};

/** Hub name (owner-editable) + member list with add/remove for the owner. */
export function HubAdmin({
  hubId,
  hubName,
  members,
  candidates,
  meId,
  amOwner,
}: {
  hubId: string;
  hubName: string;
  members: HubMemberRow[];
  candidates: { id: string; name: string }[];
  meId: string;
  amOwner: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(hubName);
  useEffect(() => setName(hubName), [hubName]);

  const rename = async () => {
    const v = name.trim();
    if (!v || v === hubName) return;
    const { error } = await supabase
      .from("hubs")
      .update({ name: v })
      .eq("id", hubId);
    if (!error) router.refresh();
  };

  return (
    <>
      {amOwner ? (
        <div className="board-meta" style={{ marginBottom: 14 }}>
          <label>
            Hub name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={rename}
              title="Renaming the hub renames its #channel too"
            />
          </label>
        </div>
      ) : null}

      {members.map((m) => (
        <div className="team-row" key={m.franchisee_id}>
          <span>
            {m.name}
            {m.franchisee_id === meId ? " (you)" : ""}
          </span>
          <span className="pill">{m.role === "owner" ? "Owner" : "Member"}</span>
          {amOwner && m.franchisee_id !== meId && (
            <button
              type="button"
              className="icon-btn"
              title="Remove from hub"
              onClick={() => {
                if (window.confirm(`Remove ${m.name} from this hub?`)) {
                  void removeHubMember(hubId, m.franchisee_id);
                }
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {amOwner && candidates.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <select
            className="chat-loc"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                void addHubMember(hubId, e.target.value);
                e.target.value = "";
              }
            }}
          >
            <option value="" disabled>
              ＋ Add a teammate…
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
