import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover } from "./popover.tsx";
import type { PinpointAnnotation } from "./types.ts";

afterEach(() => {
  cleanup();
});

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

  it("deletes a new pin on Escape when nothing was typed", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    const onClose = mock(() => {});
    const { unmount } = render(
      <Popover
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

  it("deletes pin when an existing comment is cleared and saved with ⌘Enter", async () => {
    const user = userEvent.setup();
    const onDelete = mock(() => {});
    const onUpdate = mock((_updates: Partial<PinpointAnnotation>) => {});
    const { unmount } = render(
      <Popover
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
});
