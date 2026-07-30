"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";
import { IconBell, IconMegaphone, IconDoc, IconCheck, IconChat } from "@/components/icons";

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
};

const KIND_ICONS: Record<string, React.ReactNode> = {
  post: <IconMegaphone size={16} />,
  resource: <IconDoc size={16} />,
  task: <IconCheck size={16} />,
  chat: <IconChat size={16} />,
};

export function NotificationBell({
  items,
  unseen,
}: {
  items: Notification[];
  unseen: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unseen > 0) {
      const supabase = createClient();
      await supabase.rpc("mark_notifications_seen");
      router.refresh();
    }
  };

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="bell"
        onClick={toggle}
        title="Notifications"
        aria-label={`Notifications${unseen > 0 ? `, ${unseen} new` : ""}`}
      >
        <IconBell size={19} />
        {unseen > 0 && <span className="bell-badge">{unseen > 9 ? "9+" : unseen}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-head">Notifications</div>
          {items.length === 0 ? (
            <p className="panel-note" style={{ padding: "4px 16px 14px" }}>
              Nothing yet — new posts, resources, and progress updates land
              here.
            </p>
          ) : (
            items.map((n) => (
              <a
                key={n.id}
                className="bell-item"
                href={n.link ?? "/"}
                onClick={(e) => {
                  setOpen(false);
                  // chat notifications open the chat panel directly
                  if ((n.link ?? "").endsWith("#chat")) {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent("chat:open"));
                  }
                }}
              >
                <span className="bell-icon">{KIND_ICONS[n.kind] ?? "•"}</span>
                <span className="bell-text">
                  <span className="t">{n.title}</span>
                  {n.body && <span className="b">{n.body}</span>}
                  <span className="w">{timeAgo(n.created_at)}</span>
                </span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
