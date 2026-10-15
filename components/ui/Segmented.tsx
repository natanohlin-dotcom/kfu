/**
 * Segmenterad väljare (DESIGN.md §5): grå behållare, valt alternativ som vit pill.
 * Fas 1 visar bara utseendet; blir interaktiv när grafen kopplas in.
 */
export function SegmentedPreview({ options, selected, label }: { options: string[]; selected: string; label: string }) {
  return (
    <div className="flex rounded-sm bg-fill p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <span
          key={o}
          aria-current={o === selected ? "true" : undefined}
          className={`rounded-[7px] px-2.5 py-1 text-[0.8125rem] ${o === selected ? "bg-surface text-ink" : "text-ink-muted"}`}
        >
          {o}
        </span>
      ))}
    </div>
  );
}
