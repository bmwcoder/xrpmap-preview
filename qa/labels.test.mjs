import assert from "node:assert/strict";
import test from "node:test";
import { leaderEndpoints, settleLabelBoxes } from "../js/labels.js";

function box(id, priority, left, top, width, height) {
  return { id, priority, left, top, right: left + width, bottom: top + height };
}

const bounds = { left: 8, top: 8, right: 800, bottom: 600 };

test("a clear label stays on its anchor", () => {
  const [only] = settleLabelBoxes([box("ripple", 80, 200, 200, 120, 24)], [], bounds);
  assert.equal(only.show, true);
  assert.equal(only.dx, 0);
  assert.equal(only.dy, 0);
});

test("entity names win and section titles do not stack on them", () => {
  const placed = settleLabelBoxes([
    box("section", 10, 200, 200, 180, 18),
    box("ripple", 80, 210, 198, 140, 24),
  ], [], bounds);
  const byId = Object.fromEntries(placed.map((item) => [item.id, item]));
  assert.equal(byId.ripple.show, true);
  assert.equal(byId.ripple.dx, 0);
  assert.equal(byId.ripple.dy, 0);
  assert.equal(byId.section.show, false);
});

test("two section titles do not keep the same rectangle", () => {
  const placed = settleLabelBoxes([
    box("banks", 10, 400, 300, 160, 16),
    box("payments", 10, 408, 304, 150, 16),
  ], [], bounds);
  const shown = placed.filter((item) => item.show);
  assert.ok(shown.length >= 1);
  if (shown.length === 2) {
    assert.ok(shown[0].dx !== shown[1].dx || shown[0].dy !== shown[1].dy);
  }
});

test("a label under the header moves into the open canvas", () => {
  const header = { left: 0, top: 0, right: 800, bottom: 120 };
  const [moved] = settleLabelBoxes([box("xrp", 80, 300, 90, 80, 22)], [header], bounds);
  assert.equal(moved.show, true);
  assert.ok(moved.dy > 0);
  assert.ok(90 + moved.dy >= 120);
});

test("a label past the right edge is pulled back or hidden", () => {
  const [edge] = settleLabelBoxes([box("odl", 40, 760, 240, 120, 22)], [], bounds);
  if (edge.show) {
    assert.ok(760 + edge.dx + 120 <= bounds.right);
    assert.ok(edge.dx < 0);
  } else {
    assert.equal(edge.show, false);
  }
});

test("a chip sitting on its node does not need a leader", () => {
  const line = leaderEndpoints(100, 100, { left: 108, top: 80, right: 160, bottom: 108 });
  assert.equal(line, null);
});

test("a label moved off its node gets a leader to the chip edge", () => {
  const rect = { left: 240, top: 40, right: 400, bottom: 70 };
  const line = leaderEndpoints(100, 200, rect);
  assert.ok(line);
  assert.equal(line.x1, 100);
  assert.equal(line.y1, 200);
  assert.ok(line.x2 >= rect.left - 0.1 && line.x2 <= rect.right + 0.1);
  assert.ok(line.y2 >= rect.top - 0.1 && line.y2 <= rect.bottom + 0.1);
  assert.ok(line.gap >= 22);
});

test("a label with no clear slot is hidden instead of covering another", () => {
  const obstacles = [{ left: 0, top: 0, right: 800, bottom: 600 }];
  const [blocked] = settleLabelBoxes([box("crowded", 40, 100, 100, 80, 20)], obstacles, bounds);
  assert.equal(blocked.show, false);
});
