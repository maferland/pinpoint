import fs from "fs";
import os from "os";
import path from "path";

export interface Preferences {
  autoCloseAfterDone: boolean;
  theme?: "dark" | "light";
}

const DEFAULTS: Preferences = { autoCloseAfterDone: false };

export class PreferencesStore {
  private file: string;

  constructor(file?: string) {
    const dir = path.join(os.homedir(), ".pinpoint");
    fs.mkdirSync(dir, { recursive: true });
    this.file = file ?? path.join(dir, "preferences.json");
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
