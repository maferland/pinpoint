import { useState } from "react";

interface ThumbnailProps {
  src: string;
  index: number;
  active: boolean;
  annotationCount: number;
  hasDetails?: boolean;
  onClick: () => void;
}

// Fixed strip height (h-12 = 48px), width derived from natural aspect ratio
// and clamped so portrait screenshots aren't slivers and panoramas don't
// hog the filmstrip. Falls back to a square placeholder before the image
// has loaded so layout doesn't jump.
const STRIP_HEIGHT = 48;
const MIN_WIDTH = 28;
const MAX_WIDTH = 96;

export function Thumbnail({ src, index, active, annotationCount, hasDetails, onClick }: ThumbnailProps) {
  const [aspect, setAspect] = useState<number | null>(null);

  const width = aspect
    ? Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, STRIP_HEIGHT * aspect)))
    : STRIP_HEIGHT;

  return (
    <button
      className={`relative rounded-md overflow-hidden border-2 transition-all shrink-0 group ${
        active
          ? "border-primary shadow-md shadow-primary/20"
          : "border-border hover:border-muted-foreground/30"
      }`}
      style={{ height: STRIP_HEIGHT, width }}
      onClick={onClick}
      title={`Image ${index + 1}${hasDetails ? " (has details)" : ""}`}
    >
      <img
        src={src}
        alt={`Image ${index + 1}`}
        className="w-full h-full object-cover block"
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) {
            setAspect(img.naturalWidth / img.naturalHeight);
          }
        }}
      />
      <span className={`absolute top-0.5 left-0.5 text-[9px] font-bold rounded px-1 leading-4 ${
        active ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
      }`}>
        {index + 1}
      </span>
      {annotationCount > 0 && (
        <span className="absolute bottom-0.5 right-0.5 text-[8px] font-medium bg-black/60 text-white rounded px-1 leading-3">
          {annotationCount}
        </span>
      )}
    </button>
  );
}
