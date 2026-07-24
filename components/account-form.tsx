"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { memberTitle, initials } from "@/lib/identity";
import type { Franchisee } from "@/lib/types";

export function AccountForm({ me }: { me: Franchisee & { display_name?: string | null; avatar_url?: string | null } }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(me.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(me.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadAvatar = async (file: File) => {
    setBusy(true);
    setError(null);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${me.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("media")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    await supabase
      .from("franchisees")
      .update({ avatar_url: data.publicUrl })
      .eq("id", me.id);
    setBusy(false);
    setNotice("Photo updated.");
    router.refresh();
  };

  const saveName = async () => {
    setError(null);
    const { error } = await supabase
      .from("franchisees")
      .update({ display_name: name.trim() || null })
      .eq("id", me.id);
    if (error) setError(error.message);
    else setNotice("Saved.");
    router.refresh();
  };

  const title = memberTitle(me.locations?.name, name, me.email);

  return (
    <div>
      {error && <div className="auth-error">{error}</div>}
      {notice && <div className="auth-notice">{notice}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="chat-avatar" style={{ width: 64, height: 64 }} />
        ) : (
          <div className="chat-avatar chat-avatar-fallback" style={{ width: 64, height: 64, fontSize: 22 }}>
            {initials(name, me.email)}
          </div>
        )}
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--backcourt)" }}>{me.email}</div>
        </div>
      </div>

      <div className="field">
        <label htmlFor="a-name">Your name</label>
        <input
          id="a-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jordan"
        />
      </div>
      <button type="button" className="btn" onClick={saveName} disabled={busy} style={{ marginBottom: 20 }}>
        Save name
      </button>

      <div className="field">
        <label htmlFor="a-photo">Profile photo (jpg or png)</label>
        <input
          id="a-photo"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadAvatar(f);
          }}
        />
      </div>
    </div>
  );
}
