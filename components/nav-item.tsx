"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavItem({ name, href }: { name: string; href: string | null }) {
  const pathname = usePathname();

  if (!href) {
    return (
      <a className="nav-item" title="Coming soon" aria-disabled="true">
        <span className="dot" />
        {name}
      </a>
    );
  }

  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} className={`nav-item${active ? " active" : ""}`}>
      <span className="dot" />
      {name}
    </Link>
  );
}
