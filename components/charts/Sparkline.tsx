/**
 * Enkel kurslinje i SVG (server-renderad, inget diagrambibliotek). Grön/röd efter utvecklingen
 * över perioden. Huvudgraferna i fas 3 får ett riktigt diagrambibliotek med axlar och tooltip.
 */
export function Sparkline({ values, className = "h-48 w-full", label }: { values: number[]; className?: string; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 800;
  const H = 220;
  const pad = 8;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * W, pad + (1 - (v - min) / span) * (H - 2 * pad)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const up = values.at(-1)! >= values[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} role="img" aria-label={label}>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} className={up ? "fill-up/8" : "fill-down/8"} />
      <path d={line} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" className={up ? "stroke-up" : "stroke-down"} />
    </svg>
  );
}
