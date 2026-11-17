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
export const MODEL_VERSION = 'peer-multiple-2';

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

/** The peer yardstick: every live-token protocol's market-cap / TVL ratio, grouped by category. */
export interface PeerTable {
  global: number;
  global_peers: number;
  byCategory: Map<string, { multiple: number; peers: number }>;
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
  const clamp = (n: number): number => Math.min(model.multiple_max, Math.max(model.multiple_min, n));
  const byCategory = new Map<string, { multiple: number; peers: number }>();
  for (const [key, list] of ratios) byCategory.set(key, { multiple: clamp(median(list)), peers: list.length });
  return { global: clamp(median(all)), global_peers: all.length, byCategory };
}

/** The multiple one protocol is priced on: its category's, when the category has enough live peers. */
function multipleFor(p: SnapshotProtocol, peers: PeerTable, model: ModelConstants): { multiple: number; count: number; scope: 'category' | 'global' } {
  const entry = peers.byCategory.get(p.category ?? 'Uncategorised');
  if (entry !== undefined && entry.peers >= model.min_category_peers) return { multiple: entry.multiple, count: entry.peers, scope: 'category' };
  return { multiple: peers.global, count: peers.global_peers, scope: 'global' };
}

/** One protocol's valuation under the model: every factor, then the implied value they multiply to. */
export function impliedValue(p: SnapshotProtocol, asOf: string, peers: PeerTable, model: ModelConstants = MODEL): Valuation {
  const age = ageDays(asOf, p.listed_at);
  const mult = multipleFor(p, peers, model);
  const rawGrowth = p.change_7d === null ? 0 : p.change_7d;
  const growthPct = Math.min(model.growth_cap_pct, Math.max(model.growth_floor_pct, rawGrowth));
  const growthFactor = Math.max(model.growth_factor_min, 1 + (growthPct / 100) * model.growth_weight);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityFactor = model.maturity_base + (1 - model.maturity_base) * (ageForModel / (ageForModel + model.maturity_half_days));
  const extraChains = Math.min(Math.max(p.chains.length - 1, 0), model.reach_max_extra_chains);
  const reachFactor = 1 + model.reach_per_chain * extraChains;
  const implied = Math.max(1, Math.round(p.tvl_usd * mult.multiple * growthFactor * maturityFactor * reachFactor));
  return {
    implied,
    peer_multiple: mult.multiple,
    peer_count: mult.count,
    peer_scope: mult.scope,
    growth_factor: growthFactor,
    maturity_factor: maturityFactor,
    reach_factor: reachFactor,
    age_days: age,
  };
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
    if (entry.peers >= model.min_category_peers) rows.push({ category, multiple: round4(entry.multiple), peers: entry.peers, scope: 'category' });
  }
  rows.sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  rows.push({ category: 'All live protocols (fallback)', multiple: round4(peers.global), peers: peers.global_peers, scope: 'global' });
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
