export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // The vault trash sweep (audit #29) is intentionally NOT wired here.
  // It runs opportunistically inside writeDailyNote (see src/lib/obsidian.ts)
  // so it doesn't require ENABLE_SCHEDULER=1 to keep <vault>/.daycmd/trash/
  // bounded. The agent touches the daily note often enough that one
  // sweep-per-UTC-day is sufficient; this avoids a second cron and the
  // associated risk of forgetting to gate it on VAULT_PATH being set.
  if (process.env.ENABLE_SCHEDULER !== "1") {
    console.log("[scheduler] disabled (set ENABLE_SCHEDULER=1 to enable)");
    return;
  }
  const { startScheduler } = await import("./src/lib/scheduler");
  startScheduler();
}
