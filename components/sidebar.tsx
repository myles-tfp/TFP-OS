import Image from "next/image";
import Link from "next/link";
import { NavItem } from "@/components/nav-item";
import { ChatNavItem } from "@/components/chat";
import type { Franchisee } from "@/lib/types";

export type Topic = {
  id: string;
  name: string;
  status: "live" | "coming_soon";
};

export function Sidebar({
  franchisee,
  topics,
}: {
  franchisee: Franchisee;
  topics: Topic[];
}) {
  const isAdmin = franchisee.role === "admin";
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
      </div>

      <div className="nav-group">
        <p className="nav-label">This Week</p>
        <NavItem name="Home" href="/" />
        <NavItem name="Saved" href="/saved" />
        <ChatNavItem />
      </div>

      <div className="nav-group">
        <p className="nav-label">Boards</p>
        {topics.map((t) => (
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
          {isAdmin ? "Admin" : franchisee.location_role === "manager" ? "Manager" : "Team member"}
        </div>
      </div>
    </aside>
  );
}
