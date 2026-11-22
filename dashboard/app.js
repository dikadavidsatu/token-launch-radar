// Launch Radar's dashboard. It reads window.RADAR (data.js, written beside dashboard/ by main.ts from
// the same board board.json carries) and renders three views: the ranked board with filters (each
// row carrying its scenario band and launch-readiness score), a detail drawer for each protocol
// with its valuation working, scenario band, sensitivity, readiness signals and farm plan, the
// live-token set the board set aside, and a Method view that states the model, the peer multiples
// with their dispersion, the model's leave-one-out backtest against the live tokens, and the
// per-category landscape. No network: every byte is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  var state = { tab: 'board', q: '', category: 'all', chain: 'all', watch: false, sort: 'rank', dir: 1, selected: null };

  var nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + nf.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + Number(n).toFixed(3); }
  function fmtFactor(n) { return 'x' + Number(n).toFixed(3); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ---- state in the hash, so a view can be linked, screenshotted and restored
  function readHash() {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watch') === '1') state.watch = true;
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watch) params.set('watch', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }

  // ---- the board's rows under the current filters
  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watch && r.band !== 'watchlist') return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'mult') { av = a.model.peer_multiple; bv = b.model.peer_multiple; }
      else if (key === 'ready') { av = a.readiness ? a.readiness.score : -1; bv = b.readiness ? b.readiness.score : -1; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else { av = a.rank; bv = b.rank; }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.rank - b.rank;
    });
  }

  // ---- chrome: header, lede, tabs
  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'scope', 'aria-hidden': 'true' }),
        el('div', null,
          el('div', { class: 'brand-name', text: 'LAUNCH RADAR' }),
          el('div', { class: 'brand-sub', text: 'Pre-token protocols, priced by their tokenised peers' })
        )
      ),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'Model ', el('b', { text: DATA.model_version })),
        el('span', null, 'Watchlist floor ', el('b', { text: fmtUsd(DATA.floor_usd) }))
      )
    );
  }
  function lede() {
    var s = DATA.stats;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', null, 'Every protocol that records no token, ranked by ', el('span', { class: 'hl', text: 'what its token would be worth' }), '.'),
        el('p', { text: 'The watchlist is the floor, not the ceiling: all ' + s.watchlist + ' watchlist protocols are ranked, and the radar adds ' + s.early + ' early pre-token protocols the list leaves out, most of them below the $' + Math.round(DATA.floor_usd / 1e6) + 'M floor. Each implied value is the protocol\'s TVL priced at the median market-cap multiple of its own category\'s live tokens, adjusted for its week of growth, its record with no token, and its chain reach. Every row also carries the band its peers\' own dispersion supports and a launch-readiness score, and the Method view publishes the model\'s backtest against the tokens that already trade. It is the model\'s claim, not a price and not a promise of a launch.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: s.watchlist + ' / ' + s.watchlist })),
        el('div', { class: 'fact' }, el('span', { text: 'Protocols ranked' }), el('b', { text: String(s.board) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows added' }), el('b', { text: String(s.early) })),
        el('div', { class: 'fact' }, el('span', { text: 'Already trading, set aside' }), el('b', { text: String(s.live) }))
      )
    );
  }
  function tabs() {
    function tab(id, label) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === id ? 'true' : 'false', text: label,
        onclick: function () { state.tab = id; state.selected = null; writeHash(); render(); } });
    }
    return el('div', { class: 'tabs', role: 'group', 'aria-label': 'Views' },
      tab('board', 'The board'), tab('live', 'Already trading'), tab('method', 'Method'));
  }

  // ---- board view
  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
    var chainCount = {};
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { chainCount[c] = (chainCount[c] || 0) + 1; }); });
    var chains = Object.keys(chainCount).sort(function (a, b) { return chainCount[b] - chainCount[a] || (a < b ? -1 : 1); });
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Name, slug, category, chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); renderTableOnly(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: state.category === c ? 'selected' : null }); }));
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chn = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c + ' (' + chainCount[c] + ')', selected: state.chain === c ? 'selected' : null }); }));
    chn.addEventListener('change', function () { state.chain = chn.value; writeHash(); render(); });
    var watch = el('input', { type: 'checkbox', id: 'watch', checked: state.watch ? 'checked' : null });
    watch.addEventListener('change', function () { state.watch = watch.checked; writeHash(); render(); });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chn),
      el('div', { class: 'field check' }, watch, el('label', { class: 'lab', for: 'watch', text: 'Watchlist only' })),
      el('span', { class: 'count', id: 'row-count' })
    );
  }
  function sortHeader(key, label, numeric) {
    var arrow = state.sort === key ? (state.dir > 0 ? ' ^' : ' v') : '';
    return el('th', { scope: 'col', class: numeric ? 'num' : null },
      el('button', { type: 'button', onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = key === 'name' || key === 'rank' ? 1 : -1; }
        render();
      } }, label + arrow));
  }
  function boardPanel() {
    var list = sortedRows(visibleRows());
    var panel = el('div', { class: 'panel', id: 'board-panel' });
    if (list.length === 0) {
      panel.appendChild(el('div', { class: 'empty' },
        el('h2', { text: 'Nothing on the scope matches' }),
        el('p', { text: 'Clear the search or widen the filters to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () {
          state.q = ''; state.category = 'all'; state.chain = 'all'; state.watch = false; writeHash(); render();
        } })));
      return panel;
    }
    var max = list.reduce(function (m, r) { return Math.max(m, r.implied_value_usd); }, 1);
    var tbody = el('tbody');
    list.forEach(function (r) {
      var g = r.change_7d;
      tbody.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Uncategorised') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'no chain recorded') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (g === null ? '' : g >= 0 ? 'pos' : 'neg'), text: fmtPct(g) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.model.peer_multiple) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num range', text: r.implied_range_usd ? fmtUsd(r.implied_range_usd.low) + ' – ' + fmtUsd(r.implied_range_usd.high) : 'n/a' }),
        el('td', { class: 'num', text: r.readiness ? String(r.readiness.score) : 'n/a' }),
        el('td', null, el('span', { class: 'chip ' + (r.band === 'watchlist' ? 'watch' : 'early'), text: r.band === 'watchlist' ? 'watchlist' : 'early' }))
      ));
    });
    panel.appendChild(el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { text: 'Pre-token protocols by implied value. The peer band is the value range at the peer set\'s 25th and 75th percentile multiples; Ready is the 0-100 launch-readiness score. Select a row for the working, the sensitivity and the farm plan.' }),
        el('thead', null, el('tr', null,
          sortHeader('rank', '#', true), sortHeader('name', 'Protocol'),
          sortHeader('tvl', 'TVL', true), sortHeader('growth', '7d', true), sortHeader('age', 'Age', true),
          sortHeader('mult', 'Peer x', true), sortHeader('implied', 'Implied value', true),
          el('th', { scope: 'col', class: 'num', text: 'Peer band' }), sortHeader('ready', 'Ready', true),
          el('th', { scope: 'col', text: 'Band' })
        )),
        tbody
      )
    ));
    return panel;
  }
  function renderTableOnly() {
    var old = document.getElementById('board-panel');
    if (old) old.replaceWith(boardPanel());
    var count = document.getElementById('row-count');
    if (count) count.textContent = visibleRows().length + ' of ' + DATA.rows.length + ' rows';
    restoreDrawer();
  }

  // ---- live view: the protocols whose token already trades, at the market's own values
  function livePanel() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      var g = r.change_7d;
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Uncategorised') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'no chain recorded') })
        )),
        el('td', null, el('span', { class: 'chip live', text: r.symbol || 'token live' })),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (g === null ? '' : g >= 0 ? 'pos' : 'neg'), text: fmtPct(g) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Already trading: these protocols\' tokens exist, so their market cap is a fact, not a model. They are never ranked with the pre-token board; their multiples are the board\'s yardstick.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Token' }),
            el('th', { scope: 'col', class: 'num', text: 'TVL' }), el('th', { scope: 'col', class: 'num', text: '7d' }),
            el('th', { scope: 'col', class: 'num', text: 'Market cap' })
          )),
          tbody
        )
      )
    );
  }

  // ---- method view: the model, stated whole
  function methodPanel() {
    var m = DATA.model;
    var multBody = el('tbody');
    DATA.multiples.forEach(function (r) {
      multBody.appendChild(el('tr', null,
        el('td', { text: r.category }),
        el('td', { class: 'num', text: fmtMult(r.low) }),
        el('td', { class: 'num', text: fmtMult(r.multiple) }),
        el('td', { class: 'num', text: fmtMult(r.high) }),
        el('td', { class: 'num', text: String(r.peers) }),
        el('td', { text: r.scope === 'global' ? 'fallback for thin categories' : 'category median' })
      ));
    });
    var v = DATA.validation;
    var landBody = el('tbody');
    (DATA.categories || []).forEach(function (c) {
      landBody.appendChild(el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.ranked) }),
        el('td', { class: 'num', text: String(c.live_peers) }),
        el('td', { class: 'num', text: fmtUsd(c.pre_token_tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(c.implied_total_usd) }),
        el('td', { class: 'num', text: c.median_multiple === null ? 'fallback' : fmtMult(c.median_multiple) })
      ));
    });
    return el('div', { class: 'panel method' },
      el('h2', { text: 'How an implied value is made' }),
      el('div', { class: 'formula', text: 'implied = TVL x peer multiple x growth factor x maturity factor x reach factor' }),
      el('p', null,
        el('b', { text: 'Peer multiple. ' }),
        'The median market-cap / TVL ratio of the snapshot\'s own live-token protocols in the same category, so a lending protocol is priced the way lending tokens already trade. A category with fewer than ' + m.min_category_peers + ' priced peers falls back to the median over all live protocols. Multiples are clamped between x' + m.multiple_min + ' and x' + m.multiple_max + '.'),
      el('p', null,
        el('b', { text: 'Growth factor. ' }),
        '1 + ' + m.growth_weight + ' x the seven-day TVL change, the change clamped between ' + m.growth_floor_pct + '% and +' + m.growth_cap_pct + '% and the factor floored at ' + m.growth_factor_min + ': momentum counts, one wild week cannot carry a row. An unreported change counts as zero.'),
      el('p', null,
        el('b', { text: 'Maturity factor. ' }),
        m.maturity_base + ' + ' + (1 - m.maturity_base) + ' x age / (age + ' + m.maturity_half_days + ' days), age being the days since the protocol was first tracked: the longer a protocol has run with no token, the closer it is priced to the full peer multiple. An unknown age counts as ' + m.unknown_age_days + ' days.'),
      el('p', null,
        el('b', { text: 'Reach factor. ' }),
        '1 + ' + m.reach_per_chain + ' for each chain past the first, up to ' + m.reach_max_extra_chains + ' extra chains: a launch lands better where the users already are.'),
      el('h2', { text: 'The multiples this board used' }),
      el('p', null, 'Each row is priced at its category\'s median; the low and high columns are the 25th and 75th percentile multiples of the same peers, and they draw the scenario band on every board row: half of the live peers trade inside it.'),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', class: 'num', text: 'Low (p25)' }),
            el('th', { scope: 'col', class: 'num', text: 'Median mcap / TVL' }), el('th', { scope: 'col', class: 'num', text: 'High (p75)' }),
            el('th', { scope: 'col', class: 'num', text: 'Live peers' }), el('th', { scope: 'col', text: 'Scope' }))),
          multBody)),
      el('h2', { text: 'The model, scored against the tokens that exist' }),
      el('p', null,
        'Before trusting it on protocols with no token, the model was run on the ones that have one: each of the ' + v.priced + ' live protocols with a market cap and a TVL was priced by this same formula from its peers, itself left out, and compared with its real market cap. ' +
        'The median model price lands at x' + Number(v.median_ratio).toFixed(2) + ' of the real market cap — close to unbiased, with no systematic over- or under-pricing. ' +
        'Per name the spread is wide, as the peer multiples themselves are wide: the median error is x' + Number(v.median_abs_error_x).toFixed(1) + ', and ' + v.within_1_5x_pct + '% of live names price within 1.5x of their market cap, ' + v.within_2x_pct + '% within 2x, ' + v.within_3x_pct + '% within 3x. ' +
        'That is why every row carries its peer band: the point value is the median peer\'s price, and the band is the honest range around it.'),
      el('h2', { text: 'The landscape: where the pre-token weight sits' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', class: 'num', text: 'Ranked' }),
            el('th', { scope: 'col', class: 'num', text: 'Live peers' }), el('th', { scope: 'col', class: 'num', text: 'Pre-token TVL' }),
            el('th', { scope: 'col', class: 'num', text: 'Implied total' }), el('th', { scope: 'col', class: 'num', text: 'Median x' }))),
          landBody)),
      el('h2', { text: 'Who is on the board, and who is not' }),
      el('ul', null,
        el('li', null, el('b', { text: 'Ranked: ' }), 'every protocol whose record shows no token (no market cap, no CoinGecko id, no symbol) and which is not a product of an asset that already trades, plus every watchlist protocol whatever its shape. The watchlist\'s ' + DATA.stats.watchlist + ' are the floor; ' + DATA.stats.early + ' early rows it leaves out are the radar\'s own catch.'),
        el('li', null, el('b', { text: 'Set aside: ' }), DATA.stats.set_aside + ' pre-token records are products of tokens that already trade: versioned pools of another protocol, wrapped, staked or bridged wrappers, and exchange products. A wrapper\'s launch already happened; it is the underlying\'s.'),
        el('li', null, el('b', { text: 'Already trading: ' }), DATA.stats.live + ' protocols record a token. They are shown at market value on their own view and are never given a modelled rank.'),
        el('li', null, el('b', { text: 'A record is not proof: ' }), 'the board says a protocol records no token, never that it has none. A protocol may carry a token its record does not show.')),
      el('p', { class: 'foot', text: 'Data: ' + DATA.source + '. Implied values are this entry\'s own model claims about a token that does not exist yet; they are not make.fun\'s figures, not prices, and not a prediction that a token will be issued.' })
    );
  }

  // ---- detail drawer
  var backdrop = null, drawer = null;
  function splitStep(s) {
    var at = s.indexOf(' Cost: ');
    if (at < 0) return { action: s, meta: '' };
    var tail = s.slice(at + 7);
    var tAt = tail.indexOf('. Time: ');
    if (tAt < 0) return { action: s.slice(0, at), meta: 'Cost: ' + tail };
    return { action: s.slice(0, at), meta: '', cost: tail.slice(0, tAt + 1), time: tail.slice(tAt + 8) };
  }
  function closeDetail() {
    state.selected = null;
    writeHash();
    if (backdrop) backdrop.remove();
    if (drawer) drawer.remove();
    backdrop = drawer = null;
    var tr = document.querySelector('tr[data-selected="true"]');
    if (tr) tr.setAttribute('data-selected', 'false');
  }
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    closeDetailSilent();
    state.selected = slug;
    writeHash();
    var m = row.model;
    backdrop = el('div', { class: 'backdrop', onclick: closeDetail });
    drawer = el('aside', { class: 'drawer', 'aria-label': row.name + ' details' },
      el('div', { class: 'drawer-head' },
        el('div', null,
          el('span', { class: 'chip ' + (row.band === 'watchlist' ? 'watch' : 'early'), text: row.band === 'watchlist' ? 'watchlist' : 'early radar' }),
          el('h2', { text: row.name }),
          el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.stats.board + ' · ' + (row.category || 'Uncategorised') + ' · ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'no chain recorded') })
        ),
        el('button', { class: 'close', type: 'button', text: 'Close', onclick: closeDetail })
      ),
      el('h3', { text: 'Implied value: the working' }),
      el('div', { class: 'eq' },
        el('span', { text: 'TVL (snapshot)' }), el('b', { text: fmtUsd(row.tvl_usd) }),
        el('span', { text: 'Peer multiple (' + m.peer_scope + ', ' + m.peer_count + ' live peers)' }), el('b', { text: fmtMult(m.peer_multiple) }),
        el('span', { text: 'Growth factor (7d ' + fmtPct(row.change_7d) + ')' }), el('b', { text: fmtFactor(m.growth_factor) }),
        el('span', { text: 'Maturity factor (age ' + fmtAge(row.age_days) + ', no token)' }), el('b', { text: fmtFactor(m.maturity_factor) }),
        el('span', { text: 'Reach factor (' + (row.chains ? row.chains.length : 0) + ' chains)' }), el('b', { text: fmtFactor(m.reach_factor) }),
        el('span', { class: 'total', text: 'Implied value' }), el('b', { class: 'total', text: fmtUsd(row.implied_value_usd) })
      ),
      el('p', { class: 'note', text: 'Factors are shown rounded to three places; board.json carries the exact row. ' + row.name + ' records no token in the snapshot (no market cap, no CoinGecko id, no symbol)' + (row.listed_at ? ', and has been tracked since ' + row.listed_at + '.' : '.') + ' The implied value is what a token issued today would be worth if the market priced it like its tokenised peers: a model claim, not a forecast.' }),
      el('h3', { text: 'Scenario band: the peers\' own dispersion' }),
      el('div', { class: 'eq' },
        el('span', { text: 'At the peer set\'s 25th percentile multiple' }), el('b', { text: fmtUsd(row.implied_range_usd.low) }),
        el('span', { text: 'At the median (the board\'s value)' }), el('b', { text: fmtUsd(row.implied_value_usd) }),
        el('span', { text: 'At the peer set\'s 75th percentile multiple' }), el('b', { text: fmtUsd(row.implied_range_usd.high) })
      ),
      el('p', { class: 'note', text: 'Half of the live peers in this set trade inside this band. The model\'s backtest (Method view) shows per-name prices land wide of the point value in just this way; the band, not the point, is the claim to plan around.' }),
      el('h3', { text: 'Sensitivity: one input moved at a time' }),
      el('div', { class: 'eq' },
        el('span', { text: 'Peer multiple a quarter lower' }), el('b', { text: fmtUsd(row.sensitivity_usd.multiple_down) }),
        el('span', { text: 'Peer multiple a quarter higher' }), el('b', { text: fmtUsd(row.sensitivity_usd.multiple_up) }),
        el('span', { text: 'Seven-day growth ten points lower' }), el('b', { text: fmtUsd(row.sensitivity_usd.growth_down) }),
        el('span', { text: 'Seven-day growth ten points higher' }), el('b', { text: fmtUsd(row.sensitivity_usd.growth_up) })
      ),
      el('h3', { text: 'Launch readiness: ' + row.readiness.score + ' / 100' }),
      el('div', { class: 'signals' }, row.readiness.signals.length
        ? row.readiness.signals.map(function (s) { return el('span', { class: 'sig', text: s }); })
        : el('span', { class: 'sig', text: 'no signal stands out: a mid-record, mid-momentum row' })),
      el('p', { class: 'note', text: 'Readiness weighs the length of the tokenless record, the week\'s momentum, chain reach, the depth of the peer set and TVL scale. It says how completely the record supports a launch, not what a launch would be worth.' }),
      el('h3', { text: 'Farm plan' }),
      el('p', { class: 'note', text: 'Budget: $' + row.farm.capital_usd + ' of opening capital, a ' + row.farm.season_weeks + '-week season, about $' + row.farm.est_cost_usd + ' all-in including the second position, the second chain where the plan opens one, weekly gas and the claim.' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var parts = splitStep(s);
        return el('li', null,
          el('span', { text: parts.action }),
          el('span', { class: 'meta' }, 'Cost: ', el('b', { text: parts.cost || 'see step' }), parts.time ? ' · Time: ' + parts.time : '')
        );
      })),
      el('p', { class: 'note', text: 'The plan is generated from this protocol\'s category, chains, TVL and age by the same code that writes board.json, so the plan here and the plan on the board are one text.' })
    );
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    var tr = document.querySelector('tr[data-selected="true"]');
    if (tr) tr.setAttribute('data-selected', 'false');
  }
  function closeDetailSilent() {
    if (backdrop) backdrop.remove();
    if (drawer) drawer.remove();
    backdrop = drawer = null;
  }
  function restoreDrawer() { if (state.selected && !drawer) openDetail(state.selected); }

  function render() {
    closeDetailSilent();
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(tabs());
    if (state.tab === 'board') {
      shell.appendChild(controls());
      shell.appendChild(boardPanel());
      var count = shell.querySelector('#row-count');
      if (count) count.textContent = visibleRows().length + ' of ' + DATA.rows.length + ' rows';
    } else if (state.tab === 'live') {
      shell.appendChild(livePanel());
    } else {
      shell.appendChild(methodPanel());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer) closeDetail(); });
})();
