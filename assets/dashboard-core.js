/* Pure data operations shared by the dashboard and the parity checks. */
(function (root) {
  'use strict';
  const valid = x => typeof x === 'number' && Number.isFinite(x);
  const mean = xs => { const a = xs.filter(valid); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const level = x => valid(x) && x > 0 && x <= 100 ? Math.ceil(x / 20) : null;
  const unpack = table => {
    const columns = table.columns;
    return Array.from({length: table.data[columns[0]].length}, (_, i) => Object.fromEntries(columns.map(name => [name, table.data[name][i]])));
  };
  const select = (rows, state, ignoreCountry = false) => rows.filter(r =>
    +r.year === +state.year && (state.region === 'Total' || r.region === state.region) &&
    (ignoreCountry || state.country === 'Total' || r.country === state.country));
  const countLiteral = (text, word) => {
    if (!word) return 0;
    let n = 0, at = 0;
    while ((at = String(text || '').indexOf(word, at)) !== -1) { n++; at += word.length; }
    return n;
  };
  const keywords = text => text.split(',').map(s => s.trim()).filter(Boolean);
  const sumBy = (rows, key, weight = () => 1) => {
    const counts = new Map();
    rows.forEach(r => { const k = key(r); counts.set(k, (counts.get(k) || 0) + weight(r)); });
    return [...counts].map(([name, value]) => ({ name, value }));
  };
  const keywordCounts = (rows, words, field = 'cap_id', text = 'comment') =>
    sumBy(rows, r => r[field], r => words.reduce((n, word) => n + countLiteral(r[text], word), 0));
  const topWords = (rows, capacity) => sumBy(rows.filter(r => capacity === 'Total' || r.cap_id === capacity),
    r => r.word, r => r.n).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 15);
  const summary = (rows, codes) => Object.fromEntries(codes.map(code => [code, mean(rows.map(r => r[code]))]));
  const compare = (d, state, years, capacity, indicator) => years.map(year => {
    const find = rows => rows.find(r => +r.year === +year && r.region === state.region);
    const cap = state.country === 'Total' ? find(d.comparisons) : d.cap.find(r => +r.year === +year && r.country === state.country);
    const ind = state.country === 'Total' ? find(d.ind_means) : d.ind.find(r => +r.year === +year && r.country === state.country);
    return { year, overall: cap ? mean(d.capacities.map(c => cap[c.capacity])) : null,
      capacity: cap ? cap[capacity] : null, indicator: ind ? ind[indicator] : null };
  });
  root.SparCore = { valid, mean, level, unpack, select, countLiteral, keywords, sumBy, keywordCounts, topWords, summary, compare };
})(globalThis);

