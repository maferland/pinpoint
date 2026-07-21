import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TRY_DEMO_ID } from "./try-bootstrap.ts";

// The CLI-server e2e suite can't reach the static site's routing, so pin it here.
const read = (name: string) =>
  readFileSync(new URL(`../site/${name}`, import.meta.url), "utf8");

const vercelConfig = JSON.parse(read("vercel.json"));

describe("site routing config", () => {
  test("/try rewrites to the real try.html entry", () => {
    expect(vercelConfig.rewrites).toContainEqual({
      source: "/try",
      destination: "/try.html",
    });
  });

  test("legacy /review/<demo-id> link redirects to /try", () => {
    expect(vercelConfig.redirects).toContainEqual({
      source: `/review/${TRY_DEMO_ID}`,
      destination: "/try",
      permanent: true,
    });
  });

  test("service worker demo id matches TRY_DEMO_ID", () => {
    const id = read("try-sw.js").match(/const DEMO_ID = "([^"]+)"/)?.[1];
    expect(id).toBe(TRY_DEMO_ID);
  });
});
