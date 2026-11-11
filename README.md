# xrpmap-preview

Isolated Space preview for browser QA. This repository is not xrpmap.org, and it does not change `bmwcoder/xrp-web-map`.

The site root is the `space/` tree from [`bmwcoder/xrp-web-map`](https://github.com/bmwcoder/xrp-web-map) commit `fb3cd283a0eaf698883da550f37c6090d5e01f54` on `cursor/space-flythrough-preview-dfa0` ([pull request 1](https://github.com/bmwcoder/xrp-web-map/pull/1)), copied byte for byte. `index.html` keeps `noindex, nofollow`. There is no local `graph.json`. From this project site, `../graph.json` is outside the repository, so the page requests the public file at <https://xrpmap.org/graph.json>.

`.nojekyll` is the only added site file. It tells GitHub Pages to serve the copied JavaScript as static files instead of running Jekyll.

Reviewed checks still live in `qa/` and expect the source layout (`/space/` plus the source repository's `graph.json`). On this host the page is at `/`.
