import { useState } from "react";

interface ThumbnailProps {
  src: string;
  srcAfter?: string;
  index: number;
  active: boolean;
  annotationCount: number;
  hasDetails?: boolean;
  onClick: () => void;
}

const STRIP_HEIGHT = 48;
const MIN_WIDTH = 28;
const MAX_WIDTH = 96;

export function Thumbnail({ src, srcAfter, index, active, annotationCount, hasDetails, onClick }: ThumbnailProps) {
  const [aspect, setAspect] = useState<number | null>(null);

  const width = aspect
    ? Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, STRIP_HEIGHT * aspect)))
    : STRIP_HEIGHT;

  const label = srcAfter ? `Comparison ${index + 1}` : `Image ${index + 1}`;

  return (
    <button
      className={`relative rounded-md overflow-hidden border-2 transition-all shrink-0 group ${
        active
          ? "border-primary shadow-md shadow-primary/20"
          : "border-border hover:border-muted-foreground/30"
      }`}
      style={{ height: STRIP_HEIGHT, width }}
      onClick={onClick}
      title={`${label}${hasDetails ? " (has details)" : ""}`}
    >
      {srcAfter ? (
        <div className="w-full h-full flex">
          <img
            src={src}
            alt={`${label} before`}
            className="w-1/2 h-full object-cover block"
            loading="lazy"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setAspect(img.naturalWidth / img.naturalHeight);
              }
            }}
          />
          <div className="w-px bg-white/40 shrink-0" />
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
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setAspect(img.naturalWidth / img.naturalHeight);
            }
          }}
        />
      )}
      <span className={`absolute top-0.5 left-0.5 text-[9px] font-bold rounded px-1 leading-4 ${
        active ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
      }`}>
        {index + 1}
      </span>
      {srcAfter && (
        <span className="absolute top-0.5 right-0.5 text-[8px] font-medium bg-black/60 text-white/70 rounded px-1 leading-4">
          A|B
        </span>
      )}
      {annotationCount > 0 && (
        <span className="absolute bottom-0.5 right-0.5 text-[8px] font-medium bg-black/60 text-white rounded px-1 leading-3">
          {annotationCount}
        </span>
      )}
    </button>
  );
}
