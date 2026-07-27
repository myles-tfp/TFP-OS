"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconPause, IconPlay, IconTrash } from "@/components/icons";
import type { Franchisee } from "@/lib/types";

/** Admin: create locations (with their manager) and manage all members. */
export function RosterManager({ roster, meId }: { roster: Franchisee[]; meId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [locName, setLocName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Franchisee | null>(null);
  const [busy, setBusy] = useState(false);

  const addLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .insert({ name: locName.trim() })
      .select("id")
      .single();
    if (locErr || !loc) {
      setError(locErr?.message ?? "Couldn't create the location.");
      return;
    }

    const { error: memErr } = await supabase.from("franchisees").insert({
      email: email.trim().toLowerCase(),
      location_id: loc.id,
      location_role: "manager",
      role: "franchisee",
    });
    if (memErr) {
      setError(
        /duplicate/i.test(memErr.message)
          ? "That email is already on the roster."
          : memErr.message
      );
      return;
    }

    setNotice(`${locName.trim()} created — ${email.trim()} can sign in as its manager. Their board is ready.`);
    setLocName("");
    setEmail("");
    router.refresh();
  };

  const update = async (id: string, patch: Partial<Franchisee>) => {
    setError(null);
    const { error } = await supabase.from("franchisees").update(patch).eq("id", id);
    if (error) setError(error.message);
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

      <form onSubmit={addLocation} className="roster-add" style={{ gridTemplateColumns: "1fr 1.3fr auto" }}>
        <input
          type="text"
          required
          placeholder="Location name (Boise)"
          value={locName}
          onChange={(e) => setLocName(e.target.value)}
        />
        <input
          type="email"
          required
          placeholder="owner@newlocation.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn">
          Add location
        </button>
      </form>

      <div className="roster-list">
        {roster.map((f) => (
          <div className={`roster-row${f.status === "inactive" ? " inactive" : ""}`} key={f.id}>
            <div className="roster-who">
              <div className="t">{f.locations?.name || "—"}</div>
              <div className="m">{f.email}</div>
            </div>
            <span
              className="cat-pill"
              style={
                f.role === "owner"
                  ? { color: "var(--dillball)", borderColor: "rgba(190,229,21,.4)" }
                  : undefined
              }
            >
              {f.role === "owner"
                ? "Owner"
                : f.role === "admin"
                  ? "Admin"
                  : f.location_role === "manager"
                    ? "Manager"
                    : "User"}
            </span>
            <select
              value={f.role}
              onChange={(e) => update(f.id, { role: e.target.value as Franchisee["role"] })}
              disabled={f.id === meId}
              title={f.id === meId ? "You can't change your own role" : "Global role"}
            >
              <option value="franchisee">Franchisee</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              className="icon-btn"
              title={f.status === "active" ? "Deactivate (blocks sign-in)" : "Reactivate"}
              onClick={() =>
                update(f.id, { status: f.status === "active" ? "inactive" : "active" })
              }
              disabled={f.id === meId}
            >
              {f.status === "active" ? <IconPause size={13} /> : <IconPlay size={13} />}
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title="Remove from roster"
              onClick={() => setRemoving(f)}
              disabled={f.id === meId}
            >
              <IconTrash size={13} />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!removing}
        title="Remove this member?"
        message={`${removing?.email ?? ""} loses access immediately. Deactivating (⏸) is gentler if they might come back. (Removing a manager does NOT delete their location or board.)`}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
        busy={busy}
      />
    </div>
  );
}
