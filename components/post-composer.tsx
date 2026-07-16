"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toEmbedUrl } from "@/lib/embed";
import { PostMedia } from "@/components/post-media";

type Topic = { id: string; name: string };

export function PostComposer({ topics }: { topics: Topic[] }) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [requiresAction, setRequiresAction] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicName = topics.find((t) => t.id === topicId)?.name ?? "";

  // What the media will look like (for preview + publish)
  const resolveMedia = (): { url: string; type: string } | null => {
    if (file) {
      const type = file.type.startsWith("video") ? "video" : "image";
      return { url: filePreview ?? "", type };
    }
    const trimmed = mediaUrl.trim();
    if (!trimmed) return null;
    const embed = toEmbedUrl(trimmed);
    if (embed) return { url: embed, type: "embed" };
    return { url: trimmed, type: "link" };
  };

  const onFile = (f: File | null) => {
    setFile(f);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(f ? URL.createObjectURL(f) : null);
    if (f) setMediaUrl("");
  };

  const publish = async () => {
    setError(null);
    if (!body.trim() || !topicId) {
      setError("A board and a message are required.");
      return;
    }
    setBusy(true);
    const supabase = createClient();

    try {
      let media: { url: string; type: string } | null = null;

      if (file) {
        const path = `posts/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: true });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        media = {
          url: data.publicUrl,
          type: file.type.startsWith("video") ? "video" : "image",
        };
      } else {
        media = resolveMedia();
      }

      const { error: insErr } = await supabase.from("posts").insert({
        topic_id: topicId,
        title: title.trim() || null,
        body: body.trim(),
        media_url: media?.url ?? null,
        media_type: media?.type ?? null,
        requires_action: requiresAction,
      });
      if (insErr) throw new Error(insErr.message);

      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const media = resolveMedia();

  return (
    <div>
      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === "write" ? " on" : ""}`}
          onClick={() => setTab("write")}
        >
          Write
        </button>
        <button
          type="button"
          className={`tab${tab === "preview" ? " on" : ""}`}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {tab === "write" ? (
        <>
          <div className="field">
            <label htmlFor="p-topic">Board</label>
            <select
              id="p-topic"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-title">Title (optional)</label>
            <input
              id="p-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q3 Founders push starts Monday"
            />
          </div>
          <div className="field">
            <label htmlFor="p-body">Message</label>
            <textarea
              id="p-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What do franchisees need to know?"
            />
          </div>
          <div className="field">
            <label htmlFor="p-url">Video or link URL (YouTube, Vimeo, Loom embed automatically)</label>
            <input
              id="p-url"
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              disabled={!!file}
            />
          </div>
          <div className="field">
            <label htmlFor="p-file">Or upload a photo / video (jpg, png, mp4, mov — up to 50MB)</label>
            <input
              id="p-file"
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <button
                type="button"
                className="signout"
                style={{ marginTop: 6 }}
                onClick={() => onFile(null)}
              >
                Remove file
              </button>
            )}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={requiresAction}
              onChange={(e) => setRequiresAction(e.target.checked)}
            />
            Requires action (shows the lime &quot;Action needed&quot; tag)
          </label>
        </>
      ) : (
        <div className="preview-box">
          <article className="post" style={{ borderTop: "none" }}>
            <div className="post-meta">
              <div className="avatar">TFP</div>
              <div>
                <div className="name">TFP HQ{topicName ? ` · ${topicName}` : ""}</div>
                <div className="time">just now</div>
              </div>
              {requiresAction && <span className="tag">Action needed</span>}
            </div>
            {title.trim() && (
              <p
                className="post-body"
                style={{ fontWeight: 500, color: "var(--baseline)", marginBottom: 4 }}
              >
                {title}
              </p>
            )}
            <p className="post-body">{body.trim() || "Your message will appear here…"}</p>
            {media && media.url && <PostMedia url={media.url} type={media.type} />}
          </article>
        </div>
      )}

      <button
        type="button"
        className="btn"
        style={{ marginTop: 16 }}
        onClick={publish}
        disabled={busy}
      >
        {busy ? "Publishing…" : "Publish to feed"}
      </button>
    </div>
  );
}
