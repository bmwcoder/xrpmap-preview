import assert from "node:assert/strict";
import {
  applyFilters, bestEdge, createModel, defaultFilters, edgesOf, searchNodes, shellAround, toursFor, validateGraph,
} from "../js/graph.js";

/** Behavior of whatever graph file was loaded. Totals are taken from that file. */
export function checkGraphBehavior(data) {
  const check = validateGraph(data);
  assert.equal(check.ok, true, check.errors.join("; "));
  assert.equal(typeof data.meta.updated, "string");
  assert.ok(data.meta.updated.length >= 10);
  const nodes = data.nodes.length;
  const edges = data.edges.length;
  assert.ok(nodes > 100, String(nodes));
  assert.ok(edges > nodes, String(edges));

  const model = createModel(data);
  assert.equal(model.nodes.length, nodes);
  assert.equal(model.edges.length, edges);
  assert.equal(model.meta.updated, data.meta.updated);
  assert.equal(model.warnings.length, 0);
  assert.equal(model.filters.key, true);
  const keyShown = model.countE;
  assert.ok(keyShown > 40 && keyShown < 400, String(keyShown));
  assert.equal(model.edges.filter((edge) => edge.key).length, keyShown);

  const hits = searchNodes(model, "xrp", 5);
  assert.equal(hits[0].id, "xrp");
  assert.equal(searchNodes(model, "zzzz-not-an-entity", 5).length, 0);

  const tours = toursFor(model);
  const ids = tours.map((tour) => tour.id);
  assert.ok(ids.includes("galaxy"));
  assert.ok(ids.includes("adoption"));
  for (const tour of tours) {
    assert.ok(tour.steps.length >= 2);
    const sides = new Set();
    for (const step of tour.steps) {
      for (const pair of step.path || []) {
        const edge = model.edges.find((item) => item.a === pair.a && item.b === pair.b || item.a === pair.b && item.b === pair.a);
        assert.ok(edge, `${tour.id} missing pair`);
        if (tour.id === "adoption") sides.add(edge.side);
      }
      if (step.focus >= 0) assert.ok(model.nodes[step.focus]);
    }
    if (tour.id === "adoption") {
      assert.ok(sides.has("supports"));
      assert.ok(sides.has("contradicts"));
      assert.equal(sides.has("neutral"), true);
    }
  }

  const xrp = model.nodes[model.idx.get("xrp")];
  const neighbors = edgesOf(model, xrp.i).map((edge) => model.nodes[edge.a === xrp.i ? edge.b : edge.a]);
  const shell = shellAround(xrp, neighbors);
  assert.equal(shell.length, neighbors.length);
  const shellZ = shell.map((point) => point.z);
  assert.ok(Math.max(...shellZ) - Math.min(...shellZ) > 400);

  applyFilters(model, { key: false });
  assert.equal(model.countE, edges);
  applyFilters(model, defaultFilters());
  assert.equal(model.filters.key, true);
  assert.equal(model.countE, keyShown);

  const copy = structuredClone(data);
  copy.edges = copy.edges.filter((edge) => !(
    (edge.from === "musk" && edge.to === "xmoney") || (edge.from === "xmoney" && edge.to === "musk")
  ));
  const trimmed = createModel(copy);
  assert.equal(bestEdge(trimmed, "musk", "xmoney"), null);

  return { updated: data.meta.updated, nodes, edges, keyShown };
}
