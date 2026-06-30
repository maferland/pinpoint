import { test, expect } from "./cli-fixture.ts";

test.use({ pinpointContext: "auto-close" });

async function openSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Settings" }).click();
}

test("Auto-close checkbox persists server-side and shows countdown after Done", async ({ page, pinpointCli }) => {
  await page.goto(pinpointCli.url);

  await openSettings(page);
  const toggle = page.getByRole("switch", { name: /Auto-close tab/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  // Toggle on, verify it round-trips through the /api/preferences endpoint.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const stored = await page.evaluate(async () => {
    const res = await fetch("/api/preferences");
    return res.json();
  });
  expect(stored.autoCloseAfterDone).toBe(true);

  // Reload — toggle should remember its state.
  await page.reload();
  await openSettings(page);
  const toggleAfterReload = page.getByRole("switch", { name: /Auto-close tab/ });
  await expect(toggleAfterReload).toHaveAttribute("aria-checked", "true");

  // Click Done — button should display the countdown variant.
  await page.getByRole("button", { name: "Looks good" }).click();
  await expect(page.getByRole("button", { name: /Sent — closing in \ds/ })).toBeVisible();

  // CLI should still finalize cleanly even though the page is "self-closing".
  const json = await pinpointCli.finalized();
  expect(json.context).toBe("auto-close");
  expect(json.annotations).toEqual([]);
});

test("Auto-close OFF — Done shows the static 'you can close this tab' label", async ({ page, pinpointCli }) => {
  await page.goto(pinpointCli.url);
  await openSettings(page);
  const toggle = page.getByRole("switch", { name: /Auto-close tab/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await page.getByRole("button", { name: "Looks good" }).click();
  await expect(page.getByRole("button", { name: "Sent — you can close this tab" })).toBeVisible();
  await pinpointCli.finalized();
});
