"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/installningar", label: "Konto" },
  { href: "/admin/installningar/jamforelseindex", label: "Jämförelseindex" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Inställningar" className="mb-6 flex w-fit gap-1 rounded-sm bg-fill p-1 lg:mb-8">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-[7px] px-3.5 py-1.5 text-sm transition-colors ${active ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
