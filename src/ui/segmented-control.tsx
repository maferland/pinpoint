import type { ReactNode } from "react";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex items-center rounded-[9px] p-[3px] gap-px ${className}`}
      style={{
        backgroundColor: "var(--bg)",
        border: "1px solid var(--border)",
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 h-[28px] text-[12px] font-semibold rounded-[7px] transition-all select-none whitespace-nowrap border-none cursor-pointer"
            style={{
              color: active ? "var(--text)" : "var(--muted)",
              backgroundColor: active ? "var(--surface)" : "transparent",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,.13)" : "none",
            }}
            onClick={() => onChange(o.value)}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
