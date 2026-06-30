import { useState } from "react";
import { Modal, Button, Toggle } from "./ui/index.tsx";

interface ShareModalProps {
  reviewId: string;
  context?: string;
  onClose: () => void;
  onToast: (msg: string) => void;
  onExport: () => void;
}

export function ShareModal({ reviewId, context, onClose, onToast, onExport }: ShareModalProps) {
  const [linkOpen, setLinkOpen] = useState(true);
  const relayUrl = `localhost:7391/r/${reviewId.slice(0, 5)}`;

  let ctxEntries: [string, string][] = [];
  if (context) {
    try {
      const parsed = JSON.parse(context);
      if (typeof parsed === "object" && parsed !== null) {
        ctxEntries = Object.entries(parsed)
          .filter(([, v]) => typeof v === "string")
          .map(([k, v]) => [k, v as string]);
      }
    } catch {
      ctxEntries = [["context", context]];
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`http://${relayUrl}`).catch(() => {});
    onClose();
    onToast("Local relay link copied — share it on your LAN.");
  };

  return (
    <Modal onClose={onClose} maxWidth={468}>
      <div className="flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-[20px] font-bold text-txt tracking-tight">Share this review</h2>
          <p className="text-[13px] text-muted mt-1">
            No login — the link is the capability.
          </p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          {/* Relay link */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold text-faint tracking-widest uppercase">
                Local relay
              </span>
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: "var(--good-soft)", color: "var(--good)" }}
              >
                <span className="w-[6px] h-[6px] rounded-full bg-good" />
                Served from your machine
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 font-mono text-[12px] text-txt px-3 py-2 rounded-[8px] border border-border bg-bg2 overflow-hidden"
                title={relayUrl}
              >
                <span className="text-faint">http://</span>{relayUrl}
              </div>
              <Button variant="surface" size="sm" onClick={copyLink}>
                Copy link
              </Button>
            </div>
            <p className="text-[12px] text-faint leading-relaxed">
              No account, no upload. Open it on your LAN, or start a one-off tunnel to share with anyone.
            </p>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between gap-3 py-3 border-t border-b border-border">
            <div>
              <p className="text-[13px] font-medium text-txt">Anyone with the link can add pins</p>
              <p className="text-[11px] text-faint mt-0.5">Collaborators can annotate and their pins merge back</p>
            </div>
            <Toggle checked={linkOpen} onChange={setLinkOpen} />
          </div>

          {/* Review context — only when present */}
          {ctxEntries.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-faint uppercase tracking-widest">Review context</p>
              <div className="rounded-[10px] border border-border bg-bg px-3 py-2.5 flex flex-col gap-1.5">
                {ctxEntries.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-faint shrink-0" style={{ width: 52 }}>{k}</span>
                    <span className="font-mono text-[11px] text-muted truncate flex-1">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-1 flex items-center justify-between gap-3 border-t border-border">
          <p className="text-[12px] text-faint">Prefer a file?</p>
          <Button
            variant="surface"
            size="sm"
            onClick={() => { onExport(); onClose(); }}
          >
            Export .pinpoint.zip
          </Button>
        </div>
      </div>
    </Modal>
  );
}
