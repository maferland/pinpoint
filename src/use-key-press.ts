import { useEffect, useRef } from "react";
import { isEditableTarget } from "./dom-utils.ts";

interface KeyPressOpts {
  when?: boolean;
  editable?: boolean;   // allow firing inside textarea/input (default false)
  modifiers?: boolean;  // allow firing with meta/ctrl/alt/shift held (default true)
}

export function useKeyPress(
  key: string | string[],
  handler: (e: KeyboardEvent) => void,
  opts: KeyPressOpts = {}
) {
  const { when = true, editable = false, modifiers = true } = opts;
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  useEffect(() => {
    if (!when) return;
    const keys = Array.isArray(key) ? key : [key];
    const onKey = (e: KeyboardEvent) => {
      if (!editable && isEditableTarget(e.target)) return;
      if (!modifiers && (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)) return;
      if (!keys.includes(e.key)) return;
      handlerRef.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, when, editable, modifiers]);
}
