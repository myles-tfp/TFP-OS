"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavItem({
  name,
  href,
  soon = false,
}: {
  name: string;
  href: string | null;
  soon?: boolean;
}) {
  const pathname = usePathname();

  if (!href || soon) {
    return (
      <a className="nav-item soon" title="Coming soon" aria-disabled="true">
        <span className="dot" />
        {name}
        <span className="soon-pill">Soon</span>
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
