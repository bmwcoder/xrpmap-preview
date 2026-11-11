/**
 * Public graph checks. Counts and the timestamp come from the file at runtime.
 * The source snapshot with fixed November figures is qa/graph.test.mjs.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { checkGraphBehavior } from "./check-graph.mjs";

test("live public graph matches its own stamp and stays navigable", async () => {
  const res = await fetch("https://xrpmap.org/graph.json", { cache: "no-store" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const data = await res.json();
  const summary = checkGraphBehavior(data);
  console.log("LIVE_GRAPH", JSON.stringify(summary));
  assert.match(summary.updated, /^2026-/);
});
