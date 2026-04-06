import cron from "node-cron";
import { generateWeeklyBlogPost } from "./ai-blog-generator";

let scheduledTask: cron.ScheduledTask | null = null;

export function startBlogScheduler() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[Blog Scheduler] ANTHROPIC_API_KEY lipsă — scheduler-ul nu va porni.");
    return;
  }

  // Runs every Monday at 8:00 AM Bucharest time
  scheduledTask = cron.schedule(
    "0 8 * * MON",
    async () => {
      console.log("[Blog Scheduler] Se generează articol săptămânal...");
      try {
        const postId = await generateWeeklyBlogPost();
        console.log(`[Blog Scheduler] Articol generat cu succes! ID: ${postId}`);
      } catch (error) {
        console.error("[Blog Scheduler] Eroare la generarea articolului:", error);
      }
    },
    {
      scheduled: false,
      timezone: "Europe/Bucharest",
    }
  );

  scheduledTask.start();
  console.log("[Blog Scheduler] Pornit — articole generate automat în fiecare luni la 08:00 (Bucharest)");
}

export function stopBlogScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Blog Scheduler] Oprit.");
  }
}
