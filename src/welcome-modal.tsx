import { Modal, Button } from "./ui/index.tsx";

interface WelcomeModalProps {
  onClose: () => void;
}

const STEPS = [
  {
    n: 1,
    icon: <ClickIcon />,
    title: "Click to pin",
    body: "Tap anywhere on the screenshot to drop a numbered pin.",
  },
  {
    n: 2,
    icon: <DragIcon />,
    title: "Drag to box",
    body: "Click and drag to draw a region box around a larger area.",
  },
  {
    n: 3,
    icon: <SendIcon />,
    title: "Send feedback",
    body: "Add a comment to each pin, then hit Send. Your agent gets structured coordinates + text.",
  },
];

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  return (
    <Modal onClose={onClose} maxWidth={440}>
      <div className="p-6 flex flex-col gap-5">
        {/* Eyebrow */}
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-[5px]"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
          >
            Demo session
          </span>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-[22px] font-bold text-txt tracking-tight">Mark up the screenshot.</h2>
          <p className="text-[14px] text-muted mt-1">Three moves. That's all it takes.</p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3">
          {STEPS.map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[13px]"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {step.n}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ color: "var(--muted)" }}>{step.icon}</span>
                  <p className="text-[13px] font-semibold text-txt">{step.title}</p>
                </div>
                <p className="text-[13px] text-muted leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="accent" size="md" className="flex-1" onClick={onClose}>
            Start annotating
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ClickIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
