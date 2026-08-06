import Image from "next/image";
import Link from "next/link";
import { NavItem } from "@/components/nav-item";
import { ChatNavItem } from "@/components/chat";
import { HubSwitcher } from "@/components/hub-switcher";
import type { Franchisee, MyHub } from "@/lib/types";
import pkg from "@/package.json";

export type Topic = {
  id: string;
  name: string;
  status: "live" | "coming_soon";
};

export function Sidebar({
  franchisee,
  topics,
  chatUnread = 0,
  hubs = [],
}: {
  franchisee: Franchisee;
  topics: Topic[];
  chatUnread?: number;
  hubs?: MyHub[];
}) {
  const isAdmin = franchisee.role === "admin" || franchisee.role === "owner";
  const isManager = franchisee.location_role === "manager" && !!franchisee.location_id;

  return (
    <aside className="sidebar">
      <div className="brand">
        <Image
          src="/Full_Logo_Green.png"
          alt="The Flying Pickle"
          width={150}
          height={78}
          priority
        />
        <div className="os-tag">Operating System v{pkg.version} · Beta</div>
      </div>

      <div className="nav-group">
        <HubSwitcher hubs={hubs} canCreate={isAdmin || isManager} />
        <NavItem name="Home" href="/" />
        <NavItem name="Saved" href="/saved" />
        <ChatNavItem unread={chatUnread} />
        {topics
          .filter((t) => t.name === "Resources")
          .map((t) => (
            <NavItem key={t.id} name={t.name} href={`/boards/${t.id}`} />
          ))}
      </div>

      <div className="nav-group">
        <p className="nav-label">Boards</p>
        {topics
          .filter((t) => t.name !== "Resources")
          .map((t) => (
            <NavItem
              key={t.id}
              name={t.name}
              href={t.status === "live" ? `/boards/${t.id}` : null}
              soon={t.status !== "live"}
            />
          ))}
      </div>

      {(isAdmin || isManager) && (
        <div className="nav-group">
          <p className="nav-label">Manage</p>
          {isAdmin && <NavItem name="Admin" href="/admin" />}
          {isManager && <NavItem name="Team" href="/team" />}
        </div>
      )}

      <div className="sidebar-foot">
        <Link href="/account" className="who" style={{ display: "block", textDecoration: "none" }}>
          {franchisee.email}
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="signout">
            Sign out
          </button>
        </form>
        <div className="role-pill">
          <span className="dot" />
          {franchisee.role === "owner"
            ? "Account Owner"
            : isAdmin
              ? "Admin"
              : franchisee.location_role === "manager"
                ? "Manager"
                : "Team member"}
        </div>
      </div>
    </aside>
  );
}
