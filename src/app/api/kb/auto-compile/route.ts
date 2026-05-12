import { NextResponse } from "next/server";
import { listAllStats } from "@/lib/kb";
import {
  ensureDefaultKbAutomations,
  listAutomations,
  runAutomation,
} from "@/lib/automations";
import { reloadScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_MS = 6 * 60 * 60_000;
let lastSweepAt = 0;
const SWEEP_DEBOUNCE_MS = 5 * 60_000;

/**
 * Stale-check: for each KB category, if drift > 0 AND (no compile yet OR last
 * compile > 6h ago), fire its compile automation in the background. Idempotent
 * — debounced 5min so repeated dashboard loads don't pile up sweeps.
 */
export async function POST() {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_DEBOUNCE_MS) {
    return NextResponse.json({ skipped: "debounced" });
  }
  lastSweepAt = now;

  // Make sure default rows exist (also seeds on first call after install).
  let seeded: string[] = [];
  try {
    const r = await ensureDefaultKbAutomations();
    seeded = r.created;
    if (seeded.length) reloadScheduler();
  } catch {}

  const stats = await listAllStats();
  const automations = listAutomations();
  const fired: string[] = [];

  for (const s of stats) {
    if (s.driftCount === 0) continue;
    const stale = !s.lastCompileAt || now - s.lastCompileAt > STALE_MS;
    if (!stale) continue;
    const compileAuto = automations.find(
      (x) => x.kind === "compile" && x.target_category === s.name && x.enabled,
    );
    if (!compileAuto) continue;
    const lintAuto = automations.find(
      (x) => x.kind === "lint" && x.target_category === s.name && x.enabled,
    );
    // Fire-and-forget — compile can take minutes; chain lint after it.
    (async () => {
      try {
        await runAutomation(compileAuto.id);
        if (lintAuto) await runAutomation(lintAuto.id);
      } catch (e) {
        console.error(`[auto-compile] ${s.name} failed:`, (e as Error).message);
      }
    })();
    fired.push(s.name);
  }

  return NextResponse.json({ fired, seeded });
}

export async function GET() {
  return POST();
}
