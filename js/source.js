/**
 * Where this page reads graph.json.
 * /space/ is the source layout, one level above the map's graph.json.
 * The preview root must not request that missing file: a 404 becomes a console error.
 */
export const PUBLIC_GRAPH = "https://xrpmap.org/graph.json";

/** CSS pixels per screen pixel. Software GL stays at 1. A 3x display caps at 2. */
export function drawScale(devicePixelRatio, software) {
  const device = Number(devicePixelRatio) || 1;
  if (software) return 1;
  return Math.min(Math.max(device, 1), 2);
}

export function graphCandidates(pageHref, publicGraph = PUBLIC_GRAPH) {
  const url = new URL(pageHref);
  let path = url.pathname;
  if (path.endsWith("/index.html")) path = path.slice(0, -"index.html".length);
  if (!path.endsWith("/")) path += "/";
  if (!path.endsWith("/space/")) return [publicGraph];
  return [new URL("../graph.json", url).href, publicGraph];
}
