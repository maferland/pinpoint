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
  compareView: "split",
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
      onFinalized={() => {}}
      onShowWelcome={() => {}}
      onShowShare={() => {}}
      onToast={() => {}}
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

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      flushed.push("download-clicked");
    };

    try {
      renderToolbar({ onBeforeExport });
      await user.click(screen.getByLabelText("Export session"));

      expect(flushed).toEqual(["flush-started"]);
      resolveFlush!();
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
      expect(clicked).toHaveBeenCalled();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      console.error = originalError;
    }
  });
});
