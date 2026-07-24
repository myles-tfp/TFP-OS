"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconTrash } from "@/components/icons";
import type { Franchisee } from "@/lib/types";

export function TeamManager({ team, me }: { team: Franchisee[]; me: Franchisee }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Franchisee | null>(null);
  const [busy, setBusy] = useState(false);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const { error } = await supabase.from("franchisees").insert({
      email: email.trim().toLowerCase(),
      location_id: me.location_id,
      location_role: "user",
      role: "franchisee",
    });
    if (error) {
      setError(
        /duplicate/i.test(error.message)
          ? "That email is already on a team."
          : error.message
      );
      return;
    }
    setNotice(`${email.trim()} can now sign in — have them use "Set up your password" on the login page.`);
    setEmail("");
    router.refresh();
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    const { error } = await supabase
      .from("franchisees")
      .delete()
      .eq("id", removing.id);
    setBusy(false);
    setRemoving(null);
    if (error) setError(error.message);
    router.refresh();
  };

  return (
    <div>
      {error && <div className="auth-error">{error}</div>}
      {notice && <div className="auth-notice">{notice}</div>}

      <form onSubmit={invite} className="roster-add" style={{ gridTemplateColumns: "1fr auto" }}>
        <input
          type="email"
          required
          placeholder="social@contractor.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn">
          Invite
        </button>
      </form>

      <div className="roster-list">
        {team.map((member) => (
          <div className="roster-row" key={member.id}>
            <div className="roster-who">
              <div className="t">
                {member.email}
                {member.id === me.id && (
                  <span style={{ color: "var(--backcourt)", fontWeight: 400 }}> · you</span>
                )}
              </div>
              <div className="m">
                Joined {new Date(member.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
            <span
              className="cat-pill"
              style={
                member.location_role === "manager"
                  ? { color: "var(--dillball)", borderColor: "rgba(190,229,21,.4)" }
                  : undefined
              }
            >
              {member.location_role === "manager" ? "Manager" : "User"}
            </span>
            {member.location_role === "user" && (
              <button
                type="button"
                className="icon-btn danger"
                title="Remove from team"
                onClick={() => setRemoving(member)}
              >
                <IconTrash size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!removing}
        title="Remove this team member?"
        message={`${removing?.email ?? ""} loses access to TFP OS immediately. You can re-invite them later.`}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
        busy={busy}
      />
    </div>
  );
}
