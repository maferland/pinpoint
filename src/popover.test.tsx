import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover } from "./popover.tsx";
import type { PinpointAnnotation } from "./types.ts";

const realFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

function pasteImage(textarea: HTMLElement, file: File) {
  fireEvent.paste(textarea, {
    clipboardData: { items: [{ type: file.type, getAsFile: () => file }] },
  });
}

function makeAnnotation(overrides: Partial<PinpointAnnotation> = {}): PinpointAnnotation {
  return {
    id: "a1",
    number: 1,
    imageIndex: 0,
    pin: { x: 50, y: 50 },
    comment: "",
    ...overrides,
  };
}

describe("Popover", () => {
  it("calls onUpdate with new comment when ⌘Enter is pressed", async () => {
    const user = userEvent.setup();
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    await user.click(textarea);
    await user.keyboard("Footer too tight");
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toEqual({ comment: "Footer too tight" });
  });

  it("saves on unmount when comment changed (click-outside path)", async () => {
    const user = userEvent.setup();
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    await user.click(textarea);
    await user.keyboard("typed but not submitted");
    expect(onUpdate).not.toHaveBeenCalled();

    unmount();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toEqual({ comment: "typed but not submitted" });
  });

  it("does not save on unmount when comment unchanged", async () => {
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation({ comment: "original" })}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onClose={() => {}}
      />
    );
    unmount();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not save on unmount when Escape was pressed", async () => {
    const user = userEvent.setup();
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    const onClose = mock(() => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation({ comment: "original" })}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onClose={onClose}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    await user.click(textarea);
    await user.keyboard("draft changes");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();

    unmount();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("calls onDelete when Delete button clicked", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={() => {}}
        onDelete={onDelete}
        onClose={() => {}}
      />
    );
    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("deletes a brand-new pin on unmount when no comment was typed", () => {
    const onDelete = mock(() => {});
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={() => {}}
      />
    );
    unmount();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("deletes a new pin on Escape when nothing was ever committed — Escape closes, and cleans up the empty pin", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    const onClose = mock(() => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={() => {}}
        onDelete={onDelete}
        onClose={onClose}
      />
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("deletes a new pin on Escape after typing — the draft was never committed, so there's nothing to keep", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    const onClose = mock(() => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    await user.click(textarea);
    await user.keyboard("half-typed thought");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not delete an existing annotation on Escape, even after typing over its comment", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    const onClose = mock(() => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation({ comment: "original" })}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={onClose}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    await user.click(textarea);
    await user.clear(textarea);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("deletes pin when an existing comment is cleared and saved with ⌘Enter", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation({ comment: "old note" })}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    await user.click(textarea);
    await user.clear(textarea);
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    unmount();
    expect(onUpdate).toHaveBeenCalledWith({ comment: "" });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("treats a whitespace-only comment as empty and deletes the pin", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={() => {}}
        onDelete={onDelete}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    await user.click(textarea);
    await user.keyboard("   ");
    unmount();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not delete pin when the comment is non-empty on unmount", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation({ comment: "still here" })}
        x={0} y={0}
        onUpdate={() => {}}
        onDelete={onDelete}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    await user.click(textarea);
    await user.keyboard(" more");
    unmount();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("pastes an image: shows an optimistic thumbnail, then calls onUpdate with the confirmed attachment", async () => {
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    // @ts-expect-error test stub
    globalThis.fetch = mock(async () => ({
      ok: true,
      json: async () => ({ id: "att1", width: 10, height: 10 }),
    }));

    render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    const file = new File(["fake-bytes"], "screenshot.png", { type: "image/png" });
    pasteImage(textarea, file);

    expect(await screen.findByAltText("Uploading attachment")).toBeTruthy();

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        attachments: [{ id: "att1", width: 10, height: 10 }],
      });
    });
    expect(await screen.findByAltText("Pasted attachment")).toBeTruthy();
  });

  it("removes a pasted attachment via its remove button and calls onUpdate with it stripped", async () => {
    const user = userEvent.setup();
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    // @ts-expect-error test stub
    globalThis.fetch = mock(async () => ({ ok: true, json: async () => ({}) }));

    render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation({ attachments: [{ id: "att1", width: 10, height: 10 }] })}
        x={0} y={0}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onClose={() => {}}
      />
    );
    await user.click(screen.getByRole("button", { name: "Remove attachment" }));
    expect(onUpdate).toHaveBeenCalledWith({ attachments: [] });
    expect(screen.queryByAltText("Pasted attachment")).toBeNull();
  });

  it("does not delete a new pin with only a pasted attachment and no comment", async () => {
    const onDelete = mock(() => {});
    // @ts-expect-error test stub
    globalThis.fetch = mock(async () => ({
      ok: true,
      json: async () => ({ id: "att1", width: 10, height: 10 }),
    }));

    const { unmount } = render(
      <Popover
        reviewId="test-review"
        annotation={makeAnnotation()}
        x={0} y={0}
        onUpdate={() => {}}
        onDelete={onDelete}
        onClose={() => {}}
      />
    );
    const textarea = screen.getByTestId("popover-textarea");
    const file = new File(["fake-bytes"], "screenshot.png", { type: "image/png" });
    pasteImage(textarea, file);
    await screen.findByAltText("Pasted attachment");

    unmount();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
