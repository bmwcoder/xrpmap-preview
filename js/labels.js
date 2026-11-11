/**
 * Screen-space label placement. Higher priority keeps its place.
 * A label that would cover chrome, another label, or the viewport edge moves
 * to a clear slot or is hidden. Section titles lose to entity names.
 */

export function rectsOverlap(a, b, pad = 0) {
  return a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
}

const SHIFTS = [
  [0, 0],
  [0, -32], [0, 32], [40, 0], [-40, 0],
  [0, -64], [0, 64], [76, -20], [-76, -20],
  [56, 40], [-56, 40], [0, -96], [0, 96],
  [112, 0], [-112, 0], [36, -52], [-36, -52],
  [88, 48], [-88, 48],
];

function shifted(box, dx, dy) {
  return {
    left: box.left + dx,
    top: box.top + dy,
    right: box.right + dx,
    bottom: box.bottom + dy,
  };
}

function inside(box, bounds) {
  return box.left >= bounds.left && box.top >= bounds.top && box.right <= bounds.right && box.bottom <= bounds.bottom;
}

export function settleLabelBoxes(items, obstacles, bounds) {
  const viewW = bounds.right - bounds.left;
  const sorted = [...items].sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)));
  const placed = [];
  const out = [];
  for (const item of sorted) {
    const width = item.right - item.left;
    const height = item.bottom - item.top;
    if (item.priority < 70 && (width > viewW * 0.58 || height > (bounds.bottom - bounds.top) * 0.4)) {
      out.push({ id: item.id, dx: 0, dy: 0, show: false });
      continue;
    }
    let chosen = null;
    const shifts = item.priority < 30 ? [[0, 0]] : SHIFTS;
    for (const [dx, dy] of shifts) {
      const box = shifted(item, dx, dy);
      if (!inside(box, bounds)) continue;
      if (obstacles.some((obstacle) => rectsOverlap(box, obstacle, 2))) continue;
      if (placed.some((other) => rectsOverlap(box, other, 14))) continue;
      chosen = { dx, dy, box };
      break;
    }
    if (!chosen) {
      out.push({ id: item.id, dx: 0, dy: 0, show: false });
      continue;
    }
    placed.push(chosen.box);
    out.push({ id: item.id, dx: chosen.dx, dy: chosen.dy, show: true });
  }
  return out;
}

/** Line from a node point to the near edge of a label chip. Null when the chip already sits on the point. */
export function leaderEndpoints(nodeX, nodeY, rect, minGap = 22) {
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  const dx = nodeX - cx;
  const dy = nodeY - cy;
  if (dx === 0 && dy === 0) return null;
  const hw = (rect.right - rect.left) / 2;
  const hh = (rect.bottom - rect.top) / 2;
  const scale = Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
  const x2 = cx + dx * scale;
  const y2 = cy + dy * scale;
  const gap = Math.hypot(nodeX - x2, nodeY - y2);
  if (gap < minGap) return null;
  return { x1: nodeX, y1: nodeY, x2, y2, gap };
}
