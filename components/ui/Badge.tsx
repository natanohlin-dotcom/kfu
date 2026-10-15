import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "brand" | "up" | "down" | "warn";

const tones: Record<Tone, string> = {
  neutral: "bg-fill text-ink-muted",
  accent: "bg-accent-soft text-accent",
  brand: "bg-brand-soft text-warn",
  up: "bg-up-soft text-up",
  down: "bg-down-soft text-down",
  warn: "bg-warn-soft text-warn",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
