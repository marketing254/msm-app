"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/reports", label: "Reports", exact: false },
  { href: "/reports/new", label: "New report", exact: true },
  { href: "/settings", label: "Settings", exact: false },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav>
      {LINKS.map((l) => {
        const on = l.exact ? path === l.href : path.startsWith(l.href) && !(l.href === "/reports" && path === "/reports/new");
        return <Link key={l.href} href={l.href} className={on ? "on" : ""}>{l.label}</Link>;
      })}
    </nav>
  );
}
