import { useEffect } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, onDismiss, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs, message]);

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 animate-pp-toast flex items-center gap-2 px-4 py-2.5 rounded-full select-none"
      style={{
        backgroundColor: "var(--text)",
        color: "var(--bg)",
        boxShadow: "0 4px 20px rgba(0,0,0,.25)",
        transform: "translateX(-50%)",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--good)", flexShrink: 0 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="text-[13px] font-medium whitespace-nowrap">{message}</span>
    </div>
  );
}
