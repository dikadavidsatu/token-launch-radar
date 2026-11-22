# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dikadavidsatu/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dikadavidsatu/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar ranks every protocol that records no token by an implied value: what its token would be worth if it issued one today and the market priced it like its tokenised peers. The model is read off the snapshot itself — each protocol's TVL is multiplied by the median market-cap / TVL ratio of its own category's live tokens, then adjusted for its seven-day TVL growth, how long it has run with no token, and how many chains it is live on. Around that point estimate every row carries its scenario band (the implied value at its peer set's 25th and 75th percentile multiples), a sensitivity table (the peer multiple moved a quarter either way, the week's growth ten points either way), and a 0–100 launch-readiness score with the plain-language signals behind it. The model is also scored in the open: a leave-one-out backtest prices every live token in the snapshot from its peers and publishes the aggregate error, so the board can be weighed by the model's own record. The board covers the whole watchlist and adds every other rankable pre-token protocol in the snapshot as early rows; live-token protocols are set aside at market value, and every row carries a concrete farm plan with costs and times plus a costed budget rollup, generated from the protocol's category, chains, TVL and age. The dashboard is a static page (board with band and readiness columns, per-protocol detail view, filters, and a Method view that states the model, the peer multiples with their dispersion, the backtest, and the per-category landscape) that renders with no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the competition's sealed snapshot, and writes `board.json`, `data.js`, the dashboard, the screenshots and `dossier.json` into the output directory. Two runs on the same snapshot write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=vyqgkf3p&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
