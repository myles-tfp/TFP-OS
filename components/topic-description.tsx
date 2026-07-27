"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PostMedia } from "@/components/post-media";
import { toEmbedUrl } from "@/lib/embed";
import { IconPencil } from "@/components/icons";

type Topic = {
  id: string;
  name: string;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
};

/** Board intro: how to use this board — editable by admins, with media. */
export function TopicDescription({ topic, isAdmin }: { topic: Topic; isAdmin: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.description ?? "");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    await supabase
      .from("topics")
      .update({ description: draft.trim() || null, ...extra })
      .eq("id", topic.id);
    setBusy(false);
    setEditing(false);
    router.refresh();
  };

  const attachUrl = async () => {
    const trimmed = mediaUrl.trim();
    if (!trimmed) return;
    const embed = toEmbedUrl(trimmed);
    await save({
      media_url: embed ?? trimmed,
      media_type: embed ? "embed" : "link",
    });
    setMediaUrl("");
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    const path = `posts/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (error) {
      window.alert(`Upload failed: ${error.message}`);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    await save({
      media_url: data.publicUrl,
      media_type: file.type.startsWith("video") ? "video" : "image",
    });
  };

  const hasContent = topic.description || topic.media_url;

  if (!isAdmin && !hasContent) return null;

  return (
    <section className="panel" style={{ marginBottom: 22 }}>
      <div className="panel-head">
        <h2>How to use this board</h2>
        {isAdmin && !editing && (
          <button
            type="button"
            className="icon-btn"
            title="Edit description"
            onClick={() => setEditing(true)}
          >
            <IconPencil size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <div className="field">
            <textarea
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`What lives on the ${topic.name} board and how franchisees should use it…`}
            />
          </div>
          <div className="field">
            <label htmlFor="td-url">Video or link URL (YouTube/Vimeo/Loom embed automatically)</label>
            <input
              id="td-url"
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={() => void save()} disabled={busy}>
              Save
            </button>
            {mediaUrl.trim() && (
              <button type="button" className="btn ghost" onClick={() => void attachUrl()} disabled={busy}>
                Save + attach link
              </button>
            )}
            <label className="btn ghost" style={{ cursor: "pointer" }}>
              Upload photo/video
              <input
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f);
                }}
              />
            </label>
            {topic.media_url && (
              <button
                type="button"
                className="btn ghost"
                style={{ borderColor: "var(--bodybag)", color: "var(--bodybag)" }}
                onClick={() => void save({ media_url: null, media_type: null })}
                disabled={busy}
              >
                Remove media
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {topic.description && (
            <p className="post-body" style={{ marginBottom: topic.media_url ? 14 : 0 }}>
              {topic.description}
            </p>
          )}
          {topic.media_url && (
            <PostMedia url={topic.media_url} type={topic.media_type} />
          )}
          {isAdmin && !hasContent && (
            <p className="panel-note">
              No description yet — hit the pencil to tell franchisees how to
              use this board.
            </p>
          )}
        </>
      )}
    </section>
  );
}
