/**
 * Browser QA for the Space preview. Not part of the page.
 * Preview root (public graph):
 *   node qa/browse.mjs http://127.0.0.1:8766
 * Source layout beside graph.json (SPACE_PATH=/space/):
 *   SPACE_PATH=/space/ node qa/browse.mjs http://127.0.0.1:8765
 *
 * Counts and the timestamp come from the graph URL the page actually loaded.
 * The fixed November snapshot stays in qa/graph.test.mjs.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright-core";
import { createModel, applyFilters } from "../js/graph.js";

const base = process.argv[2] || "http://127.0.0.1:8766";
const spacePath = process.env.SPACE_PATH || "/";
const prodUrl = process.env.PROD_URL || (spacePath === "/" ? "https://xrpmap.org/" : `${base}/`);
const chrome = process.env.CHROME || "/usr/local/bin/google-chrome";
const out = process.env.SHOTS || "/tmp/space-qa";
mkdirSync(out, { recursive: true });

const problems = [];
function check(name, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  if (!ok) problems.push(line);
}

function attach(page, bucket) {
  page.on("pageerror", (err) => bucket.errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") bucket.errors.push(msg.text());
    if (msg.type() === "warning") bucket.warnings.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (url.includes("graph.json") || url.includes("/space/")) bucket.failed.push(`${url} ${req.failure()?.errorText || ""}`);
  });
}

async function settle(page) {
  await page.waitForFunction(() => window.__spacePreview && window.__spacePreview.ready, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function readPreview(page) {
  return page.evaluate(() => {
    const p = window.__spacePreview;
    return {
      mode: p.mode,
      meta: p.meta,
      counts: p.counts,
      fps: p.fps,
      renderer: p.renderer,
      software: p.software,
      motionOff: p.motionOff,
      selected: p.selected,
      tours: p.tours,
      source: p.source,
      dataHref: p.dataHref,
      warnings: p.warnings,
    };
  });
}

const graphCache = new Map();
async function loadGraphFile(href) {
  if (!graphCache.has(href)) {
    const res = await fetch(href, { cache: "no-store" });
    if (!res.ok) throw new Error(`${href} HTTP ${res.status}`);
    graphCache.set(href, await res.json());
  }
  return graphCache.get(href);
}

async function expectationsFrom(info) {
  const data = await loadGraphFile(info.dataHref);
  const model = createModel(structuredClone(data));
  const keyShown = model.countE;
  applyFilters(model, { key: false });
  return {
    updated: data.meta.updated,
    nodes: data.nodes.length,
    edges: data.edges.length,
    keyShown,
    allShown: model.countE,
    href: info.dataHref,
    publicFile: info.dataHref.includes("xrpmap.org/graph.json"),
  };
}

async function auditScene(page) {
  return page.evaluate(() => {
    const shown = (el) => {
      if (!el || el.hidden) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    };
    const box = (el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const area = (a, b) => {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return w > 0 && h > 0 ? w * h : 0;
    };
    const labels = [...document.querySelectorAll("#labels3d .lab")].flatMap((el) => {
      const opacity = parseFloat(el.style.opacity || "1");
      const span = el.querySelector("span");
      if (!span || opacity < 0.2) return [];
      const item = box(span);
      if (item.width < 2 || item.height < 2) return [];
      return [{ text: span.textContent || "", section: el.classList.contains("sl"), box: item }];
    });
    const problems = [];
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label.box.left < -1 || label.box.top < -1 || label.box.right > innerWidth + 1 || label.box.bottom > innerHeight + 1) {
        problems.push(`clipped ${label.text}`);
      }
      for (let j = i + 1; j < labels.length; j++) {
        const overlap = area(label.box, labels[j].box);
        if (overlap > 1) problems.push(`overlap ${label.text} | ${labels[j].text}`);
      }
    }
    for (const sel of ["#top", "#filters", "#foot", "#zoom", "#panel", "#tour"]) {
      const el = document.querySelector(sel);
      if (!shown(el)) continue;
      const chrome = box(el);
      for (const label of labels) {
        if (area(label.box, chrome) > 1) problems.push(`under ${el.id} ${label.text}`);
      }
    }
    return {
      problems,
      labels: labels.map((label) => label.text),
      sections: labels.filter((label) => label.section).map((label) => label.text),
    };
  });
}

async function auditAnchors(page) {
  return page.evaluate(() => {
    const problems = [];
    const lines = [...document.querySelectorAll("#leaders line")].map((el) => ({
      x1: Number(el.getAttribute("x1")),
      y1: Number(el.getAttribute("y1")),
      x2: Number(el.getAttribute("x2")),
      y2: Number(el.getAttribute("y2")),
    }));
    const space = window.__spacePreview.engine;
    const model = space.s;
    for (const el of document.querySelectorAll("#labels3d .lab")) {
      if (el.classList.contains("sl")) continue;
      const opacity = parseFloat(el.style.opacity || "1");
      const span = el.querySelector("span");
      if (!span || opacity < 0.2) continue;
      const rect = span.getBoundingClientRect();
      const text = span.textContent;
      let nearest = null;
      for (const node of model.nodes) {
        if (node.lbl !== text || !model.vn[node.i]) continue;
        const projected = space.nodeVec(node.i).clone().project(space.camera);
        if (projected.z > 1) continue;
        const x = (projected.x + 1) / 2 * space.w;
        const y = (1 - projected.y) / 2 * space.h;
        const d = Math.hypot(x - (rect.left + rect.right) / 2, y - (rect.top + rect.bottom) / 2);
        if (!nearest || d < nearest.d) nearest = { x, y, d };
      }
      if (!nearest) continue;
      const cx = (rect.left + rect.right) / 2;
      const cy = (rect.top + rect.bottom) / 2;
      const dx = nearest.x - cx;
      const dy = nearest.y - cy;
      if (dx === 0 && dy === 0) continue;
      const scale = Math.min((rect.width / 2) / Math.abs(dx), (rect.height / 2) / Math.abs(dy));
      const ex = cx + dx * scale;
      const ey = cy + dy * scale;
      const gap = Math.hypot(nearest.x - ex, nearest.y - ey);
      if (gap < 22) continue;
      const linked = lines.some((line) => Math.hypot(line.x1 - nearest.x, line.y1 - nearest.y) < 6 && Math.hypot(line.x2 - ex, line.y2 - ey) < 6);
      if (!linked) problems.push(`${text} gap ${Math.round(gap)}`);
    }
    return { problems, lines: lines.length };
  });
}

async function auditFilters(page) {
  return page.evaluate(() => {
    const bar = document.querySelector("#filters");
    const display = getComputedStyle(bar).display;
    if (display === "none") return { open: false, problems: [] };
    const problems = [];
    for (const btn of bar.querySelectorAll("button")) {
      const rect = btn.getBoundingClientRect();
      const text = btn.textContent.trim();
      if (rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1 || rect.width < 8 || rect.height < 8) {
        problems.push(`offscreen ${text}`);
        continue;
      }
      const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
      if (!hit || (hit !== btn && !btn.contains(hit))) problems.push(`covered ${text}`);
    }
    return { open: true, problems };
  });
}

function ocr(file) {
  try { return execFileSync("tesseract", [file, "stdout", "--psm", "6"], { encoding: "utf8" }); }
  catch { return ""; }
}

async function fps(page) {
  await page.waitForTimeout(1500);
  return page.evaluate(() => window.__spacePreview.fps);
}

async function inspectXrp(page) {
  await page.fill("#q", "xrp");
  await page.waitForSelector("#results button");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#panel:not([hidden]) h2");
  const text = await page.locator("#pBody").innerText();
  const href = await page.locator("#pBody a.src").first().getAttribute("href");
  const title = await page.locator("#pTitle").innerText();
  return { text, href, title };
}

async function runProfile(browser, name, contextOptions, path) {
  const bucket = { errors: [], warnings: [], failed: [] };
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  attach(page, bucket);
  const t0 = Date.now();
  await page.goto(`${base}${spacePath}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const boot = Date.now() - t0;
  const info = await readPreview(page);
  const expected = await expectationsFrom(info);
  const from = await page.locator("#dataFrom").innerText();
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  check(`${name} ready`, info.mode === "webgl", info.mode);
  check(`${name} noindex`, (robots || "").includes("noindex"), robots || "");
  check(`${name} graph stamp`, info.source === "live" && info.meta.updated === expected.updated, `${info.source} ${info.meta && info.meta.updated} ${info.dataHref}`);
  check(`${name} counts`, info.counts.nodes === expected.nodes && info.counts.edges === expected.edges && info.counts.shownE === expected.keyShown, JSON.stringify({ page: info.counts, expected }));
  check(`${name} graph origin`, expected.publicFile ? from.includes("xrpmap.org/graph.json") : from.includes("this site"), from);
  check(`${name} updated visible`, (await page.locator("#updated").innerText()).includes("2026"), await page.locator("#updated").innerText());
  const homeAudit = await auditScene(page);
  check(`${name} home labels clear`, homeAudit.problems.length === 0, homeAudit.problems.slice(0, 6).join("; "));
  const homeAnchors = await auditAnchors(page);
  check(`${name} home label leaders`, homeAnchors.problems.length === 0, homeAnchors.problems.slice(0, 4).join("; ") || `${homeAnchors.lines} leaders`);
  check(`${name} home shows entity names`, homeAudit.labels.filter((text) => !homeAudit.sections.includes(text)).length >= (name === "phone" ? 3 : 4) && /Ripple|XRP/.test(homeAudit.labels.join(" ")), homeAudit.labels.join(" | ").slice(0, 220));
  await page.screenshot({ path: `${out}/${path}-home.png` });
  const homeFill = await page.evaluate(() => {
    const space = window.__spacePreview.engine;
    const model = space.s;
    const pts = [];
    for (const node of model.nodes) {
      if (!model.vn[node.i]) continue;
      const projected = space.nodeVec(node.i).clone().project(space.camera);
      if (projected.z < 1) pts.push([(projected.x + 1) / 2 * space.w, (1 - projected.y) / 2 * space.h]);
    }
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return { width: Math.max(...xs) - Math.min(...xs), view: space.w };
  });
  check(`${name} home graph stays composed`, homeFill.width > homeFill.view * 0.3 && homeFill.width < homeFill.view * 0.94, `${Math.round(homeFill.width)}/${Math.round(homeFill.view)}`);
  if (name === "phone") {
    const clipped = await page.evaluate(() => {
      const brand = document.querySelector(".brand").getBoundingClientRect();
      const home = document.querySelector("#homeBtn").getBoundingClientRect();
      return !(home.right <= brand.left || home.left >= brand.right || home.bottom <= brand.top || home.top >= brand.bottom);
    });
    check(`${name} Home is not under the brand`, !clipped);
  }
  const narrow = (page.viewportSize()?.width || 1000) < 760;
  if (narrow) {
    const header = await page.locator("#top").evaluate((el) => el.getBoundingClientRect().height);
    const filtersDisplay = await page.locator("#filters").evaluate((el) => getComputedStyle(el).display);
    check(`${name} header stays compact`, header < 170, `${Math.round(header)}px`);
    check(`${name} filters start closed`, filtersDisplay === "none", filtersDisplay);
    await page.click("#filterBtn");
  }
  const filters = await auditFilters(page);
  check(`${name} filters reachable`, filters.open && filters.problems.length === 0, filters.problems.join("; ") || `${filters.open ? "open" : "closed"} ${filters.problems.length}`);
  if (name === "phone" || name === "tablet") await page.screenshot({ path: `${out}/${path}-filters.png` });
  await page.click("#allBtn");
  await page.waitForFunction((n) => window.__spacePreview.counts.shownE === n, expected.allShown);
  check(`${name} all-connections control`, (await readPreview(page)).counts.shownE === expected.allShown, String(expected.allShown));
  await page.click("#keyBtn");
  await page.waitForFunction((n) => window.__spacePreview.counts.shownE === n && window.__spacePreview.counts.key === true, expected.keyShown);
  check(`${name} key-connections control`, (await readPreview(page)).counts.shownE === expected.keyShown, String(expected.keyShown));
  if (narrow) await page.click("#filterBtn");
  await page.click("#pauseBtn");
  check(`${name} pause control`, (await page.locator("#pauseBtn").getAttribute("aria-pressed")) === "true" && (await readPreview(page)).motionOff === true);
  await page.click("#pauseBtn");
  const shot = await inspectXrp(page);
  await page.waitForFunction(() => {
    const view = window.__spacePreview.view;
    return view && view.n > 10 && view.width > 220 && view.height > 120 && view.labels >= 6;
  }, null, { timeout: 8000 });
  const view = await page.evaluate(() => window.__spacePreview.view);
  check(`${name} selected neighborhood has depth`, view.width > 220 && view.height > 120 && view.labels >= 6, JSON.stringify(view));
  const selectedAudit = await auditScene(page);
  check(`${name} selected labels clear`, selectedAudit.problems.length === 0, selectedAudit.problems.slice(0, 6).join("; "));
  const selectedAnchors = await auditAnchors(page);
  check(`${name} selected label leaders`, selectedAnchors.problems.length === 0, selectedAnchors.problems.slice(0, 4).join("; ") || `${selectedAnchors.lines} leaders`);
  check(`${name} selected name visible`, selectedAudit.labels.some((text) => /^XRP\b/.test(text)), selectedAudit.labels.join(" | ").slice(0, 180));
  check(`${name} selected XRP`, shot.title === "XRP", shot.title);
  check(`${name} grade and adoption copy`, /Primary or official source/.test(shot.text) && /Connections/.test(shot.text) && /Adoption/.test(shot.text), shot.text.slice(0, 180));
  check(`${name} source link`, /^https:\/\//.test(shot.href || ""), shot.href || "");
  if (narrow) check(`${name} sheet leaves the galaxy visible`, view.sheet / view.innerHeight < 0.42, `${Math.round(view.sheet)}/${view.innerHeight}`);
  await page.screenshot({ path: `${out}/${path}-selected.png` });
  if (name === "desktop" || name === "phone") {
    const clip = await page.evaluate(() => {
      const panel = document.querySelector("#panel").getBoundingClientRect();
      const filters = document.querySelector("#filters").getBoundingClientRect();
      const head = document.querySelector("#top").getBoundingClientRect();
      const y = Math.max(head.bottom, filters.height ? filters.bottom : 0) + 4;
      const side = panel.left > window.innerWidth * 0.45;
      const width = side ? panel.left - 8 : window.innerWidth - 8;
      const height = side ? window.innerHeight - y - 48 : panel.top - y - 4;
      return { x: 4, y, width: Math.max(80, width), height: Math.max(80, height) };
    });
    const crop = `${out}/${path}-labels.png`;
    await page.screenshot({ path: crop, clip });
    const text = ocr(crop);
    const wanted = name === "desktop" ? /Bitwise|Evernorth|Santander|DekaBank|XRPL/i : /Bitwise|Evernorth|Santander|BNY|XRPL/i;
    check(`${name} screenshot shows entity names`, wanted.test(text), text.replace(/\s+/g, " ").slice(0, 180));
  }
  await page.click("#pMore");
  await page.waitForSelector("#pBody .srcs a");
  check(`${name} evidence control shows sources`, (await page.locator("#pBody .srcs a").count()) >= 1);
  await page.screenshot({ path: `${out}/${path}-evidence.png` });
  await page.click("#homeBtn");
  await page.waitForTimeout(400);
  check(`${name} home clears selection`, (await page.locator("#panel").getAttribute("hidden")) !== null);
  check(`${name} home restores key view`, (await page.locator("#keyBtn").getAttribute("aria-pressed")) === "true");
  const rate = await fps(page);
  check(`${name} fps`, rate >= 8, String(rate));
  info.fpsAfter = rate;
  info.bootMs = boot;
  info.errors = bucket.errors;
  info.warnings = bucket.warnings.slice(0, 8);
  info.failed = bucket.failed;
  check(`${name} console clean`, bucket.errors.length === 0, bucket.errors.join(" | "));
  if (name === "desktop") {
    await page.click("#reloadBtn");
    await page.waitForFunction(() => /Already showing the public graph/.test(document.querySelector("#banner").textContent));
    check("refresh sees current graph", true, await page.locator("#banner").innerText());
    await page.keyboard.press("Escape");
    await page.locator("#space canvas").focus();
    const moved = await page.evaluate(() => {
      const before = window.__spacePreview.engine.camera.position.clone();
      document.querySelector("#space canvas").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      const after = window.__spacePreview.engine.camera.position;
      return Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
    });
    check("desktop arrow orbits", moved > 1, String(Math.round(moved)));
  }
  await context.close();
  return info;
}

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const desktop = await runProfile(browser, "desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, "desktop");
const tablet = await runProfile(browser, "tablet", { ...devices["iPad (gen 7)"], viewport: { width: 810, height: 1080 } }, "tablet");
const phone = await runProfile(browser, "phone", devices["iPhone 13"], "phone");

const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const rpage = await reduced.newPage();
const rbucket = { errors: [], warnings: [], failed: [] };
attach(rpage, rbucket);
await rpage.goto(`${base}${spacePath}`, { waitUntil: "domcontentloaded" });
await settle(rpage);
const rinfo = await readPreview(rpage);
check("reduced motion starts paused", rinfo.motionOff === true && (await rpage.locator("#pauseBtn").getAttribute("aria-pressed")) === "true");
await rpage.keyboard.press("/");
check("slash focuses search", await rpage.evaluate(() => document.activeElement && document.activeElement.id === "q"));
await reduced.close();

const tourCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const tour = await tourCtx.newPage();
const tbucket = { errors: [], warnings: [], failed: [] };
attach(tour, tbucket);
await tour.goto(`${base}${spacePath}`, { waitUntil: "domcontentloaded" });
await settle(tour);
await tour.click("#tourBtn");
await tour.click('#tourList button[data-tour="adoption"]');
await tour.waitForFunction(() => {
  const el = document.querySelector("#tCaption");
  return el && /Connection:/.test(el.textContent) && /Adoption:/.test(el.textContent);
});
const cap1 = await tour.locator("#tCaption").innerText();
check("adoption tour caption", /Connection:/.test(cap1) && /Adoption:/.test(cap1), cap1.slice(0, 180));
await tour.click("#tNext");
await tour.waitForFunction((prev) => document.querySelector("#tCaption").textContent !== prev, cap1);
const cap2 = await tour.locator("#tCaption").innerText();
check("adoption tour advances", cap2 !== cap1 && cap2.length > 20, cap2.slice(0, 120));
const moved = await tour.evaluate(() => {
  const cam = window.__spacePreview.engine.camera.position.clone();
  const canvas = window.__spacePreview.engine.renderer.domElement;
  canvas.focus();
  canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  const next = window.__spacePreview.engine.camera.position;
  return Math.hypot(next.x - cam.x, next.y - cam.y, next.z - cam.z) > 1;
});
check("arrow key orbits", moved);
await tour.screenshot({ path: `${out}/desktop-tour.png` });
await tour.click("#tStop");
check("tour ends", await tour.locator("#tour").getAttribute("hidden") !== null);
check("tour console clean", tbucket.errors.length === 0, tbucket.errors.join(" | "));
await tourCtx.close();

const phoneTourCtx = await browser.newContext(devices["iPhone 13"]);
const phoneTour = await phoneTourCtx.newPage();
await phoneTour.goto(`${base}${spacePath}`, { waitUntil: "domcontentloaded" });
await settle(phoneTour);
await phoneTour.click("#tourBtn");
await phoneTour.click('#tourList button[data-tour="adoption"]');
await phoneTour.waitForFunction(() => /Connection:/.test(document.querySelector("#tCaption")?.textContent || "") && /Adoption:/.test(document.querySelector("#tCaption")?.textContent || ""));
check("phone tour caption", /Adoption:/.test(await phoneTour.locator("#tCaption").innerText()));
await phoneTour.screenshot({ path: `${out}/phone-tour.png` });
await phoneTour.click("#tNext");
await phoneTour.click("#tStop");
await phoneTourCtx.close();

await browser.close();

const software = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--disable-gpu"],
});
const sw = await software.newContext({ viewport: { width: 810, height: 1080 }, hasTouch: true, isMobile: true });
const sp = await sw.newPage();
const sbucket = { errors: [], warnings: [], failed: [] };
attach(sp, sbucket);
const t1 = Date.now();
await sp.goto(`${base}${spacePath}`, { waitUntil: "domcontentloaded" });
await settle(sp);
const sboot = Date.now() - t1;
const sinfo = await readPreview(sp);
const sfps = await fps(sp);
await sp.screenshot({ path: `${out}/tablet-swiftshader.png` });
check("swiftshader boots", sinfo.mode === "webgl" || sinfo.mode === "fallback", `${sinfo.mode} fps ${sfps} boot ${sboot}ms renderer ${sinfo.renderer}`);
check("swiftshader console", sbucket.errors.length === 0, sbucket.errors.join(" | "));
await software.close();

const noweb = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--disable-webgl", "--disable-3d-apis"],
});
const nctx = await noweb.newContext({ viewport: { width: 390, height: 844 } });
const np = await nctx.newPage();
const nbucket = { errors: [], warnings: [], failed: [] };
attach(np, nbucket);
await np.goto(`${base}${spacePath}`, { waitUntil: "domcontentloaded" });
await settle(np);
const ninfo = await readPreview(np);
check("no-webgl fallback", ninfo.mode === "fallback", ninfo.mode);
const fallbackExpected = await expectationsFrom(ninfo);
check("fallback still has counts", ninfo.counts.nodes === fallbackExpected.nodes && ninfo.counts.edges === fallbackExpected.edges, JSON.stringify(ninfo.counts));
const hubs = await np.locator("#fallbackList button").count();
check("fallback lists entities before search", hubs > 0, String(hubs));
await np.locator("#fallbackList button").first().click({ force: true });
await np.waitForSelector("#panel:not([hidden])");
await np.click("#pX");
await np.fill("#q", "BNY");
await np.waitForSelector("#results button");
const listed = await np.locator("#results button").count();
check("fallback search lists entities", listed > 0, String(listed));
await np.locator("#results button").first().click();
await np.waitForSelector("#panel:not([hidden])");
const ntext = await np.locator("#pBody").innerText();
check("fallback source panel", /Connection/.test(ntext) && /grade|Primary|Reporting|claim|false/i.test(ntext));
await np.screenshot({ path: `${out}/phone-fallback.png` });
check("fallback console", nbucket.errors.filter((e) => !/WebGL/.test(e)).length === 0, nbucket.errors.join(" | "));
await noweb.close();

const home = await chromium.launch({ executablePath: chrome, headless: true });
const hctx = await home.newContext();
const hp = await hctx.newPage();
await hp.goto(prodUrl, { waitUntil: "domcontentloaded" });
check("production title unchanged", (await hp.title()) === "XRP Web — connection map", `${prodUrl} ${await hp.title()}`);
await home.close();

console.log("\nPERF", JSON.stringify({ desktop, tablet, phone, swiftshader: { ...sinfo, fps: sfps, bootMs: sboot } }, null, 2));
if (problems.length) {
  console.error(`\n${problems.length} FAILED`);
  process.exit(1);
}
console.log("\nALL BROWSER CHECKS PASSED");
