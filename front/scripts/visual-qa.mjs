import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.TOMODACHI_FRONT_URL ?? "http://127.0.0.1:5173";
const evidenceDir =
  process.env.TOMODACHI_FRONT_QA_DIR ?? "/private/tmp/tomodachi-front-qa";

const routes = [
  ["/", "Tomodachi operations"],
  ["/projects", "Projects"],
  ["/projects/project_alpha", "Lifecycle dashboard alpha"],
  ["/projects/project_alpha/tasks/board", "Task board"],
  ["/tasks", "Cross-project execution table"],
  ["/tasks/task_102", "Define task transition rollback surface"],
  ["/architecture", "Architecture registry"],
  ["/architecture/adr/adr_001", "Backend owns OpenCode normalized metadata"],
  ["/agent-runs", "Agent runs"],
  ["/agent-runs/run_review_01", "run_review_01"],
  ["/settings", "Settings"],
];

await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1,
});

const checks = [];

for (const [route, expected] of routes) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  const bodyText = await page.locator("body").innerText();
  checks.push({
    route,
    expected,
    visible: bodyText.includes(expected),
    textLength: bodyText.length,
  });
}

await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await page.screenshot({
  path: `${evidenceDir}/dashboard-desktop.png`,
  fullPage: true,
});

await page.setViewportSize({ width: 390, height: 920 });
await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await page.screenshot({
  path: `${evidenceDir}/dashboard-mobile.png`,
  fullPage: true,
});

await browser.close();

const failed = checks.filter((check) => !check.visible);
const result = {
  ok: failed.length === 0,
  baseUrl,
  evidenceDir,
  checks,
};

await writeFile(`${evidenceDir}/visual-qa.json`, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
