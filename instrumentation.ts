export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_SCHEDULER !== "1") {
    console.log("[scheduler] disabled (set ENABLE_SCHEDULER=1 to enable)");
    return;
  }
  const { startScheduler } = await import("./src/lib/scheduler");
  startScheduler();
}
