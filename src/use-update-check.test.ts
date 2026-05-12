import { describe, expect, it } from "bun:test";
import { isNewer } from "./use-update-check.js";

describe("isNewer", () => {
  it.each([
    ["0.3.1", "0.4.0", true],
    ["0.3.1", "v0.4.0", true],
    ["v0.3.1", "v0.3.2", true],
    ["0.3.1", "0.3.1", false],
    ["0.3.1", "0.3.0", false],
    ["0.10.0", "0.9.0", false],
    ["0.9.0", "0.10.0", true],
    ["1.0.0", "0.99.99", false],
    ["0.0.0", "0.3.1", true],
  ])("isNewer(%s, %s) === %s", (current, latest, expected) => {
    expect(isNewer(current, latest)).toBe(expected);
  });
});
