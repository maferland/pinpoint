interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="relative shrink-0 transition-colors rounded-full disabled:opacity-50"
        style={{
          width: 38,
          height: 22,
          backgroundColor: checked ? "var(--good)" : "var(--bg2)",
          border: `1.5px solid ${checked ? "var(--good)" : "var(--border)"}`,
        }}
        onClick={() => onChange(!checked)}
      >
        <span
          className="absolute top-[2px] left-[2px] rounded-full bg-white transition-transform"
          style={{
            width: 16,
            height: 16,
            transform: checked ? "translateX(16px)" : "translateX(0)",
          }}
        />
      </button>
      {label && <span className="text-[13px] text-txt">{label}</span>}
    </label>
  );
}
