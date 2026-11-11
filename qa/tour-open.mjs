/**
 * Opening flight only. Normal motion, Pause is never pressed.
 * Samples the camera before Start and on every animation frame of the first leg.
 *   node qa/tour-open.mjs http://127.0.0.1:8766
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:8766";
const chromeBin = process.env.CHROME || "/usr/local/bin/google-chrome";
const out = process.env.SHOTS || "/tmp/tour-open";
mkdirSync(out, { recursive: true });

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const browser = await chromium.launch({
  executablePath: chromeBin,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
  recordVideo: { dir: out, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__spacePreview && window.__spacePreview.ready, null, { timeout: 30000 });
await page.waitForTimeout(3500);
const startState = await page.evaluate(() => ({
  pause: document.querySelector("#pauseBtn").textContent,
  pressed: document.querySelector("#pauseBtn").getAttribute("aria-pressed"),
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  motionOff: window.__spacePreview.motionOff,
}));
console.log("START", JSON.stringify(startState));
await page.evaluate(() => {
  const space = window.__spacePreview.engine;
  const frames = [];
  window.__openFrames = frames;
  const prev = space.opts.onFrame;
  space.opts.onFrame = () => {
    if (prev) prev();
    frames.push({
      cam: space.camera.position.toArray(),
      target: space.controls.target.toArray(),
      step: document.querySelector("#tCount") ? document.querySelector("#tCount").textContent : "",
      ms: performance.now(),
    });
  };
});
await page.screenshot({ path: `${out}/overview.png` });
await page.click("#tourBtn");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/menu.png` });
const before = await page.evaluate(() => {
  const space = window.__spacePreview.engine;
  const labels = [...document.querySelectorAll("#labels3d .lab")]
    .filter((el) => parseFloat(el.style.opacity || "1") > 0.5)
    .map((el) => el.textContent.trim());
  return {
    cam: space.camera.position.toArray(),
    target: space.controls.target.toArray(),
    labels,
    n: window.__openFrames.length,
  };
});
await page.click("#tourList button:nth-child(2)");
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const early = await page.evaluate((mark) => {
  const frames = window.__openFrames;
  const first = frames[mark] || frames[frames.length - 1];
  const labels = [...document.querySelectorAll("#labels3d .lab")]
    .filter((el) => parseFloat(el.style.opacity || "1") > 0.5)
    .map((el) => el.textContent.trim());
  return { first, mark, len: frames.length, step: document.querySelector("#tCount").textContent, labels };
}, before.n);
await page.screenshot({ path: `${out}/just-after-start.png` });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/open-2s.png` });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/open-4s.png` });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/open-arrival.png` });
const end = await page.evaluate((mark) => {
  const frames = window.__openFrames;
  const leg = [];
  for (let i = Math.max(0, mark - 1); i < frames.length; i++) {
    if (frames[i].step && frames[i].step !== "1 of 3" && leg.length) break;
    leg.push(frames[i]);
  }
  return {
    pause: document.querySelector("#pauseBtn").textContent,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    step: document.querySelector("#tCount").textContent,
    leg: leg.filter((_, i) => i % 8 === 0).map((frame) => ({
      cam: frame.cam.map((n) => Math.round(n)),
      target: frame.target.map((n) => Math.round(n)),
    })),
    legCount: leg.length,
  };
}, before.n);
const firstCam = early.first.cam;
const firstTarget = early.first.target;
const firstMove = dist(before.cam, firstCam);
const firstTargetMove = dist(before.target, firstTarget);
const route = dist(before.cam, end.leg.at(-1) ? end.leg.at(-1).cam : firstCam);
console.log("BEFORE", before.cam.map((n) => Math.round(n)), "target", before.target.map((n) => Math.round(n)));
console.log("FIRST_FRAME", firstCam.map((n) => Math.round(n)), "target", firstTarget.map((n) => Math.round(n)));
const kept = before.labels.filter((name) => early.labels.includes(name));
console.log("LABELS_BEFORE", JSON.stringify(before.labels));
console.log("LABELS_FIRST", JSON.stringify(early.labels));
console.log("FIRST_DELTAS", JSON.stringify({ cam: Math.round(firstMove), target: Math.round(firstTargetMove), route: Math.round(route), frames: end.legCount, labelsKept: kept.length, labelsBefore: before.labels.length }));
console.log("LEG", JSON.stringify(end.leg));
console.log("STATE", JSON.stringify({ pause: end.pause, reduced: end.reduced, step: end.step }));
const tiny = route > 200 && firstMove < route * 0.08 && firstTargetMove < route * 0.08;
const labelsHeld = before.labels.length >= 4 && kept.length >= Math.ceil(before.labels.length * 0.7);
console.log(tiny ? "PASS opening first frame stays on the overview pose" : "FAIL opening first frame jumped");
console.log(labelsHeld ? "PASS opening first frame keeps the overview names" : "FAIL opening first frame replaced the overview names");
console.log(end.pause === "Pause" && end.reduced === false ? "PASS pause was not used and reduced motion is off" : "FAIL motion state");
await page.waitForTimeout(1500);
const video = page.video();
await context.close();
if (video) console.log("VIDEO", await video.path());
await browser.close();
if (!tiny || !labelsHeld || end.pause !== "Pause" || end.reduced) process.exit(1);
console.log("OPENING FLIGHT PASSED");
