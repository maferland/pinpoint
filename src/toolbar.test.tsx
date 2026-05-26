import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toolbar } from "./toolbar.tsx";
import type { Preferences } from "./api.ts";

afterEach(() => {
  cleanup();
});

const DEFAULT_PREFS: Preferences = {
  autoCloseAfterDone: false,
  viewMode: "fit",
  idleReminder: false,
  idleReminderDelaySec: 60,
};

function renderToolbar(overrides: { onBeforeExport?: () => Promise<void> } = {}) {
  const onBeforeExport = overrides.onBeforeExport ?? mock(() => Promise.resolve());
  render(
    <Toolbar
      reviewId="abc"
      annotationCount={2}
      theme="light"
      onThemeToggle={() => {}}
      prefs={DEFAULT_PREFS}
      prefsLoaded={true}
      onPrefsChange={() => {}}
      onFinalized={() => {}}
      hasDetails={false}
      detailsVisible={false}
      onToggleDetails={() => {}}
      onShowHotkeys={() => {}}
      onBeforeExport={onBeforeExport}
    />
  );
  return { onBeforeExport };
}

describe("Toolbar export button", () => {
  it("awaits onBeforeExport before triggering the download", async () => {
    const user = userEvent.setup();
    let resolveFlush: (() => void) | null = null;
    const flushed: string[] = [];
    const onBeforeExport = mock(() => {
      flushed.push("flush-started");
      return new Promise<void>((resolve) => {
        resolveFlush = () => { flushed.push("flush-done"); resolve(); };
      });
    });

    // Intercept the synthetic <a>.click() so we can prove the click only fires
    // after the flush resolves.
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      flushed.push("download-clicked");
    };

    try {
      renderToolbar({ onBeforeExport });
      await user.click(screen.getByLabelText("Export session"));

      // The click handler has fired, the flush has started, but resolve has
      // not yet been called — so no download should have happened.
      expect(flushed).toEqual(["flush-started"]);
      resolveFlush!();
      // Yield to the microtask queue so the awaited promise can settle.
      await new Promise((r) => setTimeout(r, 0));
      expect(flushed).toEqual(["flush-started", "flush-done", "download-clicked"]);
      expect(onBeforeExport).toHaveBeenCalledTimes(1);
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  it("still downloads if the flush rejects", async () => {
    const user = userEvent.setup();
    const fail = mock(() => Promise.reject(new Error("network down")));
    const clicked = mock(() => {});
    const originalError = console.error;
    console.error = () => {};

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = clicked;
    try {
      renderToolbar({ onBeforeExport: fail });
      await user.click(screen.getByLabelText("Export session"));
      await new Promise((r) => setTimeout(r, 0));
      // Flush errors are logged but should not block the export.
      expect(clicked).toHaveBeenCalled();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      console.error = originalError;
    }
  });
});
