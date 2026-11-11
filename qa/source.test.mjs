import assert from "node:assert/strict";
import test from "node:test";
import { drawScale, graphCandidates } from "../js/source.js";

test("source layout reads the graph beside /space/ before the public file", () => {
  const hrefs = [
    "http://127.0.0.1:8765/space/",
    "http://127.0.0.1:8765/space/index.html",
    "https://example.test/map/space/",
  ];
  for (const href of hrefs) {
    const list = graphCandidates(href);
    assert.equal(list[0], new URL("../graph.json", href).href);
    assert.equal(list[1], "https://xrpmap.org/graph.json");
  }
});

test("draw scale stays sharp and does not halve the picture", () => {
  assert.equal(drawScale(1, false), 1);
  assert.equal(drawScale(2, false), 2);
  assert.equal(drawScale(3, false), 2);
  assert.equal(drawScale(3, true), 1);
  assert.equal(drawScale(1, true), 1);
});

test("preview root requests only the public graph", () => {
  const hrefs = [
    "http://127.0.0.1:8766/",
    "http://127.0.0.1:8766/index.html",
    "https://bmwcoder.github.io/xrpmap-preview/",
    "https://bmwcoder.github.io/xrpmap-preview/index.html",
  ];
  for (const href of hrefs) {
    assert.deepEqual(graphCandidates(href), ["https://xrpmap.org/graph.json"]);
  }
});
