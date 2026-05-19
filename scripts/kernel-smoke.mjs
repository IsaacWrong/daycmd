// Run a Kernel browser session against the Daycmd dashboard.
// Usage: KERNEL_API_KEY=... TARGET_URL=... node scripts/kernel-smoke.mjs

import fs from "node:fs";
import path from "node:path";
import Kernel from "@onkernel/sdk";

function loadEnvFile(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (!process.env[k]) process.env[k] = v.replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const apiKey = process.env.KERNEL_API_KEY;
if (!apiKey) {
  console.error("KERNEL_API_KEY missing — add to .env.local");
  process.exit(1);
}

const target = process.env.TARGET_URL;
if (!target) {
  console.error("TARGET_URL missing — pass tunnel URL");
  process.exit(1);
}

const client = new Kernel({ apiKey });

console.log(`[kernel] creating browser session…`);
const browser = await client.browsers.create({ stealth: false });
console.log(`[kernel] session_id=${browser.session_id}`);
console.log(`[kernel] live_view=${browser.browser_live_view_url ?? browser.live_view_url ?? "n/a"}`);
console.log(`[kernel] cdp_ws=${browser.cdp_ws_url}`);

// Connect via CDP using Playwright if available, else just print live view.
let playwright = null;
try {
  playwright = await import("playwright-core");
} catch {
  console.log(`[kernel] playwright not installed — open live view URL above to inspect manually.`);
  console.log(`[kernel] navigate the live browser to: ${target}`);
  process.exit(0);
}

const cdp = browser.cdp_ws_url;
const pwBrowser = await playwright.chromium.connectOverCDP(cdp);
const ctx = pwBrowser.contexts()[0] ?? (await pwBrowser.newContext());
const page = ctx.pages()[0] ?? (await ctx.newPage());

console.log(`[kernel] navigating to ${target}…`);
await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });

// Skip ngrok warning page if it shows
const skipBtn = await page.locator('button:has-text("Visit Site")').first();
if (await skipBtn.isVisible().catch(() => false)) {
  await skipBtn.click();
  await page.waitForLoadState("domcontentloaded");
}

await page.waitForTimeout(4000);

const shotsDir = path.join(process.cwd(), "scripts", "kernel-shots");
fs.mkdirSync(shotsDir, { recursive: true });

async function snap(name) {
  const file = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`[snap] ${file}`);
}

await snap("01-overview");

// Hover over Up next "smart" toggle to test
const smartBtn = page.getByTitle(/smart rank/i).first();
if (await smartBtn.isVisible().catch(() => false)) {
  await smartBtn.click();
  await page.waitForTimeout(8000);
  await snap("02-smart-rank-on");
}

// Refresh focus
const focusRefresh = page.getByTitle(/re-pick focus/i).first();
if (await focusRefresh.isVisible().catch(() => false)) {
  await focusRefresh.click();
  await page.waitForTimeout(6000);
  await snap("03-focus-refreshed");
}

// Toggle inbox synopsis
const synBtn = page.getByTitle(/synopsis per email|hide AI synopses/i).first();
if (await synBtn.isVisible().catch(() => false)) {
  await synBtn.click();
  await page.waitForTimeout(8000);
  await snap("04-inbox-synopsis");
}

// Open suggestions
const sugBtn = page.locator('button:has-text("suggested")').first();
if (await sugBtn.isVisible().catch(() => false)) {
  await sugBtn.click();
  await page.waitForTimeout(2000);
  await snap("05-suggestions-open");
}

console.log(`[kernel] live view URL still open: ${browser.browser_live_view_url ?? browser.live_view_url ?? "n/a"}`);
console.log(`[kernel] session_id=${browser.session_id}`);
console.log(`[kernel] keeping session alive for 10 minutes for manual inspection…`);

await page.waitForTimeout(10 * 60_000);

await pwBrowser.close();
console.log(`[kernel] done.`);
