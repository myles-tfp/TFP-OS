"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Franchisee } from "@/lib/types";

export function RosterManager({ roster, meId }: { roster: Franchisee[]; meId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("franchisee");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Franchisee | null>(null);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const { error } = await supabase.from("franchisees").insert({
      email: email.trim().toLowerCase(),
      location_name: location.trim() || null,
      role,
    });
    if (error) {
      setError(
        /duplicate/i.test(error.message)
          ? "That email is already on the roster."
          : error.message
      );
      return;
    }
    setNotice(`${email.trim()} can now sign in.`);
    setEmail("");
    setLocation("");
    setRole("franchisee");
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

      <form onSubmit={add} className="roster-add">
        <input
          type="email"
          required
          placeholder="owner@newlocation.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder="Location name"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="franchisee">Franchisee</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="btn">
          Add
        </button>
      </form>

      <div className="roster-list">
        {roster.map((f) => (
          <div className={`roster-row${f.status === "inactive" ? " inactive" : ""}`} key={f.id}>
            <div className="roster-who">
              <div className="t">{f.location_name || "—"}</div>
              <div className="m">{f.email}</div>
            </div>
            <select
              value={f.role}
              onChange={(e) => update(f.id, { role: e.target.value as Franchisee["role"] })}
              disabled={f.id === meId}
              title={f.id === meId ? "You can't change your own role" : "Role"}
            >
              <option value="franchisee">Franchisee</option>
              <option value="admin">Admin</option>
            </select>
            <input
              type="number"
              min={0}
              className="roster-fm"
              title="Founding members"
              placeholder="FM"
              defaultValue={f.founding_members ?? ""}
              onBlur={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                if (v !== (f.founding_members ?? null)) {
                  update(f.id, { founding_members: v });
                }
              }}
            />
            <button
              type="button"
              className="icon-btn"
              title={f.status === "active" ? "Deactivate (blocks sign-in)" : "Reactivate"}
              onClick={() =>
                update(f.id, { status: f.status === "active" ? "inactive" : "active" })
              }
              disabled={f.id === meId}
            >
              {f.status === "active" ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title="Remove from roster"
              onClick={() => setRemoving(f)}
              disabled={f.id === meId}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!removing}
        title="Remove this franchisee?"
        message={`${removing?.email ?? ""} loses access immediately, and their reactions and saves are removed. Deactivating (⏸) is gentler if they might come back.`}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
        busy={busy}
      />
    </div>
  );
}
