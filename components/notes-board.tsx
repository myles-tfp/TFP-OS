"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconTrash, IconPencil, IconCamera } from "@/components/icons";

export type NoteAttachment = {
  url: string;
  type: "image" | "video";
  align?: "left" | "right" | "full";
};
export type Note = {
  id: string;
  title: string;
  body: string;
  attachments: NoteAttachment[];
  height: number;
};

/** Bold / italic inline rendering (same markdown-lite as chat). */
function renderInline(text: string) {
  return text
    .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

/** Line alignment markers: "[c] " centers, "[r] " right-aligns. */
function lineAlign(line: string): { align: "left" | "center" | "right"; text: string } {
  if (line.startsWith("[c] ")) return { align: "center", text: line.slice(4) };
  if (line.startsWith("[r] ")) return { align: "right", text: line.slice(4) };
  return { align: "left", text: line };
}

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
  const editRef = useRef<HTMLTextAreaElement>(null);

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

  const wrapSelection = (marker: "**" | "*") => {
    const el = editRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e) || "text";
    const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + marker.length, s + marker.length + selected.length);
    });
  };

  const setLineAlign = (align: "left" | "center" | "right") => {
    const el = editRef.current;
    if (!el) return;
    const { selectionStart: s, value } = el;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    let lineEnd = value.indexOf("\n", s);
    if (lineEnd === -1) lineEnd = value.length;
    let line = value.slice(lineStart, lineEnd).replace(/^\[(c|r)\] /, "");
    if (align === "center") line = "[c] " + line;
    if (align === "right") line = "[r] " + line;
    const next = value.slice(0, lineStart) + line + value.slice(lineEnd);
    setDraft(next);
    requestAnimationFrame(() => el.focus());
  };

  const onEditKeys = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      wrapSelection("**");
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrapSelection("*");
    }
    if (e.key === "Escape") saveEdit();
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
      align: "left",
    };
    void patch(active.id, { attachments: [...active.attachments, attachment] });
  };

  const cycleAlign = (i: number) => {
    if (!active) return;
    const order: NoteAttachment["align"][] = ["left", "right", "full"];
    const next = active.attachments.map((a, j) =>
      j === i
        ? { ...a, align: order[(order.indexOf(a.align ?? "left") + 1) % order.length] }
        : a
    );
    void patch(active.id, { attachments: next });
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

  const attachmentEls = (interactive: boolean) =>
    active?.attachments.map((a, i) => (
      <span className={`note-float ${a.align ?? "left"}`} key={i}>
        {a.type === "video" ? (
          <video src={a.url} controls preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.url} alt="" />
        )}
        {interactive && (
          <span className="note-float-tools">
            <button
              type="button"
              title={`Position: ${a.align ?? "left"} — click to move`}
              onClick={(e) => {
                e.stopPropagation();
                cycleAlign(i);
              }}
            >
              ⇄
            </button>
            <button
              type="button"
              title="Remove"
              onClick={(e) => {
                e.stopPropagation();
                removeAttachment(i);
              }}
            >
              ✕
            </button>
          </span>
        )}
      </span>
    ));

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
          Your private scratchpad — hit + to start a note. Only you can see
          these.
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
              <IconCamera size={14} />
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

          {editing && (
            <div className="note-toolbar">
              <button type="button" className="fmt-btn" title="Bold (Ctrl/Cmd+B)" onClick={() => wrapSelection("**")}>B</button>
              <button type="button" className="fmt-btn italic" title="Italic (Ctrl/Cmd+I)" onClick={() => wrapSelection("*")}>I</button>
              <span className="note-toolbar-sep" />
              <button type="button" className="fmt-btn" title="Align left" onClick={() => setLineAlign("left")}>⯇</button>
              <button type="button" className="fmt-btn" title="Center" onClick={() => setLineAlign("center")}>≡</button>
              <button type="button" className="fmt-btn" title="Align right" onClick={() => setLineAlign("right")}>⯈</button>
              <button type="button" className="btn" style={{ marginLeft: "auto", padding: "6px 14px", fontSize: 11 }} onClick={saveEdit}>
                Done
              </button>
            </div>
          )}

          <div
            className="note-box"
            ref={boxRef}
            style={{ height: active.height }}
            onMouseUp={persistHeight}
          >
            {editing ? (
              <div className="note-edit-wrap">
                <textarea
                  ref={editRef}
                  className="note-edit"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onEditKeys}
                  placeholder={"Dump ideas here…\n[ ] a checkbox\n**bold** and *italic* work"}
                  autoFocus
                />
                {active.attachments.length > 0 && (
                  <div className="note-edit-media">{attachmentEls(true)}</div>
                )}
              </div>
            ) : (
              <div className="note-view" onClick={startEdit}>
                {attachmentEls(true)}
                {active.body.trim() === "" && active.attachments.length === 0 ? (
                  <span className="panel-note">Click to write…</span>
                ) : (
                  active.body.split("\n").map((rawLine, i) => {
                    const { align, text } = lineAlign(rawLine);
                    const m = text.match(/^\s*\[( |x)\]\s?(.*)$/i);
                    if (m) {
                      const checked = m[1].toLowerCase() === "x";
                      return (
                        <label
                          key={i}
                          className="note-check"
                          style={{ justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const lines = active.body.split("\n");
                              lines[i] = checked
                                ? rawLine.replace(/\[x\]/i, "[ ]")
                                : rawLine.replace("[ ]", "[x]");
                              void patch(active.id, { body: lines.join("\n") });
                            }}
                          />
                          <span className={checked ? "done" : ""}>{renderInline(m[2])}</span>
                        </label>
                      );
                    }
                    return (
                      <div key={i} style={{ textAlign: align }}>
                        {text ? renderInline(text) : " "}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <p className="note-hint">
            Click to edit · <code>[ ]</code> makes a checkbox · ⇄ on a photo
            moves it (text wraps) · drag the bottom edge to stretch
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
