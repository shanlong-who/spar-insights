// Inspect the actual compressed publication artifact, not just its visible tabs.
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script\b(?=[^>]*\bid="spar-data")[^>]*>([\s\S]*?)<\/script>/);
if (!script) throw Error('Missing embedded data');
const raw = zlib.gunzipSync(Buffer.from(script[1].replace(/\s/g,''), 'base64')).toString('utf8');
const data = JSON.parse(raw);
const allowed = ['meta','capacities','indicators','cap','ind','comparisons','ind_means',
  'comments','words','implementation','areas','raw','submissions','map_names'];
if (JSON.stringify(Object.keys(data).sort()) !== JSON.stringify(allowed.sort())) throw Error('Unexpected payload dataset');
const forbidden = /jee|overlap|recommendation/i;
for (const [key, table] of Object.entries(data)) {
  if (key === 'meta') continue;
  if (table.columns.some(c=>forbidden.test(c))) throw Error('Unexpected data column');
}
const interfaceText = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
if (/\bJEE\b|Joint External Evaluation|SPAR.{0,3}JEE/i.test(interfaceText)) throw Error('Excluded interface text remains');
const app = fs.readFileSync('assets/dashboard.js','utf8');
if (/\bjee\b|jee_|jee-|d\.overlap|d\.recommendations/i.test(app)) throw Error('Excluded application code remains');
if (/[A-Z]:[\\/]Users[\\/]|World Health Organization[\\/]Documents/i.test(html)) throw Error('Personal filesystem path in HTML');
if (/<(?:script|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(html)) throw Error('External runtime dependency');
let unchangedDatasets = null;
const baselinePath = '../static-dashboard/build/data.json';
if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath,'utf8'));
  if (data.meta.source_md5 !== baseline.meta.source_md5) throw Error('Source snapshot changed');
  unchangedDatasets = allowed.filter(k=>k!=='meta');
  for (const key of unchangedDatasets) {
    if (JSON.stringify(data[key]) !== JSON.stringify(baseline[key])) throw Error('SPAR source values changed: '+key);
  }
}
const report = { status:'passed', publication:'SPAR datasets only',
  payload_datasets:Object.keys(data), excluded_datasets:0,
  capacity_rows:data.cap.data.year.length, indicator_rows:data.ind.data.year.length,
  unchanged_spar_datasets:unchangedDatasets, html_bytes:Buffer.byteLength(html), sha256:crypto.createHash('sha256').update(html).digest('hex'),
  note:'Terms in original SPAR comments are retained verbatim; dataset provenance is enforced by allowlist.' };
fs.writeFileSync('validation/public_release_checks.json', JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
