"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { memberTitle, initials } from "@/lib/identity";
import { timeAgo } from "@/lib/format";

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
  franchisees: Author | null;
  chat_reactions: { franchisee_id: string; emoji: string }[];
};

type Channel = {
  id: string;
  name: string;
  sort_order: number;
  location_id: string;
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

function renderBody(text: string) {
  return text.split(/(@[\w.-]+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="mention">{part}</span>
    ) : (
      part
    )
  );
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  const supabase = createClient();

  const loadChannels = useCallback(async () => {
    const [{ data: chans }, { data: reads }] = await Promise.all([
      supabase
        .from("chat_channels")
        .select("id, name, sort_order, location_id, locations(name)")
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
          "id, channel_id, author_id, body, created_at, franchisees(display_name, email, avatar_url, locations(name)), chat_reactions(franchisee_id, emoji)"
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

  // keep the active channel inside the selected location
  useEffect(() => {
    if (!selLoc || channels.length === 0) return;
    const inLoc = channels.filter((c) => c.location_id === selLoc);
    if (inLoc.length > 0 && !inLoc.some((c) => c.id === activeId)) {
      setActiveId(inLoc[0].id);
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
    if (!text || !activeId || busy) return;
    setBusy(true);
    setDraft("");
    const { error } = await supabase.from("chat_messages").insert({
      channel_id: activeId,
      author_id: meId,
      body: text,
    });
    if (error) window.alert(`Couldn't send: ${error.message}`);
    await loadMessages(activeId);
    setBusy(false);
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
      (!term || c.name.toLowerCase().includes(term))
  );

  const active = channels.find((c) => c.id === activeId);

  return (
    <aside className={`chat-panel${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="chat-rail">
        {isAdmin && groups.size > 1 && (
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
      </div>

      <div className="chat-main">
        <div className="chat-head">
          <h2>
            {active
              ? `# ${active.name}${isAdmin && active.locations ? ` · ${active.locations.name}` : ""}`
              : "Chat"}
          </h2>
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
                      <span className="t">{timeAgo(m.created_at)}</span>
                    </div>
                    <div className="chat-msg-text">{renderBody(m.body)}</div>
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

        <form className="rally-input" onSubmit={send}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message # ${active?.name ?? ""}… (@ to tag)`}
            aria-label="Chat message"
          />
          <button type="submit" className="btn" disabled={!draft.trim() || busy}>
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}
