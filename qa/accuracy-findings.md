# Accuracy findings for human triage

Screening notes for the public graph. They are not a fact audit and not a reclassification of the 6,705 connections.

File examined: `https://xrpmap.org/graph.json`
Graph file `meta.updated`: `2026-11-11T10:28:17-05:00` · `meta.version`: `3`
Entities: 2372. Connections: 6705.
Stored sides: {'neutral': 4131, 'supports': 1889, 'contradicts': 685}.
Stored grades: {'A': 5960, 'B': 599, 'C': 124, 'X': 22}.

The snapshot fixture in `qa/graph.test.mjs` is a different file: `2026-11-11T08:25:56-05:00`, 2,371 entities, 6,704 connections. It is not this live file.

## How to read the counts

Keyword counts are screening signals, not definitive misclassifications. A sentence can contain “adopted” and still not be about XRP adoption.

Screen: `side=supports` and the label does not contain adopt/payment/rail/xrp/rlusd/odl/on-demand/bridge/settlement: **818** of 1889 supports marks.
Screen: `side=neutral` and the label contains “adopt” or “partnership”: **52**.

### Not a misclassification by itself

- `evernorth-mnda-2025` → `evernorth-bca-2025` · side `neutral` · grade `A` · key `False`
  - label: adopted as confidentiality standard in BCA §8.14
  - source: https://www.sec.gov/Archives/edgar/data/2092592/000119312526347519/d944435ds4a.htm
  - added: 2026-10-19T22:56:09-04:00
  - The word “adopted” here is a confidentiality standard inside a contract clause. It is not XRP adoption. Do not treat this keyword hit as a wrong side.

## Exact examples for later review

### Supports mark, label is a founding, investment, or purchase

- `mccaleb` → `xrpl` · side `supports` · grade `A` · key `None`
  - label: co-created (2011–12)
  - source: https://xrpl.org/about/history
  - added: 2026-10-19T06:36:00-04:00

- `schwartz` → `xrpl` · side `supports` · grade `A` · key `None`
  - label: co-created / architect
  - source: https://xrpl.org/about/history
  - added: 2026-10-19T06:36:00-04:00

- `britto` → `xrpl` · side `supports` · grade `A` · key `None`
  - label: co-created
  - source: https://xrpl.org/about/history
  - added: 2026-10-19T06:36:00-04:00

- `a16z` → `opencoin` · side `supports` · grade `A` · key `None`
  - label: 2013 angel round — primary release
  - source: https://www.globenewswire.com/news-release/2013/04/11/1146545/0/en/opencoin-developer-of-ripple-protocol-closes-funding-from-andreessen-horowitz-ff-angel-iv-lightspeed-venture-partners-and-angel-investors.html
  - added: 2026-10-19T21:20:00-04:00

- `ffangel` → `opencoin` · side `supports` · grade `A` · key `None`
  - label: 2013 angel round — primary release
  - source: https://www.globenewswire.com/news-release/2013/04/11/1146545/0/en/opencoin-developer-of-ripple-protocol-closes-funding-from-andreessen-horowitz-ff-angel-iv-lightspeed-venture-partners-and-angel-investors.html
  - added: 2026-10-19T21:20:00-04:00

- `ripple` → `rprime` · side `supports` · grade `A` · key `True`
  - label: acquired Hidden Road for $1.25B (announced Apr 8, 2025; closed Oct 24, 2025) → Ripple Prime
  - source: https://ripple.com/ripple-press/ripple-acquires-prime-broker-hidden-road/
  - added: 2026-10-19T06:36:00-04:00

- `ripple` → `gtreasury` · side `supports` · grade `A` · key `True`
  - label: acquired $1B (2025)
  - source: https://ripple.com/ripple-press/ripple-breaks-into-corporate-treasury-with-gtreasury-acquisition/
  - added: 2026-10-19T06:36:00-04:00

- `ripple` → `rail` · side `supports` · grade `A` · key `True`
  - label: acquired $200M (2025)
  - source: https://ripple.com/ripple-press/ripple-to-acquire-rail-for-200m-expanding-leadership-in-stablecoin-payments/
  - added: 2026-10-19T06:36:00-04:00

- `ripple` → `metaco` · side `supports` · grade `A` · key `True`
  - label: acquired $250M (2023)
  - source: https://ripple.com/ripple-press/leading-enterprise-crypto-company-ripple-acquires-custody-provider-metaco-for-250m/
  - added: 2026-10-19T06:36:00-04:00

### Neutral mark, label uses adopted or partnership

- `evernorth-mnda-2025` → `evernorth-bca-2025` · side `neutral` · grade `A` · key `False`
  - label: adopted as confidentiality standard in BCA §8.14
  - source: https://www.sec.gov/Archives/edgar/data/2092592/000119312526347519/d944435ds4a.htm
  - added: 2026-10-19T22:56:09-04:00

- `irc` → `ripple` · side `neutral` · grade `A` · key `False`
  - label: humanitarian partnership; Ripple pledged $1M (2024-10-16)
  - source: https://ripple.com/ripple-press/ripple-and-international-rescue-committee-partner-to-innovate-humanitarian-aid-delivery/
  - added: 2026-10-19T22:56:09-04:00

- `edofarina` → `xrphealthcare` · side `neutral` · grade `A` · key `False`
  - label: former 'Head of Social Adoption' (2023 bio)
  - source: https://www.prnewswire.com/news-releases/xrp-healthcare-advances-as-xrpl-validator---strengthening-crypto-transparency-302034187.html
  - added: 2026-10-19T22:56:09-04:00

- `unicredit` → `ripplenet` · side `neutral` · grade `A` · key `False`
  - label: adopted Ripple 2016-06-22
  - source: https://ripple.com/insights/seven-leading-banks-join-ripples-global-network/
  - added: 2026-10-19T23:02:33-04:00

- `ubs` → `ripple` · side `neutral` · grade `A` · key `False`
  - label: named among banks adopting Ripple 2016-06-22
  - source: https://ripple.com/insights/seven-leading-banks-join-ripples-global-network/
  - added: 2026-10-19T23:02:33-04:00

- `ripple` → `hashkey-dx` · side `neutral` · grade `A` · key `False`
  - label: partnership for XRPL enterprise solutions in Japan (2024-04-29)
  - source: https://ripple.com/ripple-press/ripple-joins-forces-with-hashkey-dx-to-introduce-xrp-ledger-powered/
  - added: 2026-10-19T23:02:33-04:00

### Contradicts mark on an Open USD partner sentence

The stored sentence does not say the source opposes XRP adoption. The side is an editorial inference.

- `sbi` → `openusd` · side `contradicts` · grade `A` · key `None`
  - label: named Open USD partner
  - source: https://joinopenstandard.com/partners/
  - added: 2026-10-19T19:54:00-04:00

- `stanchart` → `openusd` · side `contradicts` · grade `A` · key `None`
  - label: named Open USD partner
  - source: https://joinopenstandard.com/partners/
  - added: 2026-10-19T19:54:00-04:00

- `blackrock` → `openusd` · side `contradicts` · grade `A` · key `None`
  - label: named Open USD partner
  - source: https://joinopenstandard.com/partners/
  - added: 2026-10-19T19:54:00-04:00

- `visa` → `openusd` · side `contradicts` · grade `A` · key `None`
  - label: Open USD partner
  - source: https://joinopenstandard.com/partners/
  - added: 2026-10-19T21:55:00-04:00

## Dated figures, not live quotes

- `xrp` · grade `A` · added `2026-10-19T06:36:00-04:00`
  - summary: Native asset of the XRP Ledger; 100B created at genesis, no mining. ~$1.30 on 2026-10-19 (#5 by market cap). Ripple holds ~31.4B in escrow (~300M/month net release).
  - sources: ['https://xrpl.org/docs/introduction/what-is-xrp', 'https://www.coingecko.com/en/coins/xrp', 'https://xrp-insights.com/xrp-radar/escrow']

- `rlusd` · grade `A` · added `2026-10-19T06:36:00-04:00`
  - summary: Ripple's USD stablecoin, NYDFS-approved 2024-12-10, launched 2024-12-17. Issued by Standard Custody & Trust; BNY primary reserve custodian. ~$2.37B supply (Oct 19).
  - sources: ['https://ripple.com/ripple-press/raising-the-standard-for-stablecoins-ripple-usd-launches-globally/', 'https://ripple.com/products/stablecoin/']

## No source stored

Grade C does not fill this gap. The preview says no source is stored and the summary is unverified.

- `tria` · Tria · grade `C` · added `2026-10-29T08:24:45-04:00` · sources `[]`
  - summary: Self-custody crypto neobank. XRP Ledger support live in its app (hold XRP, RLUSD, USDC; card top-up; futures margin) per its own blog; unveiled an XRPL-based 2027 roadmap at Swell 2026.

- `arco-fi` · Arco · grade `C` · added `2026-10-29T08:24:45-04:00` · sources `[]`
  - summary: Building tokenized asset allocation tools (Arco Vault). Signed an MOU with t54 (Oct 29 2026) to explore connecting Arco Vault to XRPL; per t54's post only, Arco has not posted it.

## Not done

Source URLs were copied from the file. They were not opened one by one. No connection was reclassified.
