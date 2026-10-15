import { Card } from "@/components/ui/Card";
import { SegmentedPreview } from "@/components/ui/Segmented";

/**
 * Platshållare för huvudgrafen "portfölj vs jämförelseindex" (byggs i fas 3).
 * Visar layouten: periodväljare, serier indexerade till 100 och förklaring.
 */
export function PerformancePlaceholder() {
  return (
    <Card
      title="Portfölj mot jämförelseindex"
      description="Avkastning indexerad till 100 vid periodens start"
      action={<SegmentedPreview label="Period" options={["1M", "3M", "I år", "1 år", "3 år", "Max"]} selected="I år" />}
    >
      <div className="relative">
        <svg viewBox="0 0 800 260" className="h-56 w-full sm:h-72" preserveAspectRatio="none" aria-hidden>
          {[30, 95, 160, 225].map((y) => (
            <line key={y} x1="0" x2="800" y1={y} y2={y} className="stroke-line" strokeWidth="1" />
          ))}
          <path
            d="M0 190 C 60 182, 100 160, 160 166 S 260 130, 320 138 S 420 106, 480 114 S 600 74, 660 82 S 760 56, 800 48"
            fill="none"
            className="stroke-series-1/30"
            strokeWidth="2.5"
          />
          <path
            d="M0 190 C 70 188, 120 178, 180 180 S 290 160, 350 164 S 460 142, 520 148 S 640 128, 700 130 S 770 118, 800 116"
            fill="none"
            className="stroke-series-2/40"
            strokeWidth="2.5"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="max-w-sm rounded-md bg-surface/90 px-6 py-5 text-center shadow-pop backdrop-blur-sm">
            <p className="text-ink">Grafen kopplas in i fas 3</p>
            <p className="mt-1 text-sm text-ink-muted">
              När transaktioner och dagliga kurser finns visas portföljens tidsviktade avkastning mot de index ni väljer.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-2 rounded-full bg-fill px-3 py-1 text-ink"><span className="size-2 rounded-full bg-series-1" /> Portföljen</span>
        <span className="flex items-center gap-2 rounded-full bg-fill px-3 py-1 text-ink"><span className="size-2 rounded-full bg-series-2" /> OMXS30</span>
        <span className="rounded-full px-3 py-1 text-ink-subtle">+ Lägg till index</span>
      </div>
    </Card>
  );
}
