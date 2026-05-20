import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { PreferencesStore, migrateLegacyPreferences } from "./preferences.js";

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
    expect(prefs.viewMode).toBe("fit");
    expect(prefs.idleReminder).toBe(false);
    expect(prefs.idleReminderDelaySec).toBe(60);
  });

  it("round-trips viewMode + idleReminder fields", async () => {
    const store = new PreferencesStore(file);
    await store.save({ viewMode: "actual", idleReminder: true, idleReminderDelaySec: 120 });
    const after = await store.load();
    expect(after.viewMode).toBe("actual");
    expect(after.idleReminder).toBe(true);
    expect(after.idleReminderDelaySec).toBe(120);
    expect(after.autoCloseAfterDone).toBe(false);
  });

  it("backfills missing new fields onto an older saved file", async () => {
    // Simulate a file written by a prior version that only knew autoCloseAfterDone.
    const fs = await import("fs");
    fs.writeFileSync(file, JSON.stringify({ autoCloseAfterDone: true }));
    const prefs = await new PreferencesStore(file).load();
    expect(prefs.autoCloseAfterDone).toBe(true);
    expect(prefs.viewMode).toBe("fit");
    expect(prefs.idleReminder).toBe(false);
    expect(prefs.idleReminderDelaySec).toBe(60);
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

describe("migrateLegacyPreferences", () => {
  let sandbox: string;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-migrate-"));
  });

  afterEach(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  it("moves legacy file to target and removes the empty legacy dir", () => {
    const legacyDir = path.join(sandbox, "legacy");
    const legacy = path.join(legacyDir, "preferences.json");
    const target = path.join(sandbox, "xdg", "pinpoint", "preferences.json");
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(legacy, JSON.stringify({ autoCloseAfterDone: true }));

    migrateLegacyPreferences(target, legacy);

    expect(fs.existsSync(target)).toBe(true);
    expect(fs.existsSync(legacy)).toBe(false);
    expect(fs.existsSync(legacyDir)).toBe(false);
    expect(JSON.parse(fs.readFileSync(target, "utf-8")).autoCloseAfterDone).toBe(true);
  });

  it("leaves legacy dir alone when it has sibling files (a real clone)", () => {
    const legacyDir = path.join(sandbox, "clone");
    const legacy = path.join(legacyDir, "preferences.json");
    const sibling = path.join(legacyDir, "README.md");
    const target = path.join(sandbox, "xdg", "pinpoint", "preferences.json");
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(legacy, "{}");
    fs.writeFileSync(sibling, "real clone");

    migrateLegacyPreferences(target, legacy);

    expect(fs.existsSync(legacy)).toBe(false);
    expect(fs.existsSync(sibling)).toBe(true);
    expect(fs.existsSync(legacyDir)).toBe(true);
  });

  it("no-op when target already exists", () => {
    const legacy = path.join(sandbox, "legacy.json");
    const target = path.join(sandbox, "target.json");
    fs.writeFileSync(legacy, JSON.stringify({ autoCloseAfterDone: true }));
    fs.writeFileSync(target, JSON.stringify({ autoCloseAfterDone: false }));

    migrateLegacyPreferences(target, legacy);

    // Both still exist; nothing got overwritten.
    expect(JSON.parse(fs.readFileSync(target, "utf-8")).autoCloseAfterDone).toBe(false);
    expect(fs.existsSync(legacy)).toBe(true);
  });

  it("no-op when legacy doesn't exist", () => {
    const target = path.join(sandbox, "xdg", "pinpoint", "preferences.json");
    const legacy = path.join(sandbox, "does-not-exist.json");
    migrateLegacyPreferences(target, legacy);
    expect(fs.existsSync(target)).toBe(false);
  });
});
