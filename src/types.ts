export interface ImageInfo {
  path: string;
  width: number;
  height: number;
  /**
   * Key/value pairs the agent attaches to a screenshot — route, state, viewport,
   * what to look at, etc. Rendered in the draggable details panel.
   */
  details?: Record<string, string>;
}

export interface PinpointAnnotation {
  id: string;
  number: number;
  imageIndex: number;
  pin: { x: number; y: number };
  box?: { x: number; y: number; width: number; height: number };
  comment: string;
}

export interface PinpointReview {
  version: "1.0";
  id: string;
  images: ImageInfo[];
  context?: string;
  createdAt: string;
  annotations: PinpointAnnotation[];
  compareMode?: boolean;
}
