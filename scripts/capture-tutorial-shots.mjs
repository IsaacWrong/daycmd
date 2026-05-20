// Capture screenshots of the running daycmd dev server for the Remotion tutorials.
//
// Usage:
//   1. Start the dev server in another terminal: `npm run dev` (with VAULT_PATH set)
//   2. Optionally set a dummy ANTHROPIC_API_KEY in .env.local to bypass /setup
//   3. node scripts/capture-tutorial-shots.mjs [http://localhost:3000]
//
// Output: PNGs into remotion/shots/. Existing files are overwritten.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = "remotion/shots";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const TODS = ["dawn", "morning", "noon", "afternoon", "dusk", "night", "deep"];
const setTod = (tod) =>
  page.evaluate(
    ({ all, t }) => {
      const root = document.documentElement;
      for (const x of all) root.classList.remove(`tod-${x}`);
      root.classList.add(`tod-${t}`);
      const frame = document.querySelector(".daycmd-frame");
      if (frame) {
        for (const x of all) frame.classList.remove(`tod-${x}`);
        frame.classList.add(`tod-${t}`);
      }
    },
    { all: TODS, t: tod },
  );

const goto = async (path, tod = "morning") => {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(500);
  await setTod(tod);
  await page.waitForTimeout(300);
};

const sectionByTitle = (title) =>
  page.evaluateHandle((t) => {
    const headings = Array.from(document.querySelectorAll("h3"));
    const h = headings.find((x) => x.textContent && x.textContent.trim() === t);
    return h ? h.closest("section") : null;
  }, title);

const shotSection = async (title, name) => {
  const handle = await sectionByTitle(title);
  const el = handle.asElement();
  if (!el) {
    console.warn(`  miss: ${title}`);
    return;
  }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await el.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  -> ${name}.png`);
};

const fillByPlaceholder = async (sub, val) => {
  const inps = await page.$$("input[placeholder]");
  for (const inp of inps) {
    const ph = (await inp.getAttribute("placeholder")) || "";
    if (ph.includes(sub)) {
      await inp.fill(val);
      return;
    }
  }
};

try {
  console.log("settings (blank → progressively filled)");
  await goto("/settings", "morning");
  for (const inp of await page.$$("input")) await inp.fill("");
  await page.waitForTimeout(300);
  await shotSection("Keys & tokens", "keys-blank");
  await shotSection("Budget", "budget-zero");

  await fillByPlaceholder("Documents/Your Vault", "/Users/you/Documents/notes");
  await page.waitForTimeout(150);
  await shotSection("Keys & tokens", "keys-vault");

  await fillByPlaceholder("sk-ant-api03", "sk-ant-api03-•••••••••••••••••••••••••");
  await page.waitForTimeout(150);
  await shotSection("Keys & tokens", "keys-anth");

  await fillByPlaceholder("ghp_", "ghp_1A2b3C4d5E6F7g8H9i0J1k2L3m4N5o6P7q8R");
  await page.waitForTimeout(150);
  await shotSection("Keys & tokens", "keys-gh");

  await fillByPlaceholder("apps.googleusercontent.com", "437802918374-abcd1234.apps.googleusercontent.com");
  await fillByPlaceholder("GOCSPX-", "GOCSPX-abcdefghijklmnopqrstuv");
  await page.waitForTimeout(200);
  await shotSection("Keys & tokens", "keys-all");

  console.log("budget (set state)");
  const nums = await page.$$('input[type="number"]');
  if (nums[0]) await nums[0].fill("10");
  if (nums[1]) await nums[1].fill("80");
  await page.waitForTimeout(200);
  await shotSection("Budget", "budget-ten");

  console.log("integrations (not configured)");
  for (const inp of await page.$$("input")) await inp.fill("");
  await page.waitForTimeout(200);
  await shotSection("Integrations", "int-empty");

  console.log("home (morning)");
  await goto("/", "morning");
  await page.screenshot({ path: `${OUT}/home.png` });
  console.log("  -> home.png");

  const knNav = await page.$('button:has-text("Knowledge"), a:has-text("Knowledge")');
  if (knNav) {
    await knNav.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/home-knowledge.png` });
    console.log("  -> home-knowledge.png");
  }

  console.log("agent expanded (dusk)");
  await goto("/", "dusk");
  await page.keyboard.press("Meta+j");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/agent-expanded.png` });
  console.log("  -> agent-expanded.png");
} finally {
  await browser.close();
}
console.log("done");
