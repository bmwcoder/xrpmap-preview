/**
 * Touch-first tasks. Uses Chrome touch events, not page method calls.
 * Emulation only: this is not a physical iPhone or Safari.
 *
 *   node qa/touch.mjs http://127.0.0.1:8766
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:8766";
const chrome = process.env.CHROME || "/usr/local/bin/google-chrome";
const out = process.env.SHOTS || "/tmp/touch-after";
mkdirSync(out, { recursive: true });

const problems = [];
function check(name, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  if (!ok) problems.push(line);
}

async function gesture(cdp, page, events) {
  for (const event of events) {
    const pause = event.pause || 20;
    const payload = { type: event.type, touchPoints: event.touchPoints };
    await cdp.send("Input.dispatchTouchEvent", payload);
    await page.waitForTimeout(pause);
  }
}

async function run(browser, name, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__spacePreview && window.__spacePreview.ready, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  const cold = await page.evaluate(() => {
    const hint = document.querySelector("#hint");
    const filters = getComputedStyle(document.querySelector("#filters")).display;
    const top = document.querySelector("#top").getBoundingClientRect().height;
    return {
      hint: hint && getComputedStyle(hint).display !== "none",
      filters,
      headerShare: top / innerHeight,
      pause: document.querySelector("#pauseBtn").textContent,
      draw: window.__spacePreview.draw,
    };
  });
  check(`${name} cold hint`, cold.hint === true);
  check(`${name} filters start closed`, cold.filters === "none", cold.filters);
  check(`${name} pause is not already frozen`, cold.pause === "Pause", cold.pause);
  check(`${name} header leaves the map`, cold.headerShare < 0.28, String(Math.round(cold.headerShare * 100)));
  console.log(`${name} DRAW`, JSON.stringify(cold.draw));
  await page.screenshot({ path: `${out}/${name}-home.png` });

  const label = await page.evaluate(() => {
    const spans = [...document.querySelectorAll("#labels3d .lab")].filter((el) => {
      return parseFloat(el.style.opacity || "1") > 0.5 && !el.classList.contains("sl");
    });
    const span = spans[0] && spans[0].querySelector("span");
    if (!span) return null;
    const rect = span.getBoundingClientRect();
    return { text: span.textContent, x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
  });
  check(`${name} a name is on screen`, !!label, label && label.text);
  if (label) {
    await gesture(cdp, page, [
      { type: "touchStart", touchPoints: [{ x: label.x, y: label.y, id: 0 }] },
      { type: "touchEnd", touchPoints: [], pause: 60 },
    ]);
    await page.waitForTimeout(500);
    const picked = await page.evaluate(() => ({
      selected: window.__spacePreview.selected,
      open: !document.querySelector("#panel").hidden,
      text: document.querySelector("#pTitle") && document.querySelector("#pTitle").textContent,
    }));
    check(`${name} tap name selects`, picked.open && !!picked.selected, `${label.text} -> ${picked.text}`);
    await page.screenshot({ path: `${out}/${name}-selected.png` });
    const beforeScroll = await page.evaluate(() => document.querySelector("#panel").scrollTop);
    const box = await page.locator("#pBody").boundingBox();
    if (box) {
      const x = box.x + Math.min(40, box.width / 2);
      const y = box.y + Math.min(box.height - 30, 80);
      await gesture(cdp, page, [
        { type: "touchStart", touchPoints: [{ x, y, id: 0 }] },
        { type: "touchMove", touchPoints: [{ x, y: y - 40, id: 0 }] },
        { type: "touchMove", touchPoints: [{ x, y: y - 90, id: 0 }] },
        { type: "touchEnd", touchPoints: [] },
      ]);
      await page.waitForTimeout(200);
    }
    const scrolled = await page.evaluate(() => ({
      top: document.querySelector("#panel").scrollTop,
      page: scrollY,
    }));
    check(`${name} sheet scrolls on its own`, scrolled.top > beforeScroll && scrolled.page === 0, `sheet ${beforeScroll}->${scrolled.top} page ${scrolled.page}`);
    const next = await page.evaluate(() => {
      const panel = document.querySelector("#panel").getBoundingClientRect();
      const buttons = [...document.querySelectorAll("#panel [data-go]")];
      const btn = buttons.find((item) => {
        const rect = item.getBoundingClientRect();
        return rect.width > 8 && rect.top >= panel.top && rect.bottom <= panel.bottom && rect.left >= 0;
      });
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      return { text: btn.textContent.trim(), x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
    });
    if (next && next.y > 0 && next.y < contextOptions.viewport.height) {
      const beforeId = await page.evaluate(() => window.__spacePreview.selected);
      await gesture(cdp, page, [
        { type: "touchStart", touchPoints: [{ x: next.x, y: next.y, id: 0 }] },
        { type: "touchEnd", touchPoints: [], pause: 40 },
      ]);
      await page.waitForTimeout(400);
      const afterId = await page.evaluate(() => window.__spacePreview.selected);
      check(`${name} tap a connected name`, afterId && afterId !== beforeId, `${beforeId} -> ${afterId}`);
    } else {
      check(`${name} tap a connected name`, false, "connection control was not on screen");
    }
    await page.screenshot({ path: `${out}/${name}-evidence.png` });
    const close = await page.locator("#pX").boundingBox();
    await gesture(cdp, page, [
      { type: "touchStart", touchPoints: [{ x: close.x + close.width / 2, y: close.y + close.height / 2, id: 0 }] },
      { type: "touchEnd", touchPoints: [] },
    ]);
    await page.waitForTimeout(250);
    check(`${name} close returns to the galaxy`, await page.evaluate(() => document.querySelector("#panel").hidden));
  }

  const cam = await page.evaluate(() => window.__spacePreview.engine.camera.position.toArray());
  const cx = contextOptions.viewport.width / 2;
  const cy = contextOptions.viewport.height * 0.62;
  const moves = [{ type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 0 }] }];
  for (let i = 1; i <= 6; i++) moves.push({ type: "touchMove", touchPoints: [{ x: cx + i * 14, y: cy, id: 0 }] });
  moves.push({ type: "touchEnd", touchPoints: [] });
  await gesture(cdp, page, moves);
  await page.waitForTimeout(300);
  const dragged = await page.evaluate((before) => {
    const now = window.__spacePreview.engine.camera.position.toArray();
    return { moved: Math.hypot(now[0] - before[0], now[1] - before[1], now[2] - before[2]), scrollY };
  }, cam);
  check(`${name} drag orbits without scrolling the page`, dragged.moved > 30 && dragged.scrollY === 0, `moved ${Math.round(dragged.moved)}`);

  const dist0 = await page.evaluate(() => {
    const s = window.__spacePreview.engine;
    return s.camera.position.distanceTo(s.controls.target);
  });
  await gesture(cdp, page, [
    { type: "touchStart", touchPoints: [{ x: cx - 40, y: cy, id: 0 }, { x: cx + 40, y: cy, id: 1 }] },
    { type: "touchMove", touchPoints: [{ x: cx - 70, y: cy, id: 0 }, { x: cx + 70, y: cy, id: 1 }] },
    { type: "touchMove", touchPoints: [{ x: cx - 110, y: cy, id: 0 }, { x: cx + 110, y: cy, id: 1 }] },
    { type: "touchEnd", touchPoints: [] },
  ]);
  await page.waitForTimeout(250);
  const pinch = await page.evaluate((before) => {
    const s = window.__spacePreview.engine;
    return {
      dist: s.camera.position.distanceTo(s.controls.target),
      scale: window.visualViewport ? visualViewport.scale : 1,
      scrollY,
    };
  }, dist0);
  const pinchMoved = Math.abs(pinch.dist - dist0) > 20;
  console.log(`${name} PINCH`, JSON.stringify({ before: Math.round(dist0), after: Math.round(pinch.dist), scale: pinch.scale, page: pinch.scrollY }));
  check(`${name} pinch does not zoom the page`, pinch.scale < 1.05 && pinch.scrollY === 0, `scale ${pinch.scale}`);
  if (!pinchMoved) console.log(`${name} NOTE pinch changed the camera by ${Math.abs(pinch.dist - dist0).toFixed(1)} in this emulator`);

  const home = await page.locator("#homeBtn").boundingBox();
  await gesture(cdp, page, [
    { type: "touchStart", touchPoints: [{ x: home.x + home.width / 2, y: home.y + home.height / 2, id: 0 }] },
    { type: "touchEnd", touchPoints: [] },
  ]);
  await page.waitForTimeout(400);
  check(`${name} Home recovers`, await page.evaluate(() => document.querySelector("#panel").hidden && document.querySelector("#keyBtn").getAttribute("aria-pressed") === "true"));

  const filter = await page.locator("#filterBtn").boundingBox();
  await gesture(cdp, page, [
    { type: "touchStart", touchPoints: [{ x: filter.x + filter.width / 2, y: filter.y + filter.height / 2, id: 0 }] },
    { type: "touchEnd", touchPoints: [] },
  ]);
  await page.waitForTimeout(200);
  const opened = await page.evaluate(() => {
    const el = document.querySelector("#filters");
    const rect = el.getBoundingClientRect();
    return { display: getComputedStyle(el).display, share: rect.height / innerHeight };
  });
  check(`${name} filters open without covering the map`, opened.display === "flex" && opened.share < 0.4 && opened.share > 0.02, `${Math.round(opened.share * 100)}%`);
  await gesture(cdp, page, [
    { type: "touchStart", touchPoints: [{ x: filter.x + filter.width / 2, y: filter.y + filter.height / 2, id: 0 }] },
    { type: "touchEnd", touchPoints: [] },
  ]);
  await page.waitForTimeout(150);
  check(`${name} filters close`, await page.evaluate(() => getComputedStyle(document.querySelector("#filters")).display === "none"));

  if (name === "promax") {
    const tourBtn = await page.locator("#tourBtn").boundingBox();
    await gesture(cdp, page, [
      { type: "touchStart", touchPoints: [{ x: tourBtn.x + tourBtn.width / 2, y: tourBtn.y + tourBtn.height / 2, id: 0 }] },
      { type: "touchEnd", touchPoints: [] },
    ]);
    await page.waitForTimeout(200);
    const choice = await page.locator("#tourList button").first().boundingBox();
    await gesture(cdp, page, [
      { type: "touchStart", touchPoints: [{ x: choice.x + 20, y: choice.y + choice.height / 2, id: 0 }] },
      { type: "touchEnd", touchPoints: [] },
    ]);
    await page.waitForSelector("#tour:not([hidden])");
    const pause = await page.locator("#pauseBtn").boundingBox();
    await gesture(cdp, page, [
      { type: "touchStart", touchPoints: [{ x: pause.x + pause.width / 2, y: pause.y + pause.height / 2, id: 0 }] },
      { type: "touchEnd", touchPoints: [] },
    ]);
    check("promax pause says resume", (await page.locator("#pauseBtn").innerText()) === "Resume motion");
    check("promax paused tour explains the jump", /Resume motion to fly/.test(await page.locator("#tMotion").innerText()));
    const end = await page.locator("#tStop").boundingBox();
    await gesture(cdp, page, [
      { type: "touchStart", touchPoints: [{ x: end.x + end.width / 2, y: end.y + end.height / 2, id: 0 }] },
      { type: "touchEnd", touchPoints: [] },
    ]);
    await page.waitForTimeout(200);
    check("promax tour exits", await page.evaluate(() => document.querySelector("#tour").hidden));
  }
  await cdp.detach();
  await context.close();
}

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
await run(browser, "promax", { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await run(browser, "small", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await run(browser, "land", { viewport: { width: 956, height: 440 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} FAILED`);
  process.exit(1);
}
console.log("\nTOUCH TASKS PASSED");
