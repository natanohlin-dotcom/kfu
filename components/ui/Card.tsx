import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** "surface" = vit yta (standard), "fill" = grå ruta för sekundärt innehåll */
  tone?: "surface" | "fill";
  /** Ta bort innerpadding (t.ex. för tabeller kant i kant) */
  flush?: boolean;
};

/** Vit yta, 24 px rundning, ingen ram och ingen avdelare (DESIGN.md §5). */
export function Card({ title, description, action, children, className = "", tone = "surface", flush = false }: Props) {
  return (
    <section className={`rounded-lg ${tone === "fill" ? "bg-fill" : "bg-surface"} ${flush ? "" : "p-6"} ${className}`}>
      {(title || action) && (
        <header className={`flex flex-wrap items-start justify-between gap-3 ${flush ? "px-6 pt-6" : ""} mb-5`}>
          <div className="min-w-0">
            {title && <h2 className="text-[1.0625rem] text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
