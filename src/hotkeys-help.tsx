import { useEffect, useRef } from "react";

interface HotkeysHelpProps {
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

interface Group {
  title: string;
  shortcuts: Shortcut[];
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

const GROUPS: Group[] = [
  {
    title: "Annotate",
    shortcuts: [
      { keys: ["Click"], label: "Place a pin" },
      { keys: ["Drag"], label: "Place a box region" },
      { keys: ["Click pin"], label: "Select annotation" },
      { keys: ["Click box edge"], label: "Select that annotation" },
      { keys: ["Esc"], label: "Deselect" },
      { keys: ["Delete"], label: "Delete selected annotation" },
    ],
  },
  {
    title: "Navigate",
    shortcuts: [
      { keys: ["←", "→"], label: "Previous / next screenshot" },
      { keys: [`${modKey}+←`, `${modKey}+→`], label: "Native text navigation (in fields)" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["?"], label: "Toggle this help" },
    ],
  },
];

export function HotkeysHelp({ onClose }: HotkeysHelpProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={rootRef}
        className="w-[420px] max-w-[92vw] rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-[13px] font-semibold tracking-tight">Keyboard shortcuts</span>
          <button
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          {GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </div>
              <dl className="flex flex-col gap-1">
                {group.shortcuts.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-3 text-[12px]">
                    <dt className="text-foreground">{s.label}</dt>
                    <dd className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="px-1.5 h-5 inline-flex items-center rounded border border-border bg-secondary text-secondary-foreground text-[10px] font-medium font-mono"
                        >
                          {k}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
