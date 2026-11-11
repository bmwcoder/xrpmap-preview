/**
 * Where this page reads graph.json.
 * /space/ is the source layout, one level above the map's graph.json.
 * The preview root must not request that missing file: a 404 becomes a console error.
 */
export const PUBLIC_GRAPH = "https://xrpmap.org/graph.json";

export function graphCandidates(pageHref, publicGraph = PUBLIC_GRAPH) {
  const url = new URL(pageHref);
  let path = url.pathname;
  if (path.endsWith("/index.html")) path = path.slice(0, -"index.html".length);
  if (!path.endsWith("/")) path += "/";
  if (!path.endsWith("/space/")) return [publicGraph];
  return [new URL("../graph.json", url).href, publicGraph];
}
