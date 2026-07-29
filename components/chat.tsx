"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { memberTitle, initials } from "@/lib/identity";
import { timeAgo } from "@/lib/format";
import { IconDots } from "@/components/icons";

const EMOJIS = ["👍", "🔥", "✅"];

type Author = {
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  locations: { name: string } | null;
};

type ChatMessage = {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  media_url: string | null;
  media_type: string | null;
  franchisees: Author | null;
  chat_reactions: { franchisee_id: string; emoji: string }[];
};

const EDIT_WINDOW_MS = 3 * 60 * 1000;

type Channel = {
  id: string;
  name: string;
  sort_order: number;
  location_id: string;
  archived: boolean;
  locations: { name: string } | null;
};

type SearchHit = {
  id: string;
  body: string;
  channel_id: string;
  created_at: string;
  chat_channels: { name: string; locations: { name: string } | null } | null;
};

export function ChatNavItem({ unread }: { unread: number }) {
  return (
    <button
      type="button"
      className="nav-item rally-nav"
      onClick={() => window.dispatchEvent(new CustomEvent("chat:toggle"))}
    >
      <span className="dot" />
      Chat
      {unread > 0 && (
        <span className="chat-unread" style={{ marginLeft: "auto" }}>
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

/** Markdown-lite: **bold**, *italic*, and @mentions. */
function renderBody(text: string) {
  return text
    .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|@[\w.-]+)/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("@")) {
        return <span key={i} className="mention">{part}</span>;
      }
      return part;
    });
}

export function ChatPanel({
  meId,
  isAdmin,
  canManage,
  myLocationId,
}: {
  meId: string;
  isAdmin: boolean;
  canManage: boolean;
  myLocationId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selLoc, setSelLoc] = useState<string | null>(myLocationId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [chanMenu, setChanMenu] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQ, setGifQ] = useState("");
  const [gifs, setGifs] = useState<{ id: string; preview: string; full: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  /** Wrap the current selection in ** or * (toolbar + Cmd/Ctrl+B/I). */
  const applyFormat = (marker: "**" | "*") => {
    const el = inputRef.current;
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

  const onInputKeys = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      applyFormat("**");
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      applyFormat("*");
    }
  };

  const supabase = createClient();

  const loadChannels = useCallback(async () => {
    const [{ data: chans }, { data: reads }] = await Promise.all([
      supabase
        .from("chat_channels")
        .select("id, name, sort_order, location_id, archived, locations(name)")
        .order("sort_order"),
      supabase.from("chat_reads").select("channel_id, last_read_at"),
    ]);
    const list = (chans ?? []) as unknown as Channel[];
    setChannels(list);
    setSelLoc((prev) => prev ?? myLocationId ?? list[0]?.location_id ?? null);

    if (list.length > 0) {
      const readMap = new Map(
        (reads ?? []).map((r) => [r.channel_id, r.last_read_at])
      );
      const { data: recent } = await supabase
        .from("chat_messages")
        .select("channel_id, created_at, author_id")
        .in("channel_id", list.map((c) => c.id))
        .order("created_at", { ascending: false })
        .limit(500);
      const counts: Record<string, number> = {};
      for (const m of recent ?? []) {
        if (m.author_id === meId) continue;
        const seen = readMap.get(m.channel_id);
        if (!seen || new Date(m.created_at) > new Date(seen)) {
          counts[m.channel_id] = (counts[m.channel_id] ?? 0) + 1;
        }
      }
      setUnread(counts);
    }
  }, [supabase, meId, myLocationId]);

  const loadMessages = useCallback(
    async (channelId: string) => {
      const { data } = await supabase
        .from("chat_messages")
        .select(
          "id, channel_id, author_id, body, created_at, edited_at, media_url, media_type, franchisees(display_name, email, avatar_url, locations(name)), chat_reactions(franchisee_id, emoji)"
        )
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data ?? []) as unknown as ChatMessage[]);
      await supabase.from("chat_reads").upsert({
        channel_id: channelId,
        franchisee_id: meId,
        last_read_at: new Date().toISOString(),
      });
      setUnread((u) => ({ ...u, [channelId]: 0 }));
    },
    [supabase, meId]
  );

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener("chat:toggle", toggle);
    if (window.location.hash === "#chat") setOpen(true);
    return () => window.removeEventListener("chat:toggle", toggle);
  }, []);

  // Rally politely scoots left while chat is open
  useEffect(() => {
    document.body.classList.toggle("chat-open", open);
    return () => document.body.classList.remove("chat-open");
  }, [open]);

  useEffect(() => {
    if (open) void loadChannels();
  }, [open, loadChannels]);

  useEffect(() => {
    if (open && activeId) void loadMessages(activeId);
  }, [open, activeId, loadMessages]);

  // keep the active channel inside the selected location (prefer live ones)
  useEffect(() => {
    if (!selLoc || channels.length === 0) return;
    const inLoc = channels.filter((c) => c.location_id === selLoc);
    const pool = inLoc.filter((c) => !c.archived).length
      ? inLoc.filter((c) => !c.archived)
      : inLoc;
    if (pool.length > 0 && !inLoc.some((c) => c.id === activeId)) {
      setActiveId(pool[0].id);
    }
  }, [selLoc, channels, activeId]);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => {
      if (activeRef.current) void loadMessages(activeRef.current);
      void loadChannels();
    }, 12000);
    return () => window.clearInterval(t);
  }, [open, loadMessages, loadChannels]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, open]);

  // keyword search across accessible messages
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    const t = window.setTimeout(async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, body, channel_id, created_at, chat_channels(name, locations(name))")
        .ilike("body", `%${term}%`)
        .order("created_at", { ascending: false })
        .limit(15);
      setHits((data ?? []) as unknown as SearchHit[]);
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, open, supabase]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && !attachment) || !activeId) return;
    if (busy) {
      // never let a stuck state eat messages — reset and let them retry
      setBusy(false);
      return;
    }
    setBusy(true);
    setErr(null);

    try {
      let media_url: string | null = null;
      let media_type: string | null = null;
      if (attachment) {
        // stored exactly as uploaded — no compression
        const safe = attachment.name.replace(/[^\w.\-]+/g, "_");
        const path = `chat/${meId}-${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, attachment, { upsert: true });
        if (upErr) {
          setErr(`Upload failed: ${upErr.message}`);
          return;
        }
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        media_url = data.publicUrl;
        media_type = attachment.type.startsWith("video") ? "video" : "image";
      }

      const { error } = await supabase.from("chat_messages").insert({
        channel_id: activeId,
        author_id: meId,
        body: text || (media_type === "video" ? "📹" : "🖼️"),
        media_url,
        media_type,
      });
      if (error) {
        setErr(`Couldn't send: ${error.message}`);
        return; // draft is kept so nothing is lost
      }
      setDraft("");
      setAttachment(null);
      await loadMessages(activeId);
    } catch (ex) {
      setErr(`Couldn't send — check your connection and try again. (${String(ex)})`);
    } finally {
      setBusy(false);
    }
  };

  // GIF search (debounced; trending when empty)
  useEffect(() => {
    if (!gifOpen) return;
    setGifLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const resp = await fetch(`/api/giphy?q=${encodeURIComponent(gifQ.trim())}`);
        const data = await resp.json();
        setGifs(resp.ok ? data.gifs : []);
      } catch {
        setGifs([]);
      }
      setGifLoading(false);
    }, 350);
    return () => window.clearTimeout(t);
  }, [gifOpen, gifQ]);

  const sendGif = async (url: string) => {
    if (!activeId) return;
    setGifOpen(false);
    setErr(null);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        channel_id: activeId,
        author_id: meId,
        body: "",
        media_url: url,
        media_type: "image",
      });
      if (error) {
        setErr(`Couldn't send GIF: ${error.message}`);
        return;
      }
      await loadMessages(activeId);
    } catch (ex) {
      setErr(`Couldn't send GIF — check your connection and try again. (${String(ex)})`);
    }
  };

  const archiveChannel = async (c: Channel) => {
    if (
      !window.confirm(
        `Archive # ${c.name}? Nobody can post in it anymore, and only HQ can bring it back. The conversation history is kept.`
      )
    )
      return;
    const { error } = await supabase
      .from("chat_channels")
      .update({ archived: true })
      .eq("id", c.id);
    if (error) window.alert(`Couldn't archive: ${error.message}`);
    void loadChannels();
  };

  const restoreChannel = async (c: Channel) => {
    const { error } = await supabase
      .from("chat_channels")
      .update({ archived: false })
      .eq("id", c.id);
    if (error) window.alert(`Couldn't restore: ${error.message}`);
    void loadChannels();
  };

  const saveEdit = async () => {
    const text = editDraft.trim();
    if (!editingId || !text) return;
    const { error, data } = await supabase
      .from("chat_messages")
      .update({ body: text, edited_at: new Date().toISOString() })
      .eq("id", editingId)
      .select("id");
    if (error || !data?.length) {
      window.alert("Couldn't edit — the 3-minute window may have closed.");
    }
    setEditingId(null);
    setEditDraft("");
    if (activeId) void loadMessages(activeId);
  };

  const toggleReaction = async (messageId: string, emoji: string, mine: boolean) => {
    if (mine) {
      await supabase
        .from("chat_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("franchisee_id", meId)
        .eq("emoji", emoji);
    } else {
      await supabase.from("chat_reactions").insert({
        message_id: messageId,
        franchisee_id: meId,
        emoji,
      });
    }
    if (activeId) void loadMessages(activeId);
  };

  const addChannel = async (locationId: string) => {
    const name = window.prompt("Channel name (e.g. construction):");
    if (!name?.trim()) return;
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const siblings = channels.filter((c) => c.location_id === locationId);
    const maxOrder = Math.max(0, ...siblings.map((c) => c.sort_order));
    const { error } = await supabase.from("chat_channels").insert({
      location_id: locationId,
      name: clean,
      sort_order: maxOrder + 1,
    });
    if (error) window.alert(`Couldn't create: ${error.message}`);
    void loadChannels();
  };

  const term = q.trim().toLowerCase();

  // locations for the dropdown (admins see all; others just theirs)
  const groups = new Map<string, { name: string; channels: Channel[] }>();
  for (const c of channels) {
    const g = groups.get(c.location_id) ?? {
      name: c.locations?.name ?? "Location",
      channels: [],
    };
    g.channels.push(c);
    groups.set(c.location_id, g);
  }

  const locUnread = (locId: string) =>
    channels
      .filter((c) => c.location_id === locId)
      .reduce((sum, c) => sum + (unread[c.id] ?? 0), 0);

  const railChannels = channels.filter(
    (c) =>
      c.location_id === selLoc &&
      !c.archived &&
      (!term || c.name.toLowerCase().includes(term))
  );
  const archivedChannels = channels.filter(
    (c) => c.location_id === selLoc && c.archived
  );

  const active = channels.find((c) => c.id === activeId);

  return (
    <aside className={`chat-panel${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="chat-rail">
        {isAdmin && groups.size > 0 && (
          <select
            className="chat-loc"
            value={selLoc ?? ""}
            onChange={(e) => setSelLoc(e.target.value)}
            title="Location"
          >
            {[...groups.entries()].map(([locId, g]) => (
              <option key={locId} value={locId}>
                {g.name}
                {locUnread(locId) > 0 ? ` (${locUnread(locId)})` : ""}
              </option>
            ))}
          </select>
        )}

        <input
          className="chat-search"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter or search…"
          aria-label="Filter channels or search messages"
        />

        <p className="nav-label" style={{ margin: "2px 0 8px 6px" }}>Channels</p>
        {railChannels.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chat-chan${c.id === activeId ? " on" : ""}`}
            onClick={() => setActiveId(c.id)}
          >
            <span># {c.name}</span>
            {(unread[c.id] ?? 0) > 0 && (
              <span className="chat-unread">{unread[c.id]}</span>
            )}
          </button>
        ))}
        {selLoc && (isAdmin || (canManage && selLoc === myLocationId)) && (
          <button
            type="button"
            className="add-item"
            style={{ paddingLeft: 9 }}
            onClick={() => addChannel(selLoc)}
          >
            + New channel
          </button>
        )}

        {isAdmin && archivedChannels.length > 0 && (
          <details className="chat-archived">
            <summary>Archived ({archivedChannels.length})</summary>
            {archivedChannels.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chat-chan archived${c.id === activeId ? " on" : ""}`}
                onClick={() => setActiveId(c.id)}
              >
                <span># {c.name}</span>
              </button>
            ))}
          </details>
        )}
      </div>

      <div className="chat-main">
        <div className="chat-head">
          <h2>
            {active
              ? `# ${active.name}${isAdmin && active.locations ? ` · ${active.locations.name}` : ""}`
              : "Chat"}
          </h2>
          {active && (isAdmin || (canManage && active.location_id === myLocationId)) && (
            <span className="chan-menu-wrap">
              <button
                type="button"
                className="icon-btn"
                title="Channel options"
                onClick={() => setChanMenu((v) => !v)}
              >
                <IconDots size={14} />
              </button>
              {chanMenu && (
                <span className="chan-menu">
                  {!active.archived ? (
                    <button
                      type="button"
                      onClick={() => {
                        setChanMenu(false);
                        void archiveChannel(active);
                      }}
                    >
                      🗄 Archive channel
                    </button>
                  ) : isAdmin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setChanMenu(false);
                        void restoreChannel(active);
                      }}
                    >
                      ↩ Restore channel
                    </button>
                  ) : null}
                </span>
              )}
            </span>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpen(false)}
            title="Close"
            style={{ marginLeft: "auto" }}
          >
            ✕
          </button>
        </div>

        {hits !== null ? (
          <div className="chat-body">
            <p className="panel-note" style={{ marginBottom: 4 }}>
              {hits.length === 0
                ? `No messages matching “${q.trim()}”`
                : `Messages matching “${q.trim()}” — click to jump`}
            </p>
            {hits.map((h) => (
              <button
                key={h.id}
                type="button"
                className="chat-hit"
                onClick={() => {
                  const chan = channels.find((c) => c.id === h.channel_id);
                  if (chan) setSelLoc(chan.location_id);
                  setActiveId(h.channel_id);
                  setQ("");
                  setHits(null);
                }}
              >
                <span className="m">
                  {h.chat_channels?.locations?.name ?? ""} · #
                  {h.chat_channels?.name ?? ""} · {timeAgo(h.created_at)}
                </span>
                <span className="b">{h.body.slice(0, 90)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="chat-body" ref={bodyRef}>
            {messages.length === 0 && (
              <p className="panel-note" style={{ padding: "8px 2px" }}>
                Nothing here yet — say hi 👋
              </p>
            )}
            {messages.map((m) => {
              const a = m.franchisees;
              const counts: Record<string, { n: number; mine: boolean }> = {};
              for (const r of m.chat_reactions) {
                const c = (counts[r.emoji] ??= { n: 0, mine: false });
                c.n += 1;
                if (r.franchisee_id === meId) c.mine = true;
              }
              return (
                <div className="chat-msg" key={m.id}>
                  {a?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="chat-avatar" src={a.avatar_url} alt="" />
                  ) : (
                    <div className="chat-avatar chat-avatar-fallback">
                      {initials(a?.display_name, a?.email ?? "?")}
                    </div>
                  )}
                  <div className="chat-msg-body">
                    <div className="chat-msg-meta">
                      <span className="n">
                        {memberTitle(a?.locations?.name, a?.display_name, a?.email ?? "unknown")}
                      </span>
                      <span className="t">
                        {timeAgo(m.created_at)}
                        {m.edited_at && " · edited"}
                      </span>
                      {m.author_id === meId &&
                        Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS &&
                        editingId !== m.id && (
                          <button
                            type="button"
                            className="chat-edit-btn"
                            title="Edit (3-minute window)"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditDraft(m.body);
                            }}
                          >
                            edit
                          </button>
                        )}
                    </div>
                    {editingId === m.id ? (
                      <div className="chat-edit-box">
                        <textarea
                          rows={2}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void saveEdit();
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="btn" onClick={() => void saveEdit()}>
                            Save
                          </button>
                          <button type="button" className="btn ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="chat-msg-text">{renderBody(m.body)}</div>
                        {m.media_url && (
                          <div className="chat-attach">
                            {m.media_type === "video" ? (
                              <video src={m.media_url} controls preload="metadata" />
                            ) : (
                              <a href={m.media_url} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={m.media_url} alt="" />
                              </a>
                            )}
                            <a
                              className="chat-attach-dl"
                              href={m.media_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download original
                            </a>
                          </div>
                        )}
                      </>
                    )}
                    <div className="chat-msg-reacts">
                      {Object.entries(counts).map(([emoji, c]) => (
                        <button
                          key={emoji}
                          type="button"
                          className={`react${c.mine ? " on" : ""}`}
                          onClick={() => toggleReaction(m.id, emoji, c.mine)}
                        >
                          <span>{emoji}</span>
                          <span className="n">{c.n}</span>
                        </button>
                      ))}
                      <span className="chat-react-add">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="react"
                            onClick={() =>
                              toggleReaction(m.id, emoji, !!counts[emoji]?.mine)
                            }
                          >
                            {emoji}
                          </button>
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {active?.archived ? (
          <div className="chat-input-wrap" style={{ padding: "14px 16px" }}>
            <p className="panel-note" style={{ margin: 0 }}>
              🗄 This channel is archived — read-only paper trail.
            </p>
          </div>
        ) : (
        <form className="chat-input-wrap" onSubmit={send}>
          {err && (
            <p className="chat-err" role="alert">
              ⚠ {err}
              <button type="button" onClick={() => setErr(null)} title="Dismiss">
                ✕
              </button>
            </p>
          )}
          {gifOpen && (
            <div className="gif-pop">
              <div className="gif-pop-head">
                <input
                  type="text"
                  value={gifQ}
                  onChange={(e) => setGifQ(e.target.value)}
                  placeholder="Search GIFs…"
                  autoFocus
                />
                <span className="gif-credit">Powered by GIPHY</span>
                <button type="button" className="icon-btn" onClick={() => setGifOpen(false)} title="Close">
                  ✕
                </button>
              </div>
              <div className="gif-grid">
                {gifLoading && <p className="panel-note" style={{ padding: 8 }}>Loading…</p>}
                {!gifLoading && gifs.length === 0 && (
                  <p className="panel-note" style={{ padding: 8 }}>Nothing found — try another word.</p>
                )}
                {!gifLoading &&
                  gifs.map((g) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={g.id}
                      src={g.preview}
                      alt=""
                      loading="lazy"
                      onClick={() => void sendGif(g.full)}
                    />
                  ))}
              </div>
            </div>
          )}
          <div className="chat-toolbar">
            <button
              type="button"
              className="fmt-btn"
              title="Bold (Ctrl/Cmd+B)"
              onClick={() => applyFormat("**")}
            >
              B
            </button>
            <button
              type="button"
              className="fmt-btn italic"
              title="Italic (Ctrl/Cmd+I)"
              onClick={() => applyFormat("*")}
            >
              I
            </button>
            <button
              type="button"
              className="fmt-btn"
              title="Send a GIF"
              style={{ width: "auto", padding: "0 7px", fontSize: 10, letterSpacing: ".05em" }}
              onClick={() => setGifOpen((v) => !v)}
            >
              GIF
            </button>
            <label className="fmt-btn" title="Attach photo or video (original quality)" style={{ cursor: "pointer" }}>
              📎
              <input
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setAttachment(f);
                  e.target.value = "";
                }}
              />
            </label>
            {attachment && (
              <span className="chat-attach-chip">
                {attachment.name.slice(0, 24)}
                <button type="button" onClick={() => setAttachment(null)} title="Remove">
                  ✕
                </button>
              </span>
            )}
            <span className="chat-hint">Enter to send · Shift+Enter for a new line</span>
          </div>
          <div className="rally-input" style={{ borderTop: "none", paddingTop: 0 }}>
            <textarea
              ref={inputRef}
              rows={Math.min(5, Math.max(1, draft.split("\n").length))}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onInputKeys}
              placeholder={`Message # ${active?.name ?? ""}… (@ to tag)`}
              aria-label="Chat message"
            />
            <button
              type="submit"
              className="btn"
              disabled={(!draft.trim() && !attachment) || busy}
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
        )}
      </div>
    </aside>
  );
}
