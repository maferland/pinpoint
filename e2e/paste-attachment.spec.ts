import fs from "fs";
import { test, expect } from "./cli-fixture.ts";

test.use({ pinpointContext: "playwright paste-attachment" });

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("pasting an image into a pin's comment attaches it and survives to the finalized JSON", async ({ page, pinpointCli }) => {
  await page.goto(pinpointCli.url);

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => {
    const c = document.querySelector("canvas");
    return c != null && c.style.width !== "";
  }, { timeout: 10000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const textarea = page.getByTestId("popover-textarea");
  await expect(textarea).toBeFocused();

  const uploaded = page.waitForResponse((res) =>
    res.url().includes("/attachments") && res.request().method() === "POST" && res.ok()
  );

  await textarea.evaluate((el, base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], "screenshot.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, ONE_PX_PNG_BASE64);

  await uploaded;
  await expect(page.locator("[data-popover]").getByAltText("Pasted attachment")).toBeVisible();

  await textarea.fill("See the attached mock");

  const annotationsSaved = page.waitForResponse((res) =>
    res.url().endsWith("/annotations") && res.request().method() === "PUT" && res.ok()
  );
  await textarea.press("Meta+Enter");
  await annotationsSaved;

  await page.getByRole("button", { name: "Send 1 comment" }).click();
  const json = await pinpointCli.finalized();

  expect(json.annotations).toHaveLength(1);
  expect(json.annotations[0].comment).toBe("See the attached mock");
  const attachment = json.annotations[0].attachments[0];
  expect(attachment.width).toBe(1);
  expect(attachment.height).toBe(1);
  expect(fs.existsSync(attachment.path)).toBe(true);
});
