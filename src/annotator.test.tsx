import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { isEditableTarget } from "./dom-utils.ts";

afterEach(() => {
  cleanup();
});

describe("isEditableTarget", () => {
  it("rejects non-elements and non-editable elements", () => {
    expect(isEditableTarget(null)).toBe(false);
    const { container } = render(<div>plain</div>);
    expect(isEditableTarget(container.firstChild as HTMLElement)).toBe(false);
  });

  it.each([
    ["textarea", <textarea defaultValue="" />],
    ["input", <input type="text" />],
    ["select", <select><option value="a">a</option></select>],
    ["contentEditable div", <div contentEditable="true" suppressContentEditableWarning>x</div>],
  ])("accepts %s", (_label, element) => {
    const { container } = render(element);
    expect(isEditableTarget(container.firstChild as HTMLElement)).toBe(true);
  });
});
