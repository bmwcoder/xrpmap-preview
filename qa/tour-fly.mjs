/**
 * Records a real camera fly on the live WebGL view.
 *   node qa/tour-fly.mjs http://127.0.0.1:8766
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:8766";
const chrome = process.env.CHROME || "/usr/local/bin/google-chrome";
const out = process.env.SHOTS || "/tmp/tour-fly";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  recordVideo: { dir: out, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__spacePreview && window.__spacePreview.ready, null, { timeout: 30000 });
await page.waitForTimeout(600);
const draw = await page.evaluate(() => window.__spacePreview.draw);
console.log("DRAW", JSON.stringify(draw));
await page.screenshot({ path: `${out}/desktop-home.png` });
const start = await page.evaluate(() => window.__spacePreview.engine.camera.position.toArray());
await page.click("#tourBtn");
await page.click("#tourList button:nth-child(2)");
const samples = [start];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(250);
  samples.push(await page.evaluate(() => window.__spacePreview.engine.camera.position.toArray()));
}
await page.screenshot({ path: `${out}/desktop-tour-mid.png` });
const moved = samples.slice(1).map((p) => Math.hypot(p[0] - start[0], p[1] - start[1], p[2] - start[2]));
const peak = Math.max(...moved);
const mid = moved[2];
console.log("PATH", moved.map((n) => Math.round(n)).join(" "));
const flying = peak > 80 && mid > 20 && mid < peak * 0.98;
console.log(flying ? "PASS camera travels during the tour" : "FAIL camera did not travel", `peak ${Math.round(peak)} mid ${Math.round(mid)}`);
await page.click("#tNext");
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/desktop-tour-next.png` });
await page.click("#pauseBtn");
const paused = await page.locator("#pauseBtn").innerText();
console.log(paused === "Resume motion" ? "PASS pause can be resumed" : "FAIL pause label", paused);
await page.click("#pauseBtn");
await page.click("#tStop");
const ended = await page.evaluate(() => document.querySelector("#tour").hidden);
console.log(ended ? "PASS tour exit" : "FAIL tour still open");
await page.click("#homeBtn");
await page.waitForTimeout(400);
const home = await page.evaluate(() => document.querySelector("#panel").hidden);
console.log(home ? "PASS home after tour" : "FAIL home");
const video = page.video();
await context.close();
if (video) {
  const path = await video.path();
  console.log("VIDEO", path);
}
await browser.close();
if (!flying || paused !== "Resume motion" || !ended || !home) process.exit(1);
console.log("TOUR FLY PASSED");
