import { processDueSubscriptions } from "./subscription-service";

let running = false;

export function startSubscriptionScheduler() {
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const count = await processDueSubscriptions();
      if (count > 0) console.log(`[Subscriptions] Processed ${count} renewal(s)`);
    } catch (error) {
      console.error("[Subscriptions] Scheduler run failed:", error);
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => void run(), 60 * 60 * 1000);
  console.log("[Subscriptions] Scheduler active — hourly renewal checks");
}