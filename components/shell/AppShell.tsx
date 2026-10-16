"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, Search, X } from "lucide-react";
import { CommandPalette } from "@/components/market/CommandPalette";
import { GROUP_ORDER, type NavModule } from "@/lib/modules";
import type { PublicUser } from "@/lib/users";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { Brand } from "./Brand";
import { ICONS } from "./icons";

type Props = {
  user: PublicUser;
  modules: NavModule[];
  /** true när marknadsdatan kommer från demoleverantören (MARKET_PROVIDER=demo) */
  demoData?: boolean;
  children: ReactNode;
};

export function AppShell({ user, modules, demoData = false, children }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  // Menyn är öppen för den sida den öppnades på, så den stängs av sig själv vid sidbyte
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean) => setOpenAt(value ? pathname : null);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidomeny: fast på stora skärmar, låda på små */}
      <div
        className={`fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px] transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-canvas transition-transform lg:translate-x-0 ${
          open ? "translate-x-0 shadow-pop" : "-translate-x-full"
        }`}
        aria-label="Huvudmeny"
      >
        <div className="flex h-20 items-center justify-between px-5">
          <Brand />
          <button
            type="button"
            className="rounded-sm p-2 text-ink-muted hover:bg-fill hover:text-ink lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Stäng menyn"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex min-h-10 w-full items-center gap-3 rounded-sm bg-fill px-3 text-ink-muted transition-colors hover:bg-fill-hover hover:text-ink"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Sök</span>
            <kbd className="rounded-[6px] bg-surface px-1.5 py-0.5 font-sans text-[0.6875rem] text-ink-subtle">⌘K</kbd>
          </button>
        </div>
        <Nav modules={modules} pathname={pathname} />
        {demoData && (
          <p className="mx-3 mb-1 rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn" title="MARKET_PROVIDER=demo">
            Demodata: kurserna är påhittade (lokal utveckling)
          </p>
        )}
        <UserBox user={user} />
      </aside>

      {/* Toppfält på små skärmar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-canvas/85 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          className="-ml-1 rounded-sm p-2 text-ink hover:bg-fill"
          onClick={() => setOpen(true)}
          aria-label="Öppna menyn"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
        <Brand />
        <button
          type="button"
          className="-mr-1 ml-auto rounded-sm p-2 text-ink hover:bg-fill"
          onClick={() => setSearchOpen(true)}
          aria-label="Sök värdepapper"
        >
          <Search className="size-5" />
        </button>
      </header>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-12 sm:px-6 lg:px-12 lg:pt-12">{children}</main>
    </div>
  );
}

function Nav({ modules, pathname }: { modules: NavModule[]; pathname: string }) {
  // Mest specifika träffen är aktiv (så att Transaktioner inte även markerar Innehav)
  const active = modules
    .filter((m) => m.enabled && (pathname === m.href || pathname.startsWith(`${m.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4">
      {GROUP_ORDER.map((group) => {
        const items = modules.filter((m) => m.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className="mb-4">
            {group !== "Start" && (
              <div className="px-3 pb-1 text-[0.8125rem] text-ink-subtle">
                {group}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((m) => {
                const Icon = ICONS[m.icon];
                const isActive = active?.id === m.id;
                const cls = "flex min-h-10 items-center gap-3 rounded-sm px-3 py-2 transition-colors";
                if (!m.enabled) {
                  return (
                    <li key={m.id}>
                      <span className={`${cls} cursor-default text-ink-subtle`} title={`Byggs i fas ${m.phase}`}>
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="flex-1">{m.label}</span>
                        <span className="rounded-full bg-fill px-2 py-px text-[0.6875rem] text-ink-subtle">snart</span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={m.id}>
                    <Link
                      href={m.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`${cls} ${
                        isActive ? "bg-fill-strong text-ink" : "text-ink-muted hover:bg-fill hover:text-ink"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {m.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserBox({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const initials = user.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="m-3 flex items-center gap-3 rounded-md bg-fill px-3 py-3">
      <div
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-xs text-ink"
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm text-ink">{user.displayName}</div>
        <div className="truncate text-xs text-ink-muted">{ROLE_LABELS[user.role]}</div>
      </div>
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        className="rounded-sm p-2 text-ink-muted hover:bg-fill-hover hover:text-ink disabled:opacity-50"
        aria-label="Logga ut"
        title="Logga ut"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
