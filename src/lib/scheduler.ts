import cron, { type ScheduledTask } from "node-cron";
import {
  ensureDefaultKbAutomations,
  ensureMorningBriefAutomation,
  listAutomations,
  runAutomation,
} from "./automations";

declare global {
  var __daycmd_scheduler: {
    tasks: Map<number, { task: ScheduledTask; cron: string }>;
    started: boolean;
  } | undefined;
}

function state() {
  if (!globalThis.__daycmd_scheduler) {
    globalThis.__daycmd_scheduler = {
      tasks: new Map(),
      started: false,
    };
  }
  return globalThis.__daycmd_scheduler;
}

function unschedule(id: number) {
  const s = state();
  const entry = s.tasks.get(id);
  if (entry) {
    entry.task.stop();
    s.tasks.delete(id);
  }
}

function schedule(id: number, cronExpr: string) {
  const s = state();
  if (!cron.validate(cronExpr)) {
    console.error(`[scheduler] invalid cron for #${id}: ${cronExpr}`);
    return;
  }
  const task = cron.schedule(cronExpr, async () => {
    console.log(`[scheduler] firing automation #${id}`);
    try {
      await runAutomation(id);
    } catch (e) {
      console.error(`[scheduler] run failed:`, (e as Error).message);
    }
  });
  s.tasks.set(id, { task, cron: cronExpr });
}

export function reloadScheduler() {
  const s = state();
  for (const [id] of s.tasks) unschedule(id);
  const all = listAutomations();
  for (const a of all) {
    if (a.enabled) schedule(a.id, a.cron);
  }
  console.log(
    `[scheduler] loaded ${s.tasks.size} of ${all.length} automations`,
  );
}

export function startScheduler() {
  const s = state();
  if (s.started) return;
  s.started = true;
  ensureDefaultKbAutomations()
    .then((res) => {
      if (res.created.length) {
        console.log(`[scheduler] seeded ${res.created.length} KB automations`);
      }
      try {
        const brief = ensureMorningBriefAutomation();
        if (brief.created) console.log(`[scheduler] seeded morning brief automation`);
      } catch (e) {
        console.error(`[scheduler] brief seed failed:`, (e as Error).message);
      }
      reloadScheduler();
    })
    .catch((e) => {
      console.error(`[scheduler] KB seed failed:`, (e as Error).message);
      reloadScheduler();
    });
}

export function schedulerStatus() {
  const s = state();
  return {
    started: s.started,
    active: Array.from(s.tasks.entries()).map(([id, v]) => ({
      id,
      cron: v.cron,
    })),
  };
}
