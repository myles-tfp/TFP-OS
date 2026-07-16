import Image from "next/image";
import { NavItem } from "@/components/nav-item";
import type { Franchisee } from "@/lib/types";

export function Sidebar({
  franchisee,
  categories,
}: {
  franchisee: Franchisee;
  categories: { id: string; name: string }[];
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
        <NavItem name="Announcements" href={null} />
      </div>

      <div className="nav-group">
        <p className="nav-label">Resources</p>
        {categories.map((cat) => (
          <NavItem key={cat.id} name={cat.name} href={`/resources/${cat.id}`} />
        ))}
        <NavItem name="AI Assistant" href={null} />
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
