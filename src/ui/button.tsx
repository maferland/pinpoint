import type { ButtonHTMLAttributes } from "react";

type Variant = "accent" | "good" | "ghost" | "surface";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<Variant, string> = {
  accent:  "bg-accent text-white hover:opacity-90",
  good:    "bg-good   text-white hover:opacity-90",
  ghost:   "text-muted hover:text-txt hover:bg-bg2",
  surface: "bg-surface border border-border text-txt hover:bg-bg2",
};

const SIZE_CLASSES = {
  sm: "h-[28px] px-2.5 text-[11px] rounded-lg",
  md: "h-[34px] px-3   text-[13px] rounded-[9px]",
};

export function Button({
  variant = "accent",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-all select-none disabled:opacity-50 cursor-pointer disabled:cursor-default ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
