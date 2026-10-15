import Image from "next/image";

/** Emblem + namn (DESIGN.md §6). Emblemet är dekorativt här; namnet står i text bredvid. */
export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const px = size === "lg" ? 56 : 40;
  return (
    <div className="flex items-center gap-3">
      <Image src="/brand/kfu-logo.svg" alt="" width={px} height={px} className="shrink-0" priority />
      <div className="min-w-0 leading-tight">
        <div className={`font-display font-semibold text-ink ${size === "lg" ? "text-2xl" : "text-[1.1875rem]"}`}>
          Kapitalförvaltning
        </div>
        <div className="truncate text-xs text-ink-muted">I-sektionen · Uppsala</div>
      </div>
    </div>
  );
}
