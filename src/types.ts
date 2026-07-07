export interface ImageInfo {
  path: string;
  width: number;
  height: number;
  details?: Record<string, string>;
}

export interface AnnotationAttachment {
  id: string;
  width: number;
  height: number;
}

export interface PinpointAnnotation {
  id: string;
  number: number;
  imageIndex: number;
  pin: { x: number; y: number };
  box?: { x: number; y: number; width: number; height: number };
  comment: string;
  attachments?: AnnotationAttachment[];
}

export interface SingleSlot {
  type: "single";
  imageIndex: number;
}

export interface CompareSlot {
  type: "compare";
  beforeIndex: number;
  afterIndex: number;
}

export type ReviewSlot = SingleSlot | CompareSlot;

export interface PinpointReview {
  version: "1.0";
  id: string;
  images: ImageInfo[];
  slots?: ReviewSlot[];
  context?: string;
  createdAt: string;
  annotations: PinpointAnnotation[];
  /** @deprecated use slots */
  compareMode?: boolean;
}

export function resolveSlots(review: PinpointReview): ReviewSlot[] {
  if (review.slots) return review.slots;
  if (review.compareMode) return [{ type: "compare", beforeIndex: 0, afterIndex: 1 }];
  return review.images.map((_, i) => ({ type: "single", imageIndex: i }));
}
