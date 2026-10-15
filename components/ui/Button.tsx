import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm text-center font-normal transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-primary-hover",
  secondary: "bg-fill text-ink hover:bg-fill-hover",
  ghost: "text-ink-muted hover:bg-fill hover:text-ink",
  danger: "bg-down text-white hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "min-h-8 px-3 py-1 text-sm",
  md: "min-h-10 px-4 py-2 text-[0.9375rem]",
};

/** En knappstil överallt (DESIGN.md §5). Används även för <Link> som ser ut som knappar. */
export function buttonStyles({ variant = "primary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className = "", type = "button", ...rest }: Props) {
  return <button type={type} className={`${buttonStyles({ variant, size })} ${className}`} {...rest} />;
}
