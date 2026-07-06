import { useState } from "react";

function basename(p: string): string {
  return p.split("/").pop()?.split("\\").pop() ?? p;
}

interface ThumbnailProps {
  src: string;
  srcAfter?: string;
  filename?: string;
  index: number;
  active: boolean;
  annotationCount: number;
  onClick: () => void;
}

const THUMB_W = 124;
const THUMB_H = 72;

export function Thumbnail({
  src,
  srcAfter,
  filename,
  index,
  active,
  annotationCount,
  onClick,
}: ThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const label = filename ? basename(filename) : `Image ${index + 1}`;
  const isPair = !!srcAfter;

  return (
    <button
      className="relative rounded-[9px] overflow-hidden shrink-0 transition-all"
      style={{
        width: THUMB_W,
        height: THUMB_H,
        border: active
          ? `2px solid var(--accent)`
          : `1.5px solid var(--border)`,
        boxShadow: active
          ? `0 0 0 3px var(--accent-soft)`
          : undefined,
      }}
      onClick={onClick}
      title={label}
      aria-label={`${label}${isPair ? " (before/after)" : ""}`}
    >
      {/* Image(s) */}
      {isPair ? (
        <div className="w-full h-full flex">
          <img
            src={src}
            alt={`${label} before`}
            className="w-1/2 h-full object-cover block"
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
          <div className="w-px bg-white/30 shrink-0" />
          <img
            src={srcAfter}
            alt={`${label} after`}
            className="w-1/2 h-full object-cover block"
            loading="lazy"
          />
        </div>
      ) : (
        <img
          src={src}
          alt={label}
          className="w-full h-full object-cover block"
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
      )}

      {/* Filename overlay at bottom */}
      {loaded && (
        <div
          className="absolute inset-x-0 bottom-0 flex items-end px-1.5 pb-1 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,.55) 0%, transparent 100%)", height: 28 }}
        >
          <span className="font-mono text-[9px] text-white/80 truncate leading-none">{label}</span>
        </div>
      )}

      {/* B/A badge — top-left for compare pairs */}
      {isPair && (
        <span
          className="absolute top-1 left-1 font-mono text-[8px] font-semibold text-white/70 px-1 rounded-[3px]"
          style={{ backgroundColor: "rgba(0,0,0,.5)" }}
        >
          B/A
        </span>
      )}

      {/* Annotation count badge — top-right */}
      {annotationCount > 0 && (
        <span
          className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center font-mono text-[9px] font-bold text-white rounded-full px-1"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {annotationCount}
        </span>
      )}
    </button>
  );
}
