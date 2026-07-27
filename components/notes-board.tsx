"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconTrash, IconPencil } from "@/components/icons";

export type NoteAttachment = { url: string; type: "image" | "video" };
export type Note = {
  id: string;
  title: string;
  body: string;
  attachments: NoteAttachment[];
  height: number;
};

/**
 * Doodle board: quick personal notes with checkboxes ("[ ] task"),
 * photo/video drops, multiple named notes, and a vertical stretch handle.
 */
export function NotesBoard({ notes: initial, meId }: { notes: Note[]; meId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [removing, setRemoving] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const patch = async (id: string, fields: Partial<Note>) => {
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...fields } : n)));
    await supabase
      .from("notes")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  const addNote = async () => {
    const { data, error } = await supabase
      .from("notes")
      .insert({ franchisee_id: meId, title: "New note" })
      .select("*")
      .single();
    if (error || !data) return;
    const note = data as Note;
    setNotes((ns) => [...ns, note]);
    setActiveId(note.id);
    setEditing(true);
    setDraft("");
    router.refresh();
  };

  const deleteNote = async () => {
    if (!removing) return;
    setBusy(true);
    await supabase.from("notes").delete().eq("id", removing.id);
    setBusy(false);
    setNotes((ns) => ns.filter((n) => n.id !== removing.id));
    if (activeId === removing.id) {
      const rest = notes.filter((n) => n.id !== removing.id);
      setActiveId(rest[0]?.id ?? null);
    }
    setRemoving(null);
    router.refresh();
  };

  const startEdit = () => {
    if (!active) return;
    setDraft(active.body);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!active) return;
    setEditing(false);
    if (draft !== active.body) void patch(active.id, { body: draft });
  };

  const toggleLine = (lineIdx: number) => {
    if (!active) return;
    const lines = active.body.split("\n");
    const line = lines[lineIdx];
    if (/^\s*\[ \]/.test(line)) lines[lineIdx] = line.replace("[ ]", "[x]");
    else if (/^\s*\[x\]/i.test(line)) lines[lineIdx] = line.replace(/\[x\]/i, "[ ]");
    void patch(active.id, { body: lines.join("\n") });
  };

  const upload = async (file: File) => {
    if (!active) return;
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `notes/${meId}-${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (error) {
      window.alert(`Upload failed: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    const attachment: NoteAttachment = {
      url: data.publicUrl,
      type: file.type.startsWith("video") ? "video" : "image",
    };
    void patch(active.id, { attachments: [...active.attachments, attachment] });
  };

  const removeAttachment = (i: number) => {
    if (!active) return;
    void patch(active.id, {
      attachments: active.attachments.filter((_, j) => j !== i),
    });
  };

  const persistHeight = () => {
    const el = boxRef.current;
    if (!el || !active) return;
    const h = Math.round(el.offsetHeight);
    if (Math.abs(h - active.height) > 8) void patch(active.id, { height: h });
  };

  return (
    <div>
      <div className="note-tabs">
        {notes.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`tab${n.id === activeId ? " on" : ""}`}
            onClick={() => {
              setActiveId(n.id);
              setEditing(false);
            }}
          >
            {n.title || "Untitled"}
          </button>
        ))}
        <button type="button" className="tab" onClick={addNote} title="New note">
          +
        </button>
      </div>

      {!active ? (
        <p className="panel-note">
          Your scratchpad — hit + to start a note. Ideas, to-dos (type{" "}
          <code>[ ]</code> for a checkbox), photos, videos.
        </p>
      ) : (
        <>
          <div className="note-head">
            <input
              className="note-title"
              defaultValue={active.title}
              key={active.id}
              onBlur={(e) => {
                const v = e.target.value.trim() || "Untitled";
                if (v !== active.title) void patch(active.id, { title: v });
              }}
            />
            <label className="icon-btn" title="Add photo or video" style={{ cursor: "pointer" }}>
              📷
              <input
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {!editing && (
              <button type="button" className="icon-btn" title="Edit note" onClick={startEdit}>
                <IconPencil size={13} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn danger"
              title="Delete note"
              onClick={() => setRemoving(active)}
            >
              <IconTrash size={13} />
            </button>
          </div>

          <div
            className="note-box"
            ref={boxRef}
            style={{ height: active.height }}
            onMouseUp={persistHeight}
          >
            {editing ? (
              <textarea
                className="note-edit"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveEdit}
                placeholder={"Dump ideas here…\n[ ] a checkbox\n[x] a done one"}
                autoFocus
              />
            ) : (
              <div className="note-view" onClick={startEdit}>
                {active.body.trim() === "" && active.attachments.length === 0 ? (
                  <span className="panel-note">Click to write…</span>
                ) : (
                  active.body.split("\n").map((line, i) => {
                    const m = line.match(/^\s*\[( |x)\]\s?(.*)$/i);
                    if (m) {
                      const checked = m[1].toLowerCase() === "x";
                      return (
                        <label
                          key={i}
                          className="note-check"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLine(i)}
                          />
                          <span className={checked ? "done" : ""}>{m[2]}</span>
                        </label>
                      );
                    }
                    return <div key={i}>{line || " "}</div>;
                  })
                )}
                {active.attachments.length > 0 && (
                  <div className="note-media" onClick={(e) => e.stopPropagation()}>
                    {active.attachments.map((a, i) => (
                      <div className="note-media-item" key={i}>
                        {a.type === "video" ? (
                          <video src={a.url} controls preload="metadata" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.url} alt="" />
                        )}
                        <button
                          type="button"
                          className="note-media-x"
                          title="Remove"
                          onClick={() => removeAttachment(i)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="note-hint">
            Click to edit · <code>[ ]</code> makes a checkbox · drag the bottom
            edge to stretch
          </p>
        </>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Delete this note?"
        message={`"${removing?.title ?? ""}" and its attachments will be removed. This can't be undone.`}
        onConfirm={deleteNote}
        onCancel={() => setRemoving(null)}
        busy={busy}
      />
    </div>
  );
}
