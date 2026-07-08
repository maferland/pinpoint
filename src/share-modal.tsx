import { useEffect, useState } from "react";
import { exportReview, shareReview } from "./api.ts";
import { parseContext } from "./context.ts";
import { MetaRow } from "./comments-rail.tsx";
import { Badge, Button, Modal } from "./ui/index.tsx";

interface ShareModalProps {
  reviewId: string;
  context?: string;
  onClose: () => void;
  onToast: (msg: string) => void;
  onBeforeExport: () => Promise<void>;
}

type ShareState =
  | { status: "loading" }
  | { status: "ready"; link: string; ttlDays: number }
  | { status: "error"; message: string };

export function ShareModal({ reviewId, context, onClose, onToast, onBeforeExport }: ShareModalProps) {
  const [state, setState] = useState<ShareState>({ status: "loading" });
  const ctx = parseContext(context);

  useEffect(() => {
    let cancelled = false;
    shareReview(reviewId)
      .then((result) => { if (!cancelled) setState({ status: "ready", ...result }); })
      .catch((err) => { if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Share failed" }); });
    return () => { cancelled = true; };
  }, [reviewId]);

  const copyLink = async () => {
    if (state.status !== "ready") return;
    await navigator.clipboard.writeText(state.link);
    onToast("Link copied — treat it like a password.");
  };

  const handleExport = () => exportReview(reviewId, onBeforeExport, onToast);

  return (
    <Modal onClose={onClose} maxWidth={468}>
      <div className="p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-txt tracking-tight">Share this review</h2>
          <p className="text-[13px] text-muted mt-1">No login — the link is the capability.</p>
        </div>

        {state.status === "loading" && (
          <div className="flex items-center gap-2.5 text-[13px] text-muted h-9">
            <span
              className="inline-block w-4 h-4 rounded-full border-2 border-border animate-pp-spin shrink-0"
              style={{ borderTopColor: "var(--accent)" }}
            />
            Encrypting and packing up the review…
          </div>
        )}

        {state.status === "error" && (
          <p className="text-[13px] text-accent">{state.message}</p>
        )}

        {state.status === "ready" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] font-semibold text-faint tracking-widest uppercase">
                Encrypted link
              </p>
              <Badge variant="good">encrypted before upload</Badge>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={state.link}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 font-mono text-[12px] text-muted bg-bg border border-border rounded-[10px] px-3 h-9 truncate"
              />
              <Button variant="accent" size="sm" onClick={copyLink}>Copy link</Button>
            </div>
            <p className="text-[11px] text-faint">
              Expires in {state.ttlDays} days. Treat it like a password.
            </p>
          </div>
        )}

        {ctx && (ctx.url || ctx.path || ctx.branch) && (
          <div className="rounded-[12px] border border-border bg-bg px-3 py-2.5 flex flex-col gap-1.5">
            {ctx.url && (
              <MetaRow label="url">
                <span className="font-mono text-[11px] text-muted truncate">{ctx.url}</span>
              </MetaRow>
            )}
            {ctx.path && (
              <MetaRow label="path">
                <span className="font-mono text-[11px] text-muted truncate">{ctx.path}</span>
              </MetaRow>
            )}
            {ctx.branch && (
              <MetaRow label="branch">
                <span className="font-mono text-[11px] text-muted truncate">{ctx.branch}</span>
              </MetaRow>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-border flex items-center justify-between">
          <span className="text-[12px] text-muted">Prefer a file?</span>
          <Button variant="surface" size="sm" onClick={handleExport}>Export .pinpoint.zip</Button>
        </div>
      </div>
    </Modal>
  );
}
