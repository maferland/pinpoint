import { Modal } from "./ui/index.tsx";

interface HelpModalProps {
  onClose: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Annotate",
    shortcuts: [
      { keys: ["Click"], label: "Drop a pin" },
      { keys: ["Drag"], label: "Draw a region box" },
      { keys: ["Esc"], label: "Deselect / close" },
      { keys: ["Delete"], label: "Delete selected annotation" },
      { keys: [`${modKey}+↵`], label: "Save comment and close" },
    ],
  },
  {
    title: "Navigate",
    shortcuts: [
      { keys: ["←", "→"], label: "Previous / next screenshot" },
    ],
  },
  {
    title: "Compare mode",
    shortcuts: [
      { keys: ["Tab"], label: "Switch Before / After (in Switch view)" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["?"], label: "Toggle this help" },
    ],
  },
];

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <div className="p-6 flex flex-col gap-4">
        <h2 className="text-[18px] font-bold text-txt tracking-tight">Keyboard shortcuts</h2>

        <div className="flex flex-col gap-4">
          {GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                {group.title}
              </p>
              {group.shortcuts.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-muted">{s.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 h-6 inline-flex items-center rounded border border-border bg-bg text-faint text-[11px] font-medium font-mono"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
