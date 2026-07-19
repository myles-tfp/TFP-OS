"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RallyIcon } from "@/components/rally-icon";

type MsgLink = { label: string; href: string; external?: boolean };
type Msg = { role: "user" | "rally"; text: string; links?: MsgLink[] };

const GREETING =
  "Hey, I'm Rally! 🏓 Ask me where to find things — flyers, playbooks, updates — and I'll dig through TFP OS for you. (I'm the training-wheels version: my full AI brain comes later.)";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "what", "where", "when", "how",
  "can", "you", "your", "our", "are", "was", "have", "has", "need", "want",
  "find", "get", "show", "give", "about", "from", "please", "help", "there",
  "any", "some", "all", "one", "two", "not", "but", "just", "like", "its",
]);

function keywords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    ),
  ].slice(0, 4);
}

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
      <span className="soon-pill">Beta</span>
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

  const reply = (msg: Msg) => setMessages((m) => [...m, msg]);

  const answer = async (text: string) => {
    const t = text.toLowerCase().trim();

    // small talk
    if (/^(hi|hey|hello|yo|sup|what'?s up|good (morning|afternoon|evening))\b/.test(t)) {
      reply({
        role: "rally",
        text: "Hey hey! 👋 Ask me things like “where's the flyer kit?” or “grand opening playbook” and I'll fetch what we've got.",
      });
      return;
    }
    if (/thank|thanks|thx/.test(t)) {
      reply({ role: "rally", text: "Anytime! That's what I'm here for. 🏓" });
      return;
    }
    if (/^(help|what can you do)/.test(t)) {
      reply({
        role: "rally",
        text: "I search everything HQ has put into TFP OS — resources, playbooks, and feed updates — and hand you the links. Try naming what you're after, like “social templates” or “pricing”.",
      });
      return;
    }

    const words = keywords(t);
    if (words.length === 0) {
      reply({
        role: "rally",
        text: "Give me a word or two to hunt for — like “flyer”, “playbook”, or “membership”.",
      });
      return;
    }

    setThinking(true);
    const supabase = createClient();
    const resourceOr = words.map((w) => `title.ilike.%${w}%`).join(",");
    const postOr = words
      .flatMap((w) => [`title.ilike.%${w}%`, `body.ilike.%${w}%`])
      .join(",");

    const [{ data: resources }, { data: posts }] = await Promise.all([
      supabase.from("resources").select("id, title, url").or(resourceOr).limit(5),
      supabase.from("posts").select("id, title, body").or(postOr).limit(3),
    ]);
    setThinking(false);

    const links: MsgLink[] = [
      ...(resources ?? []).map((r) => ({
        label: `📄 ${r.title}`,
        href: r.url,
        external: true,
      })),
      ...(posts ?? []).map((p) => ({
        label: `📣 ${p.title || p.body.slice(0, 50)}`,
        href: `/#post-${p.id}`,
      })),
    ];

    if (links.length === 0) {
      reply({
        role: "rally",
        text: "Hmm, nothing in the library matches that yet. Try different words, or ask HQ directly — and once my full brain is plugged in I'll handle trickier questions.",
      });
    } else {
      reply({
        role: "rally",
        text: `Found ${links.length} thing${links.length === 1 ? "" : "s"} for “${words.join(" ")}”:`,
        links,
      });
    }
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text }]);
    void answer(text);
  };

  return (
    <aside className={`rally-panel${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="rally-head">
        <RallyIcon size={40} />
        <div>
          <h2>Rally</h2>
          <p>The TFP assistant · beta</p>
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
            {m.links && (
              <span className="rally-links">
                {m.links.map((l, j) =>
                  l.external ? (
                    <a key={j} href={l.href} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ) : (
                    <a key={j} href={l.href} onClick={() => setOpen(false)}>
                      {l.label}
                    </a>
                  )
                )}
              </span>
            )}
          </div>
        ))}
        {thinking && <div className="rally-msg rally">Digging around…</div>}
      </div>

      <form className="rally-input" onSubmit={send}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Rally… try “flyer kit”"
          aria-label="Message Rally"
        />
        <button type="submit" className="btn" disabled={!draft.trim() || thinking}>
          Send
        </button>
      </form>
    </aside>
  );
}
