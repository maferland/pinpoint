import type { PinpointAnnotation } from "./types.ts";

interface ReviewContext {
  message?: string;
  url?: string;
  path?: string;
  branch?: string;
  [key: string]: string | undefined;
}

function parseContext(raw: string | undefined): ReviewContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed as ReviewContext;
    return { message: String(raw) };
  } catch {
    return { message: raw };
  }
}

interface CommentsRailProps {
  annotations: PinpointAnnotation[];
  selectedId: string | null;
  context?: string;
  onSelect: (id: string | null) => void;
}

export function CommentsRail({ annotations, selectedId, context, onSelect }: CommentsRailProps) {
  const ctx = parseContext(context);

  return (
    <div
      className="flex flex-col bg-surface border-l border-border shrink-0 overflow-hidden"
      style={{ width: 340 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 border-b border-border shrink-0"
        style={{ height: 52 }}
      >
        <span className="text-[14px] font-semibold text-txt">Comments</span>
        {annotations.length > 0 && (
          <span
            className="min-w-[22px] h-[22px] flex items-center justify-center text-[11px] font-bold text-white rounded-full px-1.5"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {annotations.length}
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "12px 12px 16px" }}>
        {/* Agent brief */}
        {ctx && <AgentBrief ctx={ctx} />}

        {/* Empty state */}
        {annotations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <PinIcon />
            <div>
              <p className="text-[13px] font-medium text-muted">No comments yet</p>
              <p className="text-[12px] text-faint mt-0.5">Click the screenshot to drop a pin</p>
            </div>
          </div>
        )}

        {/* Comment cards */}
        {annotations.length > 0 && (
          <div className="flex flex-col gap-2 mt-3">
            {annotations.map((ann) => (
              <CommentCard
                key={ann.id}
                annotation={ann}
                selected={ann.id === selectedId}
                onClick={() => onSelect(ann.id === selectedId ? null : ann.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentBrief({ ctx }: { ctx: ReviewContext }) {
  const hasMetadata = ctx.url || ctx.path || ctx.branch;
  const otherKeys = Object.entries(ctx).filter(
    ([k]) => !["message", "url", "path", "branch"].includes(k)
  );

  return (
    <div className="rounded-[12px] border border-border bg-bg overflow-hidden mb-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <AgentAvatar />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-txt">From your agent</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-[7px] h-[7px] rounded-full"
            style={{ backgroundColor: "var(--good)" }}
          />
          <span className="font-mono text-[10px] text-faint">claude-code</span>
        </div>
      </div>

      {/* Message */}
      {ctx.message && (
        <p className="text-[12px] text-muted leading-relaxed px-3 pb-2.5">
          {ctx.message}
        </p>
      )}

      {/* Metadata */}
      {(hasMetadata || otherKeys.length > 0) && (
        <div className="border-t border-border px-3 py-2 flex flex-col gap-1.5">
          {ctx.url && (
            <MetaRow label="url">
              <a
                href={ctx.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] truncate hover:underline flex items-center gap-1"
                style={{ color: "var(--agent)" }}
              >
                {ctx.url}
                <ExternalLinkIcon />
              </a>
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
          {otherKeys.map(([k, v]) => (
            <MetaRow key={k} label={k}>
              <span className="font-mono text-[11px] text-muted truncate">{v}</span>
            </MetaRow>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-faint shrink-0" style={{ width: 46 }}>
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function CommentCard({
  annotation,
  selected,
  onClick,
}: {
  annotation: PinpointAnnotation;
  selected: boolean;
  onClick: () => void;
}) {
  const isBox = annotation.box &&
    (annotation.box.width > 7 || annotation.box.height > 7);

  return (
    <button
      className="w-full text-left rounded-[10px] border p-3 transition-all"
      style={{
        backgroundColor: selected ? "var(--accent-soft)" : "var(--bg)",
        borderColor: selected ? "var(--accent)" : "var(--border)",
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <PinBadge number={annotation.number} />
        <span className="font-mono text-[10px] font-semibold text-faint tracking-wide uppercase">
          {isBox ? "Region" : "Pin"}
        </span>
        <span className="ml-auto font-mono text-[10px] text-faint">
          {Math.round(annotation.pin.x)}%, {Math.round(annotation.pin.y)}%
        </span>
      </div>
      {annotation.comment ? (
        <p className="text-[12px] text-muted leading-relaxed line-clamp-3">
          {annotation.comment}
        </p>
      ) : (
        <p className="text-[12px] text-faint italic">Empty — click to add a comment</p>
      )}
    </button>
  );
}

function PinBadge({ number }: { number: number }) {
  return (
    <span
      className="w-[20px] h-[20px] flex items-center justify-center text-[10px] font-bold text-white rounded-full shrink-0"
      style={{ backgroundColor: "var(--accent)" }}
    >
      {number}
    </span>
  );
}

function AgentAvatar() {
  return (
    <div
      className="w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0"
      style={{ background: "linear-gradient(135deg,#6a7bff,#5b6cff)" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-2 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
      </svg>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--faint)" }}>
      <path d="M12 2c-4.4 0-8 3.6-8 8 0 5.6 8 12 8 12s8-6.4 8-12c0-4.4-3.6-8-8-8z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
