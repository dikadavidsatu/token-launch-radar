# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dikadavidsatu/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dikadavidsatu/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar ranks every protocol that records no token by an implied value: what its token would be worth if it issued one today and the market priced it like its tokenised peers. The model is read off the snapshot itself — each protocol's TVL is multiplied by the median market-cap / TVL ratio of its own category's live tokens, then adjusted for its seven-day TVL growth, how long it has run with no token, and how many chains it is live on. The board covers the whole watchlist and adds every other rankable pre-token protocol in the snapshot as early rows; live-token protocols are set aside at market value, and every row carries a concrete farm plan with costs and times, generated from the protocol's category, chains, TVL and age. The dashboard is a static page (board, per-protocol detail view, filters, and a Method view that states the model) that renders with no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the competition's sealed snapshot, and writes `board.json`, `data.js`, the dashboard, the screenshots and `dossier.json` into the output directory. Two runs on the same snapshot write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=fntjtmsa&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
