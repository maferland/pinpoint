import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { PreferencesStore } from "./preferences.js";

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-prefs-"));
  file = path.join(dir, "preferences.json");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("PreferencesStore", () => {
  it("returns defaults when no file exists", async () => {
    const prefs = await new PreferencesStore(file).load();
    expect(prefs.autoCloseAfterDone).toBe(false);
  });

  it("save then load round-trips", async () => {
    const store = new PreferencesStore(file);
    const merged = await store.save({ autoCloseAfterDone: true });
    expect(merged.autoCloseAfterDone).toBe(true);
    const reloaded = await store.load();
    expect(reloaded.autoCloseAfterDone).toBe(true);
  });

  it("partial save preserves other keys", async () => {
    const store = new PreferencesStore(file);
    await store.save({ autoCloseAfterDone: true, theme: "dark" });
    const after = await store.save({ autoCloseAfterDone: false });
    expect(after.autoCloseAfterDone).toBe(false);
    expect(after.theme).toBe("dark");
  });

  it("returns defaults if file is corrupt", async () => {
    fs.writeFileSync(file, "not json");
    const prefs = await new PreferencesStore(file).load();
    expect(prefs.autoCloseAfterDone).toBe(false);
  });

  it("persists across PreferencesStore instances", async () => {
    await new PreferencesStore(file).save({ autoCloseAfterDone: true });
    const fresh = await new PreferencesStore(file).load();
    expect(fresh.autoCloseAfterDone).toBe(true);
  });
});
