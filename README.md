# xrpmap-preview

Isolated Space preview for browser QA. This repository is not xrpmap.org, and it does not change `bmwcoder/xrp-web-map`.

The site root started from the `space/` tree in [`bmwcoder/xrp-web-map`](https://github.com/bmwcoder/xrp-web-map) commit `fb3cd283a0eaf698883da550f37c6090d5e01f54`. Later preview commits change label layout and which graph URL is requested. `index.html` keeps `noindex, nofollow`. There is no local `graph.json`. This host reads <https://xrpmap.org/graph.json> directly. A copy served from `/space/` still reads the `graph.json` beside that directory.

`.nojekyll` tells GitHub Pages to serve the JavaScript as static files instead of running Jekyll.

`qa/graph.test.mjs` is the source snapshot fixture and skips when that file is not beside the repo. `qa/live.test.mjs` reads the public graph at runtime. `qa/browse.mjs` checks this root by default.

`sync/space-layout.patch` is the preview-only difference from `space/` at `fb3cd283a0eaf698883da550f37c6090d5e01f54`, with paths under `space/`. It is not applied to `bmwcoder/xrp-web-map`. From a checkout of that repository: `patch -p1 < sync/space-layout.patch`.
