"use client";

import { useEffect, useRef, useState } from "react";
import { RallyIcon } from "@/components/rally-icon";

type Msg = { role: "user" | "rally"; text: string };

const GREETING =
  "Hey, I'm Rally! 🏓 Soon I'll be answering your questions straight from the TFP playbooks, resources, and updates. HQ is still wiring up my brain — but say hi anyway!";

const CANNED_REPLY =
  "Love the enthusiasm! My brain isn't plugged in quite yet — HQ is setting me up. Check back soon and I'll have real answers from the TFP playbooks.";

export function RallyNavItem() {
  return (
    <button
      type="button"
      className="nav-item rally-nav"
      onClick={() => window.dispatchEvent(new CustomEvent("rally:toggle"))}
    >
      <span className="rally-nav-icon">
        <RallyIcon size={20} animated={false} />
      </span>
      Rally
    </button>
  );
}

export function RallyPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "rally", text: GREETING }]);
  const [draft, setDraft] = useState("");
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
  }, [messages, open]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text }]);
    window.setTimeout(() => {
      setMessages((m) => [...m, { role: "rally", text: CANNED_REPLY }]);
    }, 600);
  };

  return (
    <aside className={`rally-panel${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="rally-head">
        <RallyIcon size={44} />
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
            {m.text}
          </div>
        ))}
      </div>

      <form className="rally-input" onSubmit={send}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Rally anything…"
          aria-label="Message Rally"
        />
        <button type="submit" className="btn" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
