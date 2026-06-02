"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/audit", label: "Audit" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/qa", label: "QA Gate" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              active
                ? "text-[var(--foreground)] bg-[var(--panel)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]"
            }`}
          >
            {active && <span className="text-[var(--accent-green)] mr-1">·</span>}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
