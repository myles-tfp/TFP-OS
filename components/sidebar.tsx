import Image from "next/image";
import { NavItem } from "@/components/nav-item";
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
        <NavItem name="AI Assistant" href={null} soon />
      </div>

      {franchisee.role === "admin" && (
        <div className="nav-group">
          <p className="nav-label">Manage</p>
          <NavItem name="Admin" href="/admin" />
        </div>
      )}

      <div className="sidebar-foot">
        <div className="who">{franchisee.email}</div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="signout">
            Sign out
          </button>
        </form>
        <div className="role-pill">
          <span className="dot" />
          {franchisee.role === "admin" ? "Admin" : "Franchisee"}
        </div>
      </div>
    </aside>
  );
}
