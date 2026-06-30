import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: number;
}

export function IconButton({
  active = false,
  size = 34,
  className = "",
  children,
  style,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[8px] transition-colors select-none disabled:opacity-50 cursor-pointer ${
        active
          ? "bg-bg2 text-txt"
          : "text-muted hover:text-txt hover:bg-bg2"
      } ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
