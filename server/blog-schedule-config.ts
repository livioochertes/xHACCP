import fs from "fs";
import path from "path";

export interface BlogScheduleConfig {
  enabled: boolean;
  intervalDays: number;
  hour: number;
}

const CONFIG_PATH = path.join(process.cwd(), "server", "blog-schedule-config.json");

const DEFAULT_CONFIG: BlogScheduleConfig = {
  enabled: true,
  intervalDays: 7,
  hour: 8,
};

export function readScheduleConfig(): BlogScheduleConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}

export function writeScheduleConfig(config: BlogScheduleConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
