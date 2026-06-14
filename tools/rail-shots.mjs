// Screenshot the offline rail preview pages in light + dark.
// Uses a SYSTEM browser to dodge Playwright's broken download on Arch.
// Install one (e.g. `sudo pacman -S chromium`) then run:
//   CHROME_PATH=/usr/bin/chromium node tools/rail-shots.mjs
import { chromium } from "playwright";
import { existsSync } from "fs";

const candidates = [
  process.env.CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
].filter(Boolean);
const execPath = candidates.find((p) => existsSync(p));
if (!execPath) {
  console.error("No system browser found. Set CHROME_PATH or install chromium.");
  process.exit(1);
}

const shots = [
  { url: "file:///tmp/rail-landing.html", name: "landing", star: ["midtown", "five-points"] },
  { url: "file:///tmp/rail-landing.html", name: "landing-empty", star: [] },
  { url: "file:///tmp/rail-station.html", name: "station", star: ["five-points"] },
  { url: "file:///tmp/rail-train.html", name: "train", star: [] },
];

const browser = await chromium.launch({ headless: true, executablePath: execPath });
for (const scheme of ["light", "dark"]) {
  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: { width: 418, height: 880 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    await ctx.addInitScript((star) => {
      localStorage.setItem("rail-starred", JSON.stringify(star));
    }, s.star);
    const page = await ctx.newPage();
    await page.goto(s.url, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(600);
    const out = `/tmp/shot-${s.name}-${scheme}.png`;
    await page.screenshot({ path: out, fullPage: scheme === "light" && s.name === "landing" });
    console.log("📸", out);
    await ctx.close();
  }
}
await browser.close();
