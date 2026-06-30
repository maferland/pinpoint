interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
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
      className={`inline-flex items-center rounded-[9px] p-[3px] bg-bg2 gap-px ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={`px-2.5 h-[28px] text-[12px] font-medium rounded-[7px] transition-all select-none whitespace-nowrap ${
              active
                ? "bg-surface text-txt shadow-sm"
                : "text-muted hover:text-txt"
            }`}
            style={active ? { boxShadow: "0 1px 3px rgba(0,0,0,.13)" } : undefined}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
