"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Topic = { id: string; name: string };

const RESOURCE_TYPES = [
  ["doc", "Google Doc"],
  ["sheet", "Google Sheet"],
  ["slides", "Slides"],
  ["pdf", "PDF"],
  ["video", "Video"],
  ["image", "Image / photo"],
  ["canva", "Canva project"],
  ["link", "Other link"],
] as const;

function typeFromFile(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("video")) return "video";
  if (file.type.startsWith("image")) return "image";
  if (file.type.includes("spreadsheet") || file.name.endsWith(".xlsx")) return "sheet";
  if (file.type.includes("presentation") || file.name.endsWith(".pptx")) return "slides";
  if (file.type.includes("word") || file.name.endsWith(".docx")) return "doc";
  return "link";
}

export function ResourceForm({ topics }: { topics: Topic[] }) {
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("doc");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setDone(null);
    if (!title.trim() || !topicId || (!url.trim() && !file)) {
      setError("A title, board, and a link or file are required.");
      return;
    }
    setBusy(true);
    const supabase = createClient();

    try {
      let finalUrl = url.trim();
      let finalType = type;
      let overwrote = false;

      if (file) {
        // Stable path per filename → re-uploading the same file name
        // overwrites the previous version.
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `resources/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: true });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        finalUrl = data.publicUrl;
        finalType = typeFromFile(file);

        // If a resource already points at this file, update it instead of
        // creating a duplicate — that's the "new version" behavior.
        const { data: existing } = await supabase
          .from("resources")
          .select("id")
          .eq("url", finalUrl)
          .maybeSingle();

        if (existing) {
          const { error: updErr } = await supabase
            .from("resources")
            .update({
              title: title.trim(),
              topic_id: topicId,
              type: finalType,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (updErr) throw new Error(updErr.message);
          overwrote = true;
        }
      }

      if (!overwrote) {
        const { error: insErr } = await supabase.from("resources").insert({
          topic_id: topicId,
          title: title.trim(),
          type: finalType,
          url: finalUrl,
        });
        if (insErr) throw new Error(insErr.message);
      }

      setDone(
        overwrote
          ? "Updated — franchisees now get the new version."
          : "Added to the library."
      );
      setTitle("");
      setUrl("");
      setFile(null);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div>
      {error && <div className="auth-error">{error}</div>}
      {done && <div className="auth-notice">{done}</div>}

      <div className="field">
        <label htmlFor="r-title">Title</label>
        <input
          id="r-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Grand Opening Playbook"
        />
      </div>
      <div className="field">
        <label htmlFor="r-topic">Board</label>
        <select id="r-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="r-url">Link (Drive, Canva, YouTube…)</label>
        <input
          id="r-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/…"
          disabled={!!file}
        />
      </div>
      {!file && url.trim() === "" && (
        <p className="panel-note" style={{ marginBottom: 8 }}>
          — or —
        </p>
      )}
      <div className="field">
        <label htmlFor="r-file">Upload a file (pdf, image, video — up to 50MB)</label>
        <input
          id="r-file"
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f) {
              setUrl("");
              if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
            }
          }}
        />
        {file && (
          <p className="panel-note" style={{ marginTop: 6 }}>
            Re-uploading a file named &quot;{file.name}&quot; later will replace
            this version everywhere.
          </p>
        )}
      </div>
      {!file && (
        <div className="field">
          <label htmlFor="r-type">Type</label>
          <select id="r-type" value={type} onChange={(e) => setType(e.target.value)}>
            {RESOURCE_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="button" className="btn" onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Add to library"}
      </button>
    </div>
  );
}
