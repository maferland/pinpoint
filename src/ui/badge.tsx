import type { ReactNode } from "react";

type BadgeVariant = "accent" | "good" | "muted" | "agent";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  accent: "bg-accent-soft text-accent border border-accent",
  good:   "bg-good-soft   text-good   border border-good",
  muted:  "bg-bg2         text-faint  border border-border",
  agent:  "text-white",
};

export function Badge({ children, variant = "muted", className = "" }: BadgeProps) {
  const agentStyle = variant === "agent"
    ? { background: "linear-gradient(135deg,#6a7bff,#5b6cff)" }
    : undefined;
  return (
    <span
      className={`inline-flex items-center px-2 h-[22px] text-[11px] font-medium rounded-[6px] ${VARIANTS[variant]} ${className}`}
      style={agentStyle}
    >
      {children}
    </span>
  );
}
