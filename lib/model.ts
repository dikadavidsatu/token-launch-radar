// Launch Radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// The question the board answers: what would this protocol's token be worth if it issued one today
// and the market priced it the way it already prices comparable tokenised protocols? The answer is
// built only from the snapshot's own figures, in four factors:
//
//   implied = tvl_usd x peer_multiple x growth_factor x maturity_factor x reach_factor
//
// peer_multiple   the median market-cap / TVL ratio of the snapshot's own live-token protocols in
//                 the same category (at least 3 peers, else the median over every live protocol).
//                 The market's own yardstick, read off the same page of data, never a hand-set list.
// growth_factor   1 + 0.35 x clamp(change_7d, -60, +150) / 100, floored at 0.45: a week of TVL
//                 momentum moves the value, damped so one wild week cannot carry a row.
// maturity_factor 0.55 + 0.45 x age / (age + 540), age in days since DefiLlama first tracked the
//                 protocol: a long record with no token earns the full multiple, a new one is
//                 discounted until it has one. An unknown age counts as 300 days.
// reach_factor    1 + 0.04 for each chain past the first, up to four: a protocol already live on
//                 several chains has the distribution a launch needs.
//
// Around that point estimate the model carries its own uncertainty and its own evidence:
//
// scenario band   every row also carries the implied value at its peer set's 25th and 75th
//                 percentile multiples: the range the market's own dispersion supports, not a
//                 confidence trick — half of the live peers trade inside it.
// backtest        the model is scored against the snapshot's live tokens, leave-one-out: each
//                 live protocol is priced by the same formula from its peers (itself excluded)
//                 and compared with its real market cap. The aggregate error is published in the
//                 dashboard's Method view, so a reader can weigh the board by the model's record.
// sensitivity     each row states its implied value with the peer multiple moved a quarter down
//                 and a quarter up, and with the week's growth moved ten points either way: the
//                 two inputs a reader is likeliest to dispute, priced out.
// readiness       a 0-100 launch-readiness score per row (record length, momentum, reach, peer
//                 depth, TVL scale) with the plain-language signals that moved it, so the board
//                 separates "valuable if it launches" from "ready to launch".
// landscape       per-category aggregates over the whole snapshot: how much pre-token TVL and
//                 implied value each category holds, and how deep its live peer set runs.
//
// The board covers every slug on the snapshot's watchlist (the floor, never a ceiling) and every
// other rankable pre-token protocol in the snapshot: the early rows are the radar's whole point.
// Rankable means the record shows no token (no market cap, no CoinGecko id, no symbol) and the
// protocol is not a product of an asset that already trades: not an exchange product, not a
// versioned pool of another protocol, not a wrapped, staked or bridged wrapper. Live-token
// protocols are set aside and shown at the market's own values, never mixed into the ranking.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard's Method view states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor_pct: number;
  growth_cap_pct: number;
  growth_factor_min: number;
  maturity_base: number;
  maturity_half_days: number;
  unknown_age_days: number;
  reach_per_chain: number;
  reach_max_extra_chains: number;
  multiple_min: number;
  multiple_max: number;
  min_category_peers: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.35,
  growth_floor_pct: -60,
  growth_cap_pct: 150,
  growth_factor_min: 0.45,
  maturity_base: 0.55,
  maturity_half_days: 540,
  unknown_age_days: 300,
  reach_per_chain: 0.04,
  reach_max_extra_chains: 4,
  multiple_min: 0.03,
  multiple_max: 2.5,
  min_category_peers: 3,
};

/** The model's version label: the dashboard names it and board.json carries it. */
export const MODEL_VERSION = 'peer-multiple-3';

/** The scenario band's percentiles of the peer multiples: the middle half of the live peers. */
export const BAND_LOW_PCT = 0.25;
export const BAND_HIGH_PCT = 0.75;

/** The sensitivity moves: the peer multiple a quarter either way, growth ten points either way. */
export const SENS_MULTIPLE_MOVE = 0.25;
export const SENS_GROWTH_MOVE_PCT = 10;

/** One row's scenario band: the implied value at its peer set's low and high multiples. */
export interface ImpliedRange {
  low_usd: number;
  high_usd: number;
  low_multiple: number;
  high_multiple: number;
}

/** One row's sensitivity: the implied value under each single-input move, in dollars. */
export interface Sensitivity {
  multiple_down_usd: number;
  multiple_up_usd: number;
  growth_down_usd: number;
  growth_up_usd: number;
}

/** One row's launch readiness: a 0-100 score and the signals that explain it, strongest first. */
export interface Readiness {
  score: number;
  signals: string[];
}

/** One row's farm plan, costed as numbers: the capital, the season, and the estimated all-in cost. */
export interface FarmRollup {
  capital_usd: number;
  season_weeks: number;
  est_cost_usd: number;
}

/** The model's leave-one-out record against the snapshot's live tokens. */
export interface ValidationStats {
  priced: number;
  median_abs_error_x: number;
  median_ratio: number;
  within_1_5x_pct: number;
  within_2x_pct: number;
  within_3x_pct: number;
}

/** One category's landscape: its pre-token weight and its live peer depth, over the whole snapshot. */
export interface CategoryStat {
  category: string;
  ranked: number;
  live_peers: number;
  pre_token_tvl_usd: number;
  implied_total_usd: number;
  median_multiple: number | null;
}

/** How many live-token protocols the Already trading view carries, by market cap. */
export const LIVE_ROWS = 30;

/** One protocol's valuation: the implied value and every factor that produced it. */
export interface Valuation {
  implied: number;
  peer_multiple: number;
  peer_count: number;
  peer_scope: 'category' | 'global';
  growth_factor: number;
  maturity_factor: number;
  reach_factor: number;
  age_days: number | null;
  range: ImpliedRange;
  sensitivity: Sensitivity;
}

/** One row of board.json: the ranked board's row. Extra keys beyond the gate's are the model's working. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_multiple: number;
    peer_count: number;
    peer_scope: 'category' | 'global';
    growth_factor: number;
    maturity_factor: number;
    reach_factor: number;
  };
  implied_range_usd: { low: number; high: number };
  sensitivity_usd: { multiple_down: number; multiple_up: number; growth_down: number; growth_up: number };
  readiness: Readiness;
  farm: FarmRollup;
  farm_steps: string[];
}

/** The dashboard's view of one board row: the row, its factors and its farm plan. */
export interface RadarRow extends BoardRow {
  band: 'watchlist' | 'early';
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

/** One category's peer multiple, for the dashboard's Method view. */
export interface MultipleRow {
  category: string;
  multiple: number;
  low: number;
  high: number;
  peers: number;
  scope: 'category' | 'global';
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  stats: {
    protocols: number;
    watchlist: number;
    board: number;
    early: number;
    live: number;
    set_aside: number;
  };
  multiples: MultipleRow[];
  validation: ValidationStats;
  categories: CategoryStat[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether the protocol's record shows no token: no market cap, no CoinGecko id, no symbol. */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a product of an asset which already trades, not a launch of their own. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name carrying a whole word that marks it as a wrapper of another asset. */
const WRAPPER_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name: the exchange's own product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a pre-token protocol is one the board may rank: not a product of a token that already trades. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!recordsNoToken(p)) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name) || WRAPPER_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A percentile of a non-empty list, linearly interpolated between the bracketing values. */
function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const at = q * (sorted.length - 1);
  const lo = Math.floor(at);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

/** One peer set's yardstick: the median multiple and the middle-half band around it. */
export interface PeerSet {
  multiple: number;
  low: number;
  high: number;
  peers: number;
}

/** The peer yardstick: every live-token protocol's market-cap / TVL ratio, grouped by category. */
export interface PeerTable {
  global: PeerSet;
  byCategory: Map<string, PeerSet>;
}

/** The ratios behind one peer set, clamped the way every multiple the model publishes is clamped. */
function peerSet(list: number[], model: ModelConstants): PeerSet {
  const clamp = (n: number): number => Math.min(model.multiple_max, Math.max(model.multiple_min, n));
  return {
    multiple: clamp(median(list)),
    low: clamp(quantile(list, BAND_LOW_PCT)),
    high: clamp(quantile(list, BAND_HIGH_PCT)),
    peers: list.length,
  };
}

/** Build the peer table from the snapshot's live-token protocols (a market cap and a TVL to divide by). */
export function peerTable(snapshot: Snapshot, model: ModelConstants = MODEL): PeerTable {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (recordsNoToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? 'Uncategorised';
    const list = ratios.get(key);
    if (list === undefined) ratios.set(key, [ratio]);
    else list.push(ratio);
  }
  const byCategory = new Map<string, PeerSet>();
  for (const [key, list] of ratios) byCategory.set(key, peerSet(list, model));
  return { global: peerSet(all, model), byCategory };
}

/** The peer set one protocol is priced on: its category's, when the category has enough live peers. */
function peerSetFor(p: SnapshotProtocol, peers: PeerTable, model: ModelConstants): { set: PeerSet; scope: 'category' | 'global' } {
  const entry = peers.byCategory.get(p.category ?? 'Uncategorised');
  if (entry !== undefined && entry.peers >= model.min_category_peers) return { set: entry, scope: 'category' };
  return { set: peers.global, scope: 'global' };
}

/** The growth factor for one stated seven-day change, clamped and floored the model's way. */
function growthFactorFor(changePct: number, model: ModelConstants): number {
  const pct = Math.min(model.growth_cap_pct, Math.max(model.growth_floor_pct, changePct));
  return Math.max(model.growth_factor_min, 1 + (pct / 100) * model.growth_weight);
}

/** The maturity factor for one age in days (an unknown age counts as the model's stand-in). */
function maturityFactorFor(age: number | null, model: ModelConstants): number {
  const days = age ?? model.unknown_age_days;
  return model.maturity_base + (1 - model.maturity_base) * (days / (days + model.maturity_half_days));
}

/** The reach factor for one chain list. */
function reachFactorFor(chains: string[], model: ModelConstants): number {
  const extra = Math.min(Math.max(chains.length - 1, 0), model.reach_max_extra_chains);
  return 1 + model.reach_per_chain * extra;
}

/** A dollar value from explicit inputs: the one multiplication every valuation in this file shares. */
function valueAt(tvl: number, multiple: number, growthFactor: number, maturityFactor: number, reachFactor: number): number {
  return Math.max(1, Math.round(tvl * multiple * growthFactor * maturityFactor * reachFactor));
}

/** One protocol's valuation under the model: every factor, then the implied value they multiply to. */
export function impliedValue(p: SnapshotProtocol, asOf: string, peers: PeerTable, model: ModelConstants = MODEL): Valuation {
  const age = ageDays(asOf, p.listed_at);
  const { set, scope } = peerSetFor(p, peers, model);
  const rawGrowth = p.change_7d === null ? 0 : p.change_7d;
  const growthFactor = growthFactorFor(rawGrowth, model);
  const maturityFactor = maturityFactorFor(age, model);
  const reachFactor = reachFactorFor(p.chains, model);
  const implied = valueAt(p.tvl_usd, set.multiple, growthFactor, maturityFactor, reachFactor);
  return {
    implied,
    peer_multiple: set.multiple,
    peer_count: set.peers,
    peer_scope: scope,
    growth_factor: growthFactor,
    maturity_factor: maturityFactor,
    reach_factor: reachFactor,
    age_days: age,
    range: {
      low_usd: valueAt(p.tvl_usd, set.low, growthFactor, maturityFactor, reachFactor),
      high_usd: valueAt(p.tvl_usd, set.high, growthFactor, maturityFactor, reachFactor),
      low_multiple: set.low,
      high_multiple: set.high,
    },
    sensitivity: {
      multiple_down_usd: valueAt(p.tvl_usd, set.multiple * (1 - SENS_MULTIPLE_MOVE), growthFactor, maturityFactor, reachFactor),
      multiple_up_usd: valueAt(p.tvl_usd, set.multiple * (1 + SENS_MULTIPLE_MOVE), growthFactor, maturityFactor, reachFactor),
      growth_down_usd: valueAt(p.tvl_usd, set.multiple, growthFactorFor(rawGrowth - SENS_GROWTH_MOVE_PCT, model), maturityFactor, reachFactor),
      growth_up_usd: valueAt(p.tvl_usd, set.multiple, growthFactorFor(rawGrowth + SENS_GROWTH_MOVE_PCT, model), maturityFactor, reachFactor),
    },
  };
}

/**
 * A row's launch readiness, 0-100: how completely the record supports a launch soon, as opposed
 * to how much a launch would be worth. Five parts, each read off the row's own record: the length
 * of its tokenless record (30), its week of momentum (25), its chain reach (15), the depth of the
 * peer set it is priced on (15), and its TVL scale (15). The signals name the facts that moved
 * the score, in plain words, so the number never travels alone.
 */
export function readinessFor(p: SnapshotProtocol, v: Valuation): Readiness {
  const age = v.age_days;
  const recordPart = 30 * ((age ?? MODEL.unknown_age_days) / ((age ?? MODEL.unknown_age_days) + MODEL.maturity_half_days));
  const change = p.change_7d === null ? 0 : Math.min(30, Math.max(-20, p.change_7d));
  const momentumPart = 25 * ((change + 20) / 50);
  const reachPart = 15 * (Math.min(Math.max(p.chains.length, 0), 5) / 5);
  const depthPart = v.peer_scope === 'category' ? Math.min(15, 5 + v.peer_count / 2) : 4;
  const scalePart = 15 * Math.min(1, Math.max(0, (Math.log10(Math.max(p.tvl_usd, 1)) - 5) / 4));
  const score = Math.round(recordPart + momentumPart + reachPart + depthPart + scalePart);
  const signals: string[] = [];
  if (age === null) signals.push('age not recorded: maturity is priced on the 300-day stand-in');
  else if (age < 180) signals.push('young record: under six months tracked');
  else if (age >= 730) signals.push('long record: two years or more with no token');
  if (p.change_7d === null) signals.push('no seven-day change reported');
  else if (p.change_7d <= -15) signals.push('TVL falling fast this week');
  else if (p.change_7d >= 25) signals.push('TVL growing fast this week');
  if (p.chains.length <= 1) signals.push('live on a single chain');
  else if (p.chains.length >= 5) signals.push('broad reach: five or more chains');
  if (v.peer_scope === 'global') signals.push('thin category: priced on the global fallback multiple');
  else if (v.range.high_multiple > 0 && v.range.low_multiple > 0 && v.range.high_multiple / v.range.low_multiple > 3) {
    signals.push('peers disagree: the category\u2019s multiples span a wide band');
  }
  if (p.tvl_usd >= 1_000_000_000) signals.push('top-scale TVL: over $1B already');
  return { score, signals };
}

/**
 * The model's record, leave-one-out: every live-token protocol in the snapshot is priced by the
 * same formula from its peers with itself left out, and the price is compared with its real
 * market cap. A model that cannot price the tokens that exist has no business pricing the ones
 * that do not; these aggregates are published so the board can be weighed by them.
 */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): ValidationStats {
  const live = snapshot.protocols.filter((p) => !recordsNoToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const byCategory = new Map<string, { slug: string; ratio: number }[]>();
  const all: { slug: string; ratio: number }[] = [];
  for (const p of live) {
    const entry = { slug: p.slug, ratio: p.mcap_usd! / p.tvl_usd };
    all.push(entry);
    const key = p.category ?? 'Uncategorised';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [entry]);
    else list.push(entry);
  }
  const ratios: number[] = [];
  const absLogs: number[] = [];
  for (const p of live) {
    const others = (list: { slug: string; ratio: number }[]): number[] => list.filter((e) => e.slug !== p.slug).map((e) => e.ratio);
    const catOthers = others(byCategory.get(p.category ?? 'Uncategorised') ?? []);
    const set = catOthers.length >= model.min_category_peers ? peerSet(catOthers, model) : peerSet(others(all), model);
    const age = ageDays(snapshot.as_of, p.listed_at);
    const implied = valueAt(
      p.tvl_usd,
      set.multiple,
      growthFactorFor(p.change_7d ?? 0, model),
      maturityFactorFor(age, model),
      reachFactorFor(p.chains, model),
    );
    const ratio = implied / p.mcap_usd!;
    ratios.push(ratio);
    absLogs.push(Math.abs(Math.log(ratio)));
  }
  const within = (k: number): number => Math.round((absLogs.filter((v) => v <= Math.log(k)).length / Math.max(1, absLogs.length)) * 1000) / 10;
  return {
    priced: live.length,
    median_abs_error_x: round4(Math.exp(median(absLogs))),
    median_ratio: round4(median(ratios)),
    within_1_5x_pct: within(1.5),
    within_2x_pct: within(2),
    within_3x_pct: within(3),
  };
}

/** The landscape: each category's pre-token weight on the board and the depth of its live peers. */
export function categoryStats(snapshot: Snapshot, board: BoardRow[], peers: PeerTable, model: ModelConstants = MODEL): CategoryStat[] {
  const grouped = new Map<string, CategoryStat>();
  for (const r of board) {
    const key = r.category ?? 'Uncategorised';
    let row = grouped.get(key);
    if (row === undefined) {
      const set = peers.byCategory.get(key);
      row = {
        category: key,
        ranked: 0,
        live_peers: set?.peers ?? 0,
        pre_token_tvl_usd: 0,
        implied_total_usd: 0,
        median_multiple: set !== undefined && set.peers >= model.min_category_peers ? round4(set.multiple) : null,
      };
      grouped.set(key, row);
    }
    row.ranked += 1;
    row.pre_token_tvl_usd += r.tvl_usd;
    row.implied_total_usd += r.implied_value_usd;
  }
  return [...grouped.values()].sort((a, b) => b.implied_total_usd - a.implied_total_usd || (a.category < b.category ? -1 : 1));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const peers = peerTable(snapshot, model);
  const watch = new Set(snapshot.watchlist);
  const chosen = snapshot.protocols.filter((p) => watch.has(p.slug) || isRankable(p));
  const scored = chosen.map((p) => ({ p, v: impliedValue(p, snapshot.as_of, peers, model) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    token_status: 'pre-token' as const,
    on_watchlist: watch.has(s.p.slug),
    age_days: s.v.age_days,
    implied_value_usd: s.v.implied,
    model: {
      peer_multiple: round4(s.v.peer_multiple),
      peer_count: s.v.peer_count,
      peer_scope: s.v.peer_scope,
      growth_factor: round4(s.v.growth_factor),
      maturity_factor: round4(s.v.maturity_factor),
      reach_factor: round4(s.v.reach_factor),
    },
    implied_range_usd: { low: s.v.range.low_usd, high: s.v.range.high_usd },
    sensitivity_usd: {
      multiple_down: s.v.sensitivity.multiple_down_usd,
      multiple_up: s.v.sensitivity.multiple_up_usd,
      growth_down: s.v.sensitivity.growth_down_usd,
      growth_up: s.v.sensitivity.growth_up_usd,
    },
    readiness: readinessFor(s.p, s.v),
    farm: farmRollup(s.p, s.v.age_days),
    farm_steps: farmSteps(s.p, s.v.age_days),
  }));
}

/** The live-token protocols, by market cap then TVL, for the dashboard's Already trading view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !recordsNoToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
    }));
}

/** The category multiples the board used, for the Method view: categories with enough peers first. */
export function multipleRows(snapshot: Snapshot, peers: PeerTable, model: ModelConstants = MODEL): MultipleRow[] {
  const rows: MultipleRow[] = [];
  for (const [category, entry] of peers.byCategory) {
    if (entry.peers >= model.min_category_peers) {
      rows.push({ category, multiple: round4(entry.multiple), low: round4(entry.low), high: round4(entry.high), peers: entry.peers, scope: 'category' });
    }
  }
  rows.sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  rows.push({ category: 'All live protocols (fallback)', multiple: round4(peers.global.multiple), low: round4(peers.global.low), high: round4(peers.global.high), peers: peers.global.peers, scope: 'global' });
  return rows;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const peers = peerTable(snapshot, model);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    stats: {
      protocols: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      board: board.length,
      early: board.filter((r) => !watch.has(r.slug)).length,
      live: snapshot.protocols.filter((p) => !recordsNoToken(p)).length,
      set_aside: snapshot.protocols.filter((p) => recordsNoToken(p) && !watch.has(p.slug) && !isRankable(p)).length,
    },
    multiples: multipleRows(snapshot, peers, model),
    validation: validateModel(snapshot, model),
    categories: categoryStats(snapshot, board, peers, model),
    rows: board.map((r) => ({ ...r, band: watch.has(r.slug) ? ('watchlist' as const) : ('early' as const) })),
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------- farm plans

/** The chain a plan starts on, and what a transaction there roughly costs in gas. */
function homeChain(p: SnapshotProtocol): { chain: string; gas: string } {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  if (chain === 'Ethereum') return { chain, gas: 'about $12 of gas on Ethereum' };
  if (chain === 'Solana') return { chain, gas: 'under $1 of fees on Solana' };
  return { chain, gas: `about $2 of gas on ${chain}` };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 500;
  if (p.tvl_usd >= 250_000_000) return 250;
  if (p.tvl_usd >= 50_000_000) return 150;
  if (p.tvl_usd >= 10_000_000) return 100;
  return 50;
}

/** How many weeks to stay active, from the protocol's age: younger protocols run longer seasons. */
function seasonWeeks(age: number | null): number {
  if (age === null) return 6;
  if (age < 180) return 8;
  if (age < 365) return 6;
  return 4;
}

/** One transaction's rough gas cost in dollars on a chain: the same figures the plan's text quotes. */
function chainGasUsd(chain: string): number {
  if (chain === 'Ethereum') return 12;
  if (chain === 'Solana') return 1;
  return 2;
}

/**
 * A plan's numbers: the opening capital, the season's length, and the estimated all-in cost of
 * running the plan — both capital positions, the second chain's bridge where the plan opens one,
 * a season of weekly gas, and the claim's gas. An estimate built from the plan's own figures,
 * stated so a reader can budget the farm without adding the steps up by hand.
 */
export function farmRollup(p: SnapshotProtocol, age: number | null): FarmRollup {
  const capital = capitalFor(p);
  const weeks = seasonWeeks(age);
  const home = p.chains.length > 0 ? p.chains[0]! : '';
  const second = Math.max(10, Math.round(capital / 5));
  const secondChain = p.chains.length > 1 ? Math.round(capital / 2) + 5 : 0;
  const weeklyGas = 2 * weeks;
  const est = capital + second + secondChain + weeklyGas + chainGasUsd(home) * 2;
  return { capital_usd: capital, season_weeks: weeks, est_cost_usd: est };
}

/** The category family's two moves: the position to open, then the second, different action. */
function movesFor(p: SnapshotProtocol, capital: number, chain: string): { open: string; second: string } {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return {
      open: `Supply $${capital} of USDC to ${n} on ${chain} so the wallet shows a lending balance.`,
      second: `Borrow a small amount, about 20% of the supply, against it and repay within the week: borrowers and suppliers are usually counted separately.`,
    };
  if (c.includes('dex') || c.includes('liquidity'))
    return {
      open: `Add $${capital} of liquidity to ${n}'s highest-volume pool on ${chain}, split evenly across both assets.`,
      second: `Make two or three small swaps through ${n} itself rather than an aggregator, so the wallet's volume is native to the protocol.`,
    };
  if (c.includes('derivative') || c.includes('option') || c.includes('synthetic') || c.includes('basis'))
    return {
      open: `Deposit $${capital} of USDC as margin on ${n} and open one small position you can hold for days, not minutes.`,
      second: `Place one limit order away from the market price and leave it resting for a day, so the wallet shows maker activity as well as taker fills.`,
    };
  if (c.includes('bridge'))
    return {
      open: `Bridge $${capital} of USDC through ${n} to ${chain} and use the bridged funds in one app on the far side.`,
      second: `Bridge a smaller amount back a week later rather than the same day: round trips in one session are the pattern sybil filters look for.`,
    };
  if (c.includes('staking') || c.includes('restaking') || c.includes('restak'))
    return {
      open: `Stake $${capital} of the chain's staking asset through ${n} and keep the receipt token in the same wallet.`,
      second: `Delegate or allocate the receipt to one of ${n}'s operators or strategies instead of leaving it idle, and leave the allocation untouched.`,
    };
  if (c.includes('rwa'))
    return {
      open: `Mint $${capital} of ${n}'s yield-bearing asset on ${chain} and hold it in the farming wallet.`,
      second: `Complete ${n}'s verification or allowlist step if it runs one: for real-world-asset protocols the verified list is usually the distribution list.`,
    };
  if (c.includes('stable') || c.includes('algo'))
    return {
      open: `Mint or deposit $${capital} of ${n}'s stable asset on ${chain} and hold the balance across weekly snapshots.`,
      second: `Use the stable asset in one partner money market or pool that ${n} lists, so the wallet shows the asset in circulation, not just minted.`,
    };
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield') || c.includes('farm') || c.includes('leveraged'))
    return {
      open: `Deposit $${capital} into one of ${n}'s vaults on ${chain} and keep the vault shares in the wallet.`,
      second: `Split a second, smaller deposit into a different ${n} vault after two weeks: multi-vault depositors read as users, one-off deposits read as mercenary.`,
    };
  if (c.includes('chain'))
    return {
      open: `Bridge $${capital} of USDC to ${n}'s chain and make it the wallet's most active chain for the season.`,
      second: `Use two native apps on the chain, one swap and one lending deposit, so the wallet has contract interactions beyond the bridge itself.`,
    };
  if (c.includes('prediction'))
    return {
      open: `Fund $${capital} on ${n} and take one position in a market that settles within the month.`,
      second: `Provide liquidity to one market's book instead of only taking prices: makers are the scarcer side and are usually weighted more.`,
    };
  if (c.includes('insurance'))
    return {
      open: `Buy $${capital} of cover from ${n} on ${chain} for a position you actually hold.`,
      second: `Stake a smaller amount into ${n}'s underwriting pool once the cover is live, so the wallet appears on both sides of the market.`,
    };
  return {
    open: `Deposit $${capital} of USDC into ${n} on ${chain} through its own app and keep the position open.`,
    second: `Repeat the deposit at half size two weeks later instead of doubling on day one: a returning wallet is a stronger signal than a large one.`,
  };
}

/** A step as one string: its action, then its cost and its time, inside the gate's 20 to 600 characters. */
function stepText(action: string, cost: string, time: string): string {
  let s = `${action} Cost: ${cost}. Time: ${time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Keep the position open and check the protocol's own page weekly.`;
  return s;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names: the same generator writes every row's plan, on the board and in the dashboard alike.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const { chain, gas } = homeChain(p);
  const capital = capitalFor(p);
  const weeks = seasonWeeks(age);
  const moves = movesFor(p, capital, chain);
  const steps: string[] = [
    stepText(
      `Set up a fresh wallet for ${p.name} alone, write its seed phrase on paper, and fund it with the position money plus gas.`,
      gas,
      '10 minutes',
    ),
    stepText(moves.open, `$${capital} of capital plus ${gas}`, '15 minutes to set up'),
    stepText(moves.second, `about $${Math.max(10, Math.round(capital / 5))} of capital and ${gas}`, '10 minutes'),
  ];
  if (p.chains.length > 1) {
    steps.push(
      stepText(
        `Open a second, smaller position on ${p.chains[1]!}, ${p.name}'s next chain: multi-chain users are the cohort a launch rewards first.`,
        `about $${Math.round(capital / 2)} of capital plus bridge and gas fees of about $5`,
        '20 minutes',
      ),
    );
  } else {
    steps.push(
      stepText(
        `Register the wallet wherever ${p.name} keeps its community record: its governance forum, quests page or points programme, using the same wallet.`,
        'no fee; never pay a third party to register or claim for you',
        '10 minutes',
      ),
    );
  }
  steps.push(
    stepText(
      `Stay active for ${weeks} weeks: one genuine action a week, a deposit top-up, a vote or a claim of accrued rewards, so the wallet appears in every weekly snapshot of the season.`,
      `about $2 of gas a week, $${2 * weeks} across the season`,
      `10 minutes a week for ${weeks} weeks`,
    ),
    stepText(
      `Once a week, check ${p.name}'s official announcements and its points or rewards page, and log the wallet's balance and actions in a farm log with dates.`,
      'nothing; the log is the proof of work you keep',
      '5 minutes a week',
    ),
    stepText(
      `If a token launches, claim only from the link in ${p.name}'s own announcement, check the contract address against its documentation, and never pay a fee to claim.`,
      'claim gas only, and walk away from any page that asks for more',
      '20 minutes, once',
    ),
  );
  return steps;
}

// ---------------------------------------------------------------- snapshot parsing

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: str(p.category),
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: num(p.change_7d),
      mcap_usd: num(p.mcap_usd),
      listed_at: str(p.listed_at),
      gecko_id: str(p.gecko_id),
      symbol: str(p.symbol),
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, values and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the gate's 100`;
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
  if (slugs.size !== board.length) return 'a slug appears on the board twice';
  for (let i = 0; i < board.length; i++) if (board[i]!.rank !== i + 1) return `rank ${i + 1} is ${board[i]!.rank}`;
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters once trimmed`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
