"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Create a location checklist BEFORE anyone has an email — the kickoff-call
 * flow. The manager gets attached later from the Roster.
 */
export function CreateChecklist() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error } = await supabase
      .from("locations")
      .insert({ name: name.trim() })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Couldn't create the checklist.");
      return;
    }
    setName("");
    setOpen(false);
    router.push(`/?tab=checklists&loc=${data.id}`);
    router.refresh();
  };

  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        + Create checklist
      </button>
    );
  }

  return (
    <form onSubmit={create} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {error && <span className="auth-error" style={{ margin: 0, padding: "6px 10px" }}>{error}</span>}
      <input
        type="text"
        required
        autoFocus
        placeholder="Location name (Boise)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          background: "rgba(255,255,255,.05)", border: "1px solid var(--line)",
          borderRadius: 9, padding: "9px 12px", color: "var(--baseline)",
          fontFamily: "var(--font-body)", fontSize: 13, outline: "none",
        }}
      />
      <button type="submit" className="btn" disabled={busy}>
        {busy ? "Creating…" : "Create"}
      </button>
      <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
