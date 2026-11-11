/**
 * Opening flight. Normal motion, Pause is never pressed.
 * Compares the rendered framebuffer, projected nodes, and labels
 * on the frame before Start with the frames just after it.
 *   node qa/tour-open.mjs http://127.0.0.1:8766
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:8766";
const chromeBin = process.env.CHROME || "/usr/local/bin/google-chrome";
const out = process.env.SHOTS || "/tmp/tour-open";
mkdirSync(out, { recursive: true });

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const screenDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
await page.waitForTimeout(2000);
const startState = await page.evaluate(() => ({
  code: document.querySelector("#code").textContent,
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
  const watch = ["xrp", "ripple", "xrpl", "rlusd"].map((id) => ({ id, i: space.s.idx.get(id) })).filter((item) => item.i !== undefined);
  const gl = space.renderer.getContext();
  const gridW = 96;
  const gridH = 60;
  space.opts.onFrame = () => {
    if (prev) prev();
    const cam = space.camera;
    const pixels = new Uint8Array(gridW * gridH * 4);
    gl.readPixels(
      Math.round((space.w - gridW) / 2),
      Math.round((space.h - gridH) / 2),
      gridW,
      gridH,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 16) lit += pixels[i] + pixels[i + 1] + pixels[i + 2];
    const nodes = {};
    for (const item of watch) {
      const p = space.nodeVec(item.i).project(cam);
      nodes[item.id] = { x: (p.x + 1) / 2 * space.w, y: (1 - p.y) / 2 * space.h };
    }
    let posSum = 0;
    for (let i = 0; i < Math.min(space.nodePos.length, 90); i++) posSum += space.nodePos[i];
    let shown = 0;
    const vis = space.iState.array;
    for (let i = 0; i < vis.length; i++) if (vis[i] >= 0) shown++;
    const labels = [...document.querySelectorAll("#labels3d .lab")].filter((el) => (el.style.opacity || "1") !== "0").map((el) => {
      const r = el.querySelector("span").getBoundingClientRect();
      return { t: el.textContent.trim(), x: r.left, y: r.top };
    });
    frames.push({
      cam: cam.position.toArray(),
      target: space.controls.target.toArray(),
      fov: cam.fov,
      zoom: cam.zoom,
      aspect: cam.aspect,
      wh: [space.w, space.h],
      nodes,
      posSum,
      shown,
      pixels,
      lit,
      labels,
    });
    if (frames.length > 240) frames.shift();
  };
});
await page.click("#tourBtn");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/menu.png` });
const beforeIndex = await page.evaluate(() => window.__openFrames.length - 1);
await page.click("#tourList button:nth-child(2)");
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
await page.screenshot({ path: `${out}/just-after.png` });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/open-1s.png` });
await page.waitForTimeout(4500);
await page.screenshot({ path: `${out}/open-arrival.png` });
const measured = await page.evaluate((beforeIndex) => {
  const frames = window.__openFrames;
  const before = frames[beforeIndex];
  const first = frames[beforeIndex + 1] || frames[frames.length - 1];
  const later = frames[Math.min(frames.length - 1, beforeIndex + 12)];
  const mad = (a, b) => {
    let s = 0;
    const n = Math.min(a.length, b.length);
    let count = 0;
    for (let i = 0; i < n; i += 4) {
      s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      count += 3;
    }
    return s / count;
  };
  const leg = frames.slice(beforeIndex);
  return {
    code: document.querySelector("#code").textContent,
    pause: document.querySelector("#pauseBtn").textContent,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    step: document.querySelector("#tCount").textContent,
    before: { cam: before.cam, target: before.target, fov: before.fov, zoom: before.zoom, aspect: before.aspect, wh: before.wh, nodes: before.nodes, posSum: before.posSum, shown: before.shown, lit: before.lit, labels: before.labels },
    first: { cam: first.cam, target: first.target, fov: first.fov, zoom: first.zoom, aspect: first.aspect, wh: first.wh, nodes: first.nodes, posSum: first.posSum, shown: first.shown, lit: first.lit, labels: first.labels },
    laterCam: later.cam,
    pixelMadFirst: mad(before.pixels, first.pixels),
    pixelMadLater: mad(before.pixels, later.pixels),
    legCount: leg.length,
  };
}, beforeIndex);
const firstMove = dist(measured.before.cam, measured.first.cam);
const firstTargetMove = dist(measured.before.target, measured.first.target);
const route = dist(measured.before.cam, measured.laterCam);
const nodeJumps = Object.keys(measured.before.nodes).map((id) => ({
  id,
  px: +screenDist(measured.before.nodes[id], measured.first.nodes[id]).toFixed(2),
}));
const kept = measured.before.labels.filter((label) => measured.first.labels.some((item) => item.t === label.t && Math.hypot(item.x - label.x, item.y - label.y) < 24));
console.log("CODE", measured.code);
console.log("BEFORE_CAM", measured.before.cam.map((n) => Math.round(n)), "target", measured.before.target.map((n) => Math.round(n)));
console.log("FIRST_CAM", measured.first.cam.map((n) => Math.round(n)), "target", measured.first.target.map((n) => Math.round(n)));
console.log("DELTAS", JSON.stringify({
  cam: +firstMove.toFixed(2),
  target: +firstTargetMove.toFixed(2),
  route: Math.round(route),
  pixelMadFirst: +measured.pixelMadFirst.toFixed(2),
  pixelMadLater: +measured.pixelMadLater.toFixed(2),
  lit: measured.before.lit,
  posSum: [measured.before.posSum, measured.first.posSum],
  shown: [measured.before.shown, measured.first.shown],
  fov: [measured.before.fov, measured.first.fov],
  zoom: [measured.before.zoom, measured.first.zoom],
  wh: [measured.before.wh, measured.first.wh],
  nodes: nodeJumps,
  labelsKept: `${kept.length}/${measured.before.labels.length}`,
}));
console.log("LABELS_BEFORE", measured.before.labels.map((label) => label.t).join(" | "));
console.log("LABELS_FIRST", measured.first.labels.map((label) => label.t).join(" | "));
const samePicture = measured.before.posSum === measured.first.posSum
  && measured.before.shown === measured.first.shown
  && measured.before.fov === measured.first.fov
  && measured.before.zoom === measured.first.zoom
  && measured.before.wh.join() === measured.first.wh.join();
const pixelsContinuous = measured.before.lit > 200
  && measured.pixelMadLater > 4
  && measured.pixelMadFirst < 4
  && measured.pixelMadFirst < measured.pixelMadLater * 0.35;
const nodesContinuous = nodeJumps.every((item) => item.px < 8);
const labelsContinuous = kept.length === measured.before.labels.length && measured.before.labels.length >= 6;
const cameraContinuous = route > 200 && firstMove < route * 0.08 && firstTargetMove < route * 0.08;
const motionOk = measured.pause === "Pause" && measured.reduced === false && startState.motionOff === false;
const stampOk = measured.code === "space-preview-9" && startState.code === "space-preview-9";
console.log(stampOk ? "PASS code stamp space-preview-9" : "FAIL code stamp");
console.log(samePicture ? "PASS world positions, visibility, fov, zoom, and canvas size stay put" : "FAIL scene or projection changed at Start");
console.log(pixelsContinuous ? "PASS rendered framebuffer stays continuous across Start" : "FAIL rendered framebuffer jumped at Start");
console.log(nodesContinuous ? "PASS projected nodes stay within 8px" : "FAIL projected nodes jumped");
console.log(labelsContinuous ? "PASS overview labels stay on their first-frame positions" : "FAIL overview labels changed at Start");
console.log(cameraContinuous ? "PASS camera and look target move a tiny fraction of the route" : "FAIL camera jumped");
console.log(motionOk ? "PASS pause was not used and reduced motion is off" : "FAIL motion state");
await page.waitForTimeout(400);
const video = page.video();
await context.close();
if (video) console.log("VIDEO", await video.path());
await browser.close();
if (!stampOk || !samePicture || !pixelsContinuous || !nodesContinuous || !labelsContinuous || !cameraContinuous || !motionOk) process.exit(1);
console.log("OPENING FLIGHT PASSED");
