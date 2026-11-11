/**
 * Uninterrupted normal-motion tour. Does not press Pause.
 * A second context checks reduced motion separately.
 *   node qa/tour-fly.mjs http://127.0.0.1:8766
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:8766";
const chrome = process.env.CHROME || "/usr/local/bin/google-chrome";
const out = process.env.SHOTS || "/tmp/tour-fly3";
mkdirSync(out, { recursive: true });
mkdirSync(`${out}/frames`, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
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
await page.waitForTimeout(500);
const startState = await page.evaluate(() => ({
  pause: document.querySelector("#pauseBtn").textContent,
  pressed: document.querySelector("#pauseBtn").getAttribute("aria-pressed"),
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  motionOff: window.__spacePreview.motionOff,
  draw: window.__spacePreview.draw,
}));
console.log("START", JSON.stringify(startState));
if (startState.reduced || startState.motionOff || startState.pause !== "Pause") {
  console.error("FAIL normal-motion recording started paused or reduced");
  process.exit(1);
}

const phone = await browser.newContext({
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  reducedMotion: "no-preference",
});
const phonePage = await phone.newPage();
await phonePage.goto(`${base}/`, { waitUntil: "domcontentloaded" });
await phonePage.waitForFunction(() => window.__spacePreview && window.__spacePreview.ready, null, { timeout: 30000 });
await phonePage.waitForTimeout(800);
const phoneDraw = await phonePage.evaluate(() => window.__spacePreview.draw);
console.log("PHONE_DRAW", JSON.stringify(phoneDraw));
await phonePage.screenshot({ path: `${out}/phone-edges.png` });
await phone.close();

await page.screenshot({ path: `${out}/desktop-before-tour.png` });
await page.click("#tourBtn");
await page.click("#tourList button:nth-child(2)");
const samples = [];
const t0 = Date.now();
let lastStep = "";
const legs = [];
while (Date.now() - t0 < 24000) {
  const snap = await page.evaluate(() => {
    const space = window.__spacePreview.engine;
    const p = space.camera.position;
    const g = space.controls.target;
    return {
      step: document.querySelector("#tCount").textContent,
      cam: [p.x, p.y, p.z],
      target: [g.x, g.y, g.z],
      motion: document.querySelector("#tMotion").textContent,
      pause: document.querySelector("#pauseBtn").textContent,
    };
  });
  const elapsed = Date.now() - t0;
  samples.push({ t: elapsed, ...snap });
  if (snap.step !== lastStep) {
    legs.push({ step: snap.step, t: elapsed, index: samples.length - 1 });
    lastStep = snap.step;
  }
  if (elapsed % 2000 < 280) await page.screenshot({ path: `${out}/frames/t${String(elapsed).padStart(5, "0")}.png` });
  await page.waitForTimeout(250);
}
const moved = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
console.log("LEGS", JSON.stringify(legs));
console.log("SAMPLES", samples.length, "span", samples.at(-1).t);
let smooth = true;
for (let i = 0; i < legs.length; i++) {
  const from = legs[i].index;
  const to = i + 1 < legs.length ? legs[i + 1].index : samples.length - 1;
  const leg = samples.slice(from, to + 1);
  if (leg.length < 4) continue;
  const total = moved(leg[0].cam, leg.at(-1).cam);
  let biggest = 0;
  for (let k = 1; k < leg.length; k++) biggest = Math.max(biggest, moved(leg[k - 1].cam, leg[k].cam));
  const targetMove = moved(leg[0].target, leg.at(-1).target);
  console.log(`LEG ${leg[0].step} cam ${Math.round(total)} biggest250 ${Math.round(biggest)} target ${Math.round(targetMove)} n ${leg.length}`);
  if (total > 200 && biggest > total * 0.45) smooth = false;
}
const stepCount = new Set(samples.map((s) => s.step)).size;
const pausedDuring = samples.some((s) => s.pause !== "Pause" || s.motion.includes("paused"));
console.log(stepCount >= 3 ? "PASS at least two Next transitions" : "FAIL steps", stepCount);
console.log(smooth ? "PASS no single sample jumps most of a leg" : "FAIL a leg has an abrupt camera step");
console.log(pausedDuring ? "FAIL pause appeared during the clip" : "PASS pause was never pressed");
console.log("MOTION_NOTE", samples.find((s) => s.motion)?.motion || "(empty, motion on)");

await context.close();
const video = page.video();
if (video) console.log("VIDEO", await video.path());

const reduced = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: "reduce",
});
const rpage = await reduced.newPage();
await rpage.goto(`${base}/`, { waitUntil: "domcontentloaded" });
await rpage.waitForFunction(() => window.__spacePreview && window.__spacePreview.ready, null, { timeout: 30000 });
const rstate = await rpage.evaluate(() => ({
  pause: document.querySelector("#pauseBtn").textContent,
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  motionOff: window.__spacePreview.motionOff,
}));
console.log("REDUCED_START", JSON.stringify(rstate));
await rpage.click("#tourBtn");
await rpage.click("#tourList button:nth-child(2)");
await rpage.waitForTimeout(400);
const jumped = await rpage.evaluate(() => window.__spacePreview.engine.camera.position.toArray());
await rpage.waitForTimeout(800);
const held = await rpage.evaluate(() => window.__spacePreview.engine.camera.position.toArray());
const drift = Math.hypot(held[0] - jumped[0], held[1] - jumped[1], held[2] - jumped[2]);
console.log("REDUCED_DRIFT", Math.round(drift));
console.log(rstate.reduced && rstate.motionOff && rstate.pause === "Resume motion" ? "PASS reduced motion starts paused" : "FAIL reduced motion was overridden");
console.log(drift < 40 ? "PASS reduced motion does not keep animating" : "FAIL reduced motion kept moving");
await reduced.close();
await browser.close();
if (stepCount < 3 || !smooth || pausedDuring || !rstate.reduced || drift >= 40) process.exit(1);
console.log("TOUR RECORDING PASSED");
