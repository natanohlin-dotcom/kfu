import type { ReactNode } from "react";

/** Sidrubrik i serif (DESIGN.md §3). En per sida. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 lg:mb-10">
      <div className="min-w-0">
        <h1 className="font-display text-[2.125rem] leading-[1.1] font-medium tracking-[-0.01em] text-ink sm:text-[2.75rem]">
          {title}
        </h1>
        {description && <p className="mt-2 text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
