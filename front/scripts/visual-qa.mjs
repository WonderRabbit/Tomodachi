import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.TOMODACHI_FRONT_URL ?? "http://127.0.0.1:5173";
const evidenceDir =
  process.env.TOMODACHI_FRONT_QA_DIR ?? "/private/tmp/tomodachi-front-qa";

const routes = [
  ["/login", "Sign in to Tomodachi"],
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
const captures = [];
const authenticatedChecks = [];

for (const viewport of [
  { name: "desktop", width: 1440, height: 980 },
  { name: "mobile", width: 390, height: 920 },
]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  for (const [route, expected] of routes) {
    const screenshotPath = `${evidenceDir}/${routeSlug(route)}-${viewport.name}.png`;

    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    captures.push({
      route,
      viewport: viewport.name,
      path: screenshotPath,
    });

    const bodyText = await page.locator("body").innerText();
    checks.push({
      route,
      viewport: viewport.name,
      expected,
      visible: bodyText.includes(expected),
      textLength: bodyText.length,
    });
  }
}

async function captureLegacyDashboardScreenshots() {
  await page.setViewportSize({ width: 1440, height: 980 });
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
}

await captureLegacyDashboardScreenshots();
await captureAuthenticatedShellScreenshots();

await browser.close();

const failed = checks.filter((check) => !check.visible);
const failedAuthenticated = authenticatedChecks.filter((check) => !check.ok);
const result = {
  ok: failed.length === 0 && failedAuthenticated.length === 0,
  authenticatedChecks,
  baseUrl,
  evidenceDir,
  captures,
  checks,
};

await writeFile(`${evidenceDir}/visual-qa.json`, JSON.stringify(result, null, 2));

if (failed.length > 0 || failedAuthenticated.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function routeSlug(route) {
  if (route === "/") {
    return "dashboard";
  }

  return route
    .replace(/^\//, "")
    .replace(/\$/g, "param-")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function captureAuthenticatedShellScreenshots() {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.localStorage.setItem(
      "tomodachi.auth.session.v1",
      JSON.stringify({
        accessToken: "test-token-visual-qa",
        createdAt: new Date().toISOString(),
        email: "admin@tomodachi.local",
        tokenType: "Bearer",
      }),
    );
  });

  for (const viewport of [
    { name: "authenticated-desktop", width: 1440, height: 980 },
    { name: "authenticated-mobile", width: 390, height: 920 },
  ]) {
    const screenshotPath = `${evidenceDir}/dashboard-${viewport.name}.png`;

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    captures.push({
      route: "/",
      viewport: viewport.name,
      path: screenshotPath,
    });

    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    authenticatedChecks.push({
      route: "/",
      viewport: viewport.name,
      ok: metrics.scrollWidth <= metrics.innerWidth,
      innerWidth: metrics.innerWidth,
      scrollWidth: metrics.scrollWidth,
    });
  }

  await page.evaluate(() => window.localStorage.removeItem("tomodachi.auth.session.v1"));
}
