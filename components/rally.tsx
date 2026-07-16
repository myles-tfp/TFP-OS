"use client";

import { useEffect, useState } from "react";
import { RallyIcon } from "@/components/rally-icon";

export function RallyNavItem() {
  return (
    <button
      type="button"
      className="nav-item soon rally-nav"
      onClick={() => window.dispatchEvent(new CustomEvent("rally:toggle"))}
    >
      <span className="rally-nav-icon">
        <RallyIcon size={20} animated={false} />
      </span>
      Rally
      <span className="soon-pill">Soon</span>
    </button>
  );
}

export function RallyPanel() {
  const [open, setOpen] = useState(false);

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

      <div className="rally-coming">
        <RallyIcon size={130} />
        <h3>Coming soon</h3>
        <p>
          Rally is in training. Soon he&apos;ll answer your questions straight
          from the TFP playbooks, resources, and updates — always the current
          version, never a guess.
        </p>
      </div>
    </aside>
  );
}
