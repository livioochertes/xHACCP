import cron from "node-cron";
import { generateWeeklyBlogPost } from "./ai-blog-generator";
import { readScheduleConfig, writeScheduleConfig, type BlogScheduleConfig } from "./blog-schedule-config";

let scheduledTask: cron.ScheduledTask | null = null;
let currentConfig: BlogScheduleConfig | null = null;

function buildCronExpression(config: BlogScheduleConfig): string {
  const days = Math.max(1, Math.min(30, config.intervalDays));
  const hour = Math.max(0, Math.min(23, config.hour));
  if (days === 1) return `0 ${hour} * * *`;
  return `0 ${hour} */${days} * *`;
}

export function startBlogScheduler() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[Blog Scheduler] ANTHROPIC_API_KEY lipsă — scheduler-ul nu va porni.");
    return;
  }

  const config = readScheduleConfig();
  currentConfig = config;

  if (!config.enabled) {
    console.log("[Blog Scheduler] Dezactivat prin configurație.");
    return;
  }

  const cronExpr = buildCronExpression(config);
  console.log(`[Blog Scheduler] Pornit — cron: "${cronExpr}", interval: la fiecare ${config.intervalDays} zi(le), ora ${config.hour}:00 (Bucharest)`);

  scheduledTask = cron.schedule(
    cronExpr,
    async () => {
      console.log("[Blog Scheduler] Se generează articole automate pentru toate piețele...");
      for (const market of ["ro", "fr", "com"] as const) {
        try {
          const postId = await generateWeeklyBlogPost(market);
          console.log(`[Blog Scheduler] Articol generat pentru market '${market}'! ID: ${postId}`);
        } catch (error) {
          console.error(`[Blog Scheduler] Eroare la market '${market}':`, error);
        }
      }
    },
    { scheduled: true, timezone: "Europe/Bucharest" }
  );
}

export function stopBlogScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Blog Scheduler] Oprit.");
  }
}

export function restartBlogScheduler(newConfig: BlogScheduleConfig) {
  stopBlogScheduler();
  writeScheduleConfig(newConfig);
  currentConfig = newConfig;
  startBlogScheduler();
}

export function getSchedulerConfig(): BlogScheduleConfig {
  return readScheduleConfig();
}
