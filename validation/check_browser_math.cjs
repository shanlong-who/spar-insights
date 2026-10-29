// Executes pure browser data functions against independent R reference values.
// This is not a substitute for browser interaction and layout inspection.
const fs = require('node:fs');
const vm = require('node:vm');
vm.runInThisContext(fs.readFileSync('assets/dashboard-core.js', 'utf8'));
const C = globalThis.SparCore;
const d = JSON.parse(fs.readFileSync('build/data.json', 'utf8'));
Object.keys(d).filter(k=>k!=='meta').forEach(k=>{d[k]=C.unpack(d[k]);});
const refs = JSON.parse(fs.readFileSync('validation/reference_values.json', 'utf8'));
let checks=0;
function equal(actual,expected,label){checks++;if(expected===null){if(actual!==null&&!Number.isNaN(actual))throw Error(label+': expected missing');}else if(typeof expected==='number'){if(typeof actual!=='number'||Math.abs(actual-expected)>1e-9)throw Error(label+`: ${actual} != ${expected}`);}else if(actual!==expected)throw Error(label+': mismatch');}
for(const ref of refs){
  const state=ref.state,caps=C.select(d.cap,state),inds=C.select(d.ind,state);
  equal(caps.length,ref.count,'capacity row count');equal(inds.length,ref.indicator_count,'indicator row count');
  const means=C.summary(caps,d.capacities.map(r=>r.capacity));Object.keys(ref.means).forEach(k=>equal(means[k],ref.means[k],'capacity mean '+k));
  const indMeans=C.summary(inds,d.indicators.map(r=>r.indicator));Object.keys(ref.ind_means).forEach(k=>equal(indMeans[k],ref.ind_means[k],'indicator mean '+k));
  ref.thresholds.forEach(t=>equal(caps.filter(r=>r.overall>=t.threshold).length,t.above,'threshold '+t.threshold));
  for(const kw of ref.keywords){const terms=Array.isArray(kw.terms)?kw.terms:[kw.terms];const counts=new Map(C.keywordCounts(C.select(d.comments,state),terms).map(r=>[r.name,r.value]));for(const item of kw.counts)equal(counts.get(item.name),item.value,'keyword '+item.name);}
  for(const top of ref.top_words){const rows=C.select(d.words,state),actual=C.topWords(rows,top.capacity);equal(actual.length,Math.min(15,Object.keys(top.counts).length),'top-word length');actual.forEach(item=>{equal(item.value,top.counts[item.name],'word count '+item.name);if(item.value<top.cutoff)throw Error('Top-word cutoff mismatch');checks++;});}
}
equal(C.level(0),null,'zero level');equal(C.level(null),null,'missing level');[20,40,60,80,100].forEach((v,i)=>equal(C.level(v),i+1,'level upper bound'));equal(C.countLiteral('a(a(','('),2,'literal metacharacter');equal(C.countLiteral('abc',''),0,'empty keyword');
for(const region of ['Total',...d.meta.regions]){
  const rows=C.compare(d,{region,country:'Total'},d.meta.years,'C4','C4.1');
  rows.forEach(row=>{
    const source=d.cap.filter(r=>r.year===row.year&&(region==='Total'||r.region===region));
    equal(row.capacity,C.mean(source.map(r=>r.C4)),'comparison capacity');
    equal(row.overall,C.mean(d.capacities.map(c=>C.mean(source.map(r=>r[c.capacity])))),'comparison overall');
  });
}
equal(C.compare(d,{region:'WPRO',country:'Unknown country'},[2025],'C4','C4.1')[0].overall,null,'unavailable is missing');
const html=fs.readFileSync('index.html','utf8');
const embedded=html.match(/<script\b(?=[^>]*\bid="spar-data")[^>]*>([\s\S]*?)<\/script>/);
if(!embedded)throw Error('Embedded data script not found');
const decompressed=require('node:zlib').gunzipSync(Buffer.from(embedded[1].replace(/\s/g,''),'base64')).toString('utf8');
equal(decompressed,fs.readFileSync('build/data.json','utf8').trimEnd(),'lossless embedded payload');
if(/<(script|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(html))throw Error('External script or stylesheet dependency');
if(/(?:localStorage|sessionStorage)\s*[.[]/.test(fs.readFileSync('assets/dashboard.js','utf8')))throw Error('Browser storage must not be used');
const result={checks,scenarios:refs.length,status:'passed',tolerance:1e-9,external_script_or_stylesheet_dependencies:0};
fs.writeFileSync('validation/browser_math_checks.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));

