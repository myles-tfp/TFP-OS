"use client";

import { usePathname, useRouter } from "next/navigation";
import type { MyHub } from "@/lib/types";

/**
 * The "Main Hub" label, grown up: a workspace switcher.
 * Main Hub = the franchise OS; each Team Hub = a private team space.
 */
export function HubSwitcher({
  hubs,
  canCreate,
}: {
  hubs: MyHub[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = pathname.startsWith("/hub/")
    ? pathname.split("/")[2] ?? "main"
    : "main";

  if (hubs.length === 0 && !canCreate) {
    return <p className="nav-label">Main Hub</p>;
  }

  return (
    <select
      className="hub-switch"
      value={current === "new" ? "new" : current}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "main") router.push("/");
        else if (v === "new") router.push("/hub/new");
        else router.push(`/hub/${v}`);
      }}
      title="Switch workspace"
    >
      <option value="main">Main Hub</option>
      {hubs.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
        </option>
      ))}
      {canCreate && <option value="new">＋ Create Hub…</option>}
    </select>
  );
}
