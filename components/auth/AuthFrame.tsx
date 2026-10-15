import Image from "next/image";
import type { ReactNode } from "react";
import { Brand } from "@/components/shell/Brand";

/** Gemensam ram för inloggning och första lösenordsbytet (DESIGN.md §7). */
export function AuthFrame({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden p-4 lg:block">
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-xl bg-fill p-12">
          <p className="text-sm text-ink-muted">Kapitalförvaltningsutskottet · Industriell ekonomi, Uppsala universitet</p>
          <div className="relative z-10">
            <Image src="/brand/kfu-logo.svg" alt="KFU – Kapitalförvaltning, Industriell ekonomi" width={168} height={168} priority />
            <h2 className="mt-10 max-w-md font-display text-[3.5rem] leading-[1.02] font-medium tracking-[-0.015em] text-ink">
              I-Sektionen Kapitalförvaltning
            </h2>
            <p className="mt-5 max-w-sm text-[1.0625rem] text-ink-muted">
              Portfölj, bevakningar, analyser och värdering på ett ställe.
            </p>
          </div>
          {/* Två kurvor i profilens färger: portföljen (blå) mot index (orange) */}
          <svg aria-hidden className="pointer-events-none absolute right-0 bottom-0 w-[85%]" viewBox="0 0 600 220" fill="none">
            <path d="M0 200 C 90 190, 140 150, 210 158 S 320 100, 390 110 S 500 40, 600 20" className="stroke-accent/25" strokeWidth="3" />
            <path d="M0 210 C 100 205, 160 182, 230 186 S 340 150, 410 156 S 520 120, 600 112" className="stroke-brand/35" strokeWidth="3" />
          </svg>
          <span />
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-12 lg:hidden">
            <Brand />
          </div>
          <h1 className="font-display text-[2.5rem] leading-[1.1] font-medium tracking-[-0.01em] text-ink">{title}</h1>
          {intro && <div className="mt-3 text-ink-muted">{intro}</div>}
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </main>
  );
}
