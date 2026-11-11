import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("js/app.js", root), "utf8");
const css = readFileSync(new URL("css/app.css", root), "utf8");
const graph = readFileSync(new URL("js/graph.js", root), "utf8");
const source = readFileSync(new URL("js/source.js", root), "utf8");
const labels = readFileSync(new URL("js/labels.js", root), "utf8");

test("preview is noindex and does not bake the November counts", () => {
  assert.match(html, /noindex, nofollow/);
  for (const file of [html, app, graph, css, source, labels]) {
    assert.equal(file.includes("2371"), false);
    assert.equal(file.includes("6,704"), false);
    assert.equal(file.includes("6704"), false);
    assert.equal(file.includes("2,371"), false);
  }
});

test("page reads the shared public graph and has the requested controls", () => {
  assert.match(source, /\.\.\/graph\.json/);
  assert.match(source, /\/space\//);
  assert.match(app, /graphCandidates/);
  assert.match(app, /cache:\s*"no-cache"/);
  assert.match(html, /id="homeBtn"/);
  assert.match(html, /id="pauseBtn"/);
  assert.match(html, /id="q"/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-reduced-motion/);
  assert.equal(css.includes("backdrop-filter"), false);
  assert.match(app, /WebGL/);
  assert.match(html, /not private/);
});

test("production entry files are not the preview when a parent site exists", () => {
  const homeUrl = new URL("../../index.html", import.meta.url);
  if (!existsSync(homeUrl)) return;
  const home = readFileSync(homeUrl, "utf8");
  assert.equal(home.includes("space-WZLWI5EC"), false);
  assert.match(home, /graph\.json|id="data"/);
});
