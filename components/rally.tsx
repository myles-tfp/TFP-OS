"use client";

import { useEffect, useRef, useState } from "react";
import { RallyIcon } from "@/components/rally-icon";

type Msg = { role: "user" | "rally"; text: string };

const GREETING =
  "Hey, I'm Rally! 🏓 Ask me anything about running your location — I answer straight from the TFP playbooks, resources, updates, and your onboarding board.";

/** Turn bare URLs and [label](url) into clickable links. */
function renderText(text: string) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) => {
    const md = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (md) {
      return (
        <a key={i} href={md[2]} target="_blank" rel="noreferrer" className="rally-inline-link">
          {md[1]}
        </a>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer" className="rally-inline-link">
          {part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
          {part.length > 48 ? "…" : ""}
        </a>
      );
    }
    return part;
  });
}

export function RallyBubble() {
  return (
    <button
      type="button"
      className="rally-bubble"
      onClick={() => window.dispatchEvent(new CustomEvent("rally:toggle"))}
      title="Ask Rally"
      aria-label="Ask Rally, the TFP assistant"
    >
      <RallyIcon size={38} />
    </button>
  );
}

export function RallyPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "rally", text: GREETING }]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("rally:toggle", toggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("rally:toggle", toggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, thinking]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");

    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages(next);
    setThinking(true);

    try {
      const resp = await fetch("/api/rally", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next
            .slice(1) // drop the canned greeting
            .slice(-10)
            .map((m) => ({
              role: m.role === "rally" ? "assistant" : "user",
              content: m.text,
            })),
        }),
      });
      const data = await resp.json();
      setMessages((m) => [
        ...m,
        {
          role: "rally",
          text: resp.ok
            ? data.text
            : data.error ?? "Something went sideways — give it another go.",
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "rally", text: "Couldn't reach my brain just now — try again in a moment." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <aside className={`rally-panel${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="rally-head">
        <RallyIcon size={40} />
        <div>
          <h2>Rally</h2>
          <p>The TFP assistant</p>
        </div>
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

      <div className="rally-body" ref={bodyRef}>
        {messages.map((m, i) => (
          <div key={i} className={`rally-msg ${m.role}`}>
            {m.role === "rally" ? renderText(m.text) : m.text}
          </div>
        ))}
        {thinking && <div className="rally-msg rally rally-thinking">Thinking…</div>}
      </div>

      <form className="rally-input" onSubmit={send}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Rally anything…"
          aria-label="Message Rally"
        />
        <button type="submit" className="btn" disabled={!draft.trim() || thinking}>
          Send
        </button>
      </form>
    </aside>
  );
}
