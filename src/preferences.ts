import fs from "fs";
import os from "os";
import path from "path";

export interface Preferences {
  autoCloseAfterDone: boolean;
  theme?: "dark" | "light";
}

const DEFAULTS: Preferences = { autoCloseAfterDone: false };

function defaultPreferencesFile(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "pinpoint", "preferences.json");
}

/**
 * One-time migration from the v0.3.0 location (~/.pinpoint/preferences.json)
 * which collided with install.sh's install dir. Safe to run repeatedly: a
 * no-op once the new file exists or the legacy one is gone. Best-effort —
 * any error here is swallowed because a user's pref isn't worth crashing for.
 *
 * Exported for unit tests; the constructor wires in real paths.
 */
export function migrateLegacyPreferences(target: string, legacy: string): void {
  if (fs.existsSync(target)) return;
  if (!fs.existsSync(legacy)) return;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(legacy, target);
    // Remove the legacy dir if (and only if) we just emptied it. If it has
    // anything else inside (e.g. a real clone with src/, dist/) leave it.
    try { fs.rmdirSync(path.dirname(legacy)); } catch {}
  } catch {}
}

export class PreferencesStore {
  private file: string;

  constructor(file?: string) {
    this.file = file ?? defaultPreferencesFile();
    if (!file) {
      const legacy = path.join(os.homedir(), ".pinpoint", "preferences.json");
      migrateLegacyPreferences(this.file, legacy);
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }

  async load(): Promise<Preferences> {
    try {
      const raw = await fs.promises.readFile(this.file, "utf-8");
      const parsed = JSON.parse(raw) as Partial<Preferences>;
      return { ...DEFAULTS, ...parsed };
    } catch {
      return { ...DEFAULTS };
    }
  }

  async save(prefs: Partial<Preferences>): Promise<Preferences> {
    const current = await this.load();
    const merged = { ...current, ...prefs };
    await fs.promises.writeFile(this.file, JSON.stringify(merged, null, 2));
    return merged;
  }
}
