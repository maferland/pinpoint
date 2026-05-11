import { useEffect, useState } from "react";

declare const __APP_VERSION__: string;

const RELEASES_API = "https://api.github.com/repos/maferland/pinpoint/releases/latest";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
}

/**
 * Returns true iff `latest` is a higher semver than `current`. Tags may have
 * a leading "v"; both are stripped before parts comparison. Non-numeric parts
 * compare as 0 — good enough for our `vX.Y.Z` cadence.
 */
export function isNewer(current: string, latest: string): boolean {
  const parts = (v: string) => v.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  const c = parts(current);
  const l = parts(latest);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const ci = c[i] ?? 0;
    const li = l[i] ?? 0;
    if (li > ci) return true;
    if (li < ci) return false;
  }
  return false;
}

export function useUpdateCheck(): UpdateInfo | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    const current = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

    // Debug hook: ?preview-update=0.9.0 forces the banner on without hitting
    // the GitHub API — useful when iterating on the banner UI.
    const preview = new URLSearchParams(window.location.search).get("preview-update");
    if (preview) {
      const clean = preview.replace(/^v/, "");
      setInfo({
        currentVersion: current,
        latestVersion: `v${clean}`,
        updateAvailable: true,
        releaseUrl: `https://github.com/maferland/pinpoint/releases/tag/v${clean}`,
      });
      return;
    }

    let cancelled = false;
    fetch(RELEASES_API)
      .then((res) => (res.ok ? res.json() : null))
      .then((release: { tag_name?: string; html_url?: string } | null) => {
        if (cancelled || !release?.tag_name) return;
        setInfo({
          currentVersion: current,
          latestVersion: release.tag_name,
          updateAvailable: isNewer(current, release.tag_name),
          releaseUrl: release.html_url ?? `https://github.com/maferland/pinpoint/releases/tag/${release.tag_name}`,
        });
      })
      .catch(() => {
        // Silently fail — update check is best-effort. Don't block the UI.
      });
    return () => { cancelled = true; };
  }, []);

  return info;
}
