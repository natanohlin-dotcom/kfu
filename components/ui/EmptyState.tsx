import type { ReactNode } from "react";

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-2 py-6 text-center">
      {icon && (
        <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-fill text-ink-muted">{icon}</div>
      )}
      <p className="text-ink">{title}</p>
      {children && <div className="max-w-xs text-sm text-ink-muted">{children}</div>}
    </div>
  );
}
