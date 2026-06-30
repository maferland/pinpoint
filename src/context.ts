export interface ReviewContext {
  message?: string;
  url?: string;
  path?: string;
  branch?: string;
  [key: string]: string | undefined;
}

export function parseContext(raw: string | undefined): ReviewContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed as ReviewContext;
    return { message: String(raw) };
  } catch {
    return { message: raw };
  }
}
