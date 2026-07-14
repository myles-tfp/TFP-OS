import Image from "next/image";
import Link from "next/link";
import type { Franchisee } from "@/lib/types";

/**
 * Nav structure. "This Week" and "Manage" are fixed app sections; the
 * "Resources" group will be driven by resource_categories rows once the
 * library ships (categories are data, not code).
 */
const NAV_GROUPS: {
  label: string;
  items: { name: string; href: string | null }[];
  adminOnly?: boolean;
}[] = [
  {
    label: "This Week",
    items: [
      { name: "Home", href: "/" },
      { name: "Announcements", href: null }, // ships with the feed
    ],
  },
  {
    label: "Resources",
    items: [
      { name: "Marketing", href: null }, // ships with the resource library
      { name: "Playbooks", href: null },
      { name: "AI Assistant", href: null }, // phase 2
    ],
  },
  {
    label: "Manage",
    adminOnly: true,
    items: [{ name: "Admin", href: null }], // ships with the admin dashboard
  },
];

export function Sidebar({ franchisee }: { franchisee: Franchisee }) {
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

      {NAV_GROUPS.filter((g) => !g.adminOnly || franchisee.role === "admin").map(
        (group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-label">{group.label}</p>
            {group.items.map((item) =>
              item.href ? (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`nav-item${item.href === "/" ? " active" : ""}`}
                >
                  <span className="dot" />
                  {item.name}
                </Link>
              ) : (
                <a
                  key={item.name}
                  className="nav-item"
                  title="Coming soon"
                  aria-disabled="true"
                >
                  <span className="dot" />
                  {item.name}
                </a>
              )
            )}
          </div>
        )
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
