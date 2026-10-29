(function () {
  'use strict';
  async function start() {
    if (!window.DecompressionStream) throw new Error('Please open this file in a current version of Chrome, Edge or Firefox.');
    const bytes = Uint8Array.from(atob(document.getElementById('spar-data').textContent), c=>c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const C = SparCore, d = await new Response(stream).json();
    Object.keys(d).filter(k => k !== 'meta').forEach(k => { d[k] = C.unpack(d[k]); });
    const $ = id => document.getElementById(id), regions = d.meta.regions;
    const codes = d.capacities.map(r => r.capacity), indCodes = d.indicators.map(r => r.indicator);
    const charts = new Map(), handles = {}, state = { year: 2025, region: 'Total', country: 'Total' };
    const blues = ['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'];
    const categorical = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'];
    const thresholdColors = ['#c2dce9', '#0072b2'];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const fmt = x => C.valid(x) ? x.toFixed(1) : 'No data';
    const options = (id, rows, selected) => {
      const old = selected === undefined ? $(id).value : String(selected);
      $(id).innerHTML = rows.map(r => `<option value="${esc(r.value)}">${esc(r.label)}</option>`).join('');
      if (rows.some(r => String(r.value) === old)) $(id).value = old;
    };
    const simpleOptions = (id, values, selected) => options(id, values.map(x => ({value:x,label:x === 'Total' ? 'All' : x})), selected);
    const capOptions = total => (total ? [{value:'Total',label:'All capacities'}] : []).concat(d.capacities.map(r => ({value:r.capacity,label:`${r.capacity} · ${r.detail}`})));
    const table = (id, columns, rows) => {
      $(id).innerHTML = rows.length ? `<table><thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(typeof v === 'number' ? fmt(v) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<div class="empty">No data for this selection.</div>';
    };
    const chart = (id, option) => {
      if (!$(id) || !$(id).getClientRects().length) return;
      if (!charts.has(id)) charts.set(id, echarts.init($(id), null, {renderer:'svg'}));
      const instance = charts.get(id);
      instance.setOption({animation:false,color:categorical,textStyle:{fontFamily:'Arial',fontSize:12,color:'#18344c'},
        aria:{enabled:true},tooltip:{trigger:'item',confine:true},...option}, true);
      instance.resize();
      return instance;
    };
    const emptyChart = id => chart(id,{title:{text:'No data for this selection',left:'center',top:'center',textStyle:{fontSize:14,color:'#52697b'}}});
    const bar = (id, rows, opts = {}) => rows.length ? chart(id,{
      grid:{left:opts.horizontal ? 160 : 55,right:20,top:25,bottom:opts.rotate ? 90 : 55,containLabel:!!opts.horizontal},
      xAxis:opts.horizontal ? {type:'value',max:opts.max} : {type:'category',data:rows.map(r=>r.name),axisLabel:{rotate:opts.rotate || 0,interval:0}},
      yAxis:opts.horizontal ? {type:'category',data:rows.map(r=>r.name),axisLabel:{width:170,overflow:'truncate'}} : {type:'value',max:opts.max},
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'},confine:true},
      series:[{type:'bar',data:rows.map(r=>r.value),itemStyle:{color:'#0072b2'},barMaxWidth:42}]
    }) : emptyChart(id);
    const pie = (id, rows, colors) => rows.length && rows.some(r=>r.value>0) ? chart(id,{
      color:colors || categorical,legend:{bottom:0,type:'scroll'},
      series:[{type:'pie',radius:['45%','68%'],center:['50%','43%'],avoidLabelOverlap:true,
        label:{formatter:'{b}\n{d}%',fontSize:11},data:rows}]
    }) : emptyChart(id);
    const stacked = (id, cats, names, values, opts = {}) => chart(id,{
      color:opts.colors || categorical,legend:{bottom:0,type:'scroll'},
      grid:{left:opts.horizontal?75:50,right:20,top:20,bottom:70},
      xAxis:opts.horizontal?{type:'value',max:opts.max}:{type:'category',data:cats,axisLabel:{interval:0,rotate:opts.rotate || 0}},
      yAxis:opts.horizontal?{type:'category',data:cats,inverse:true}:{type:'value',max:opts.max},
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'},confine:true},
      series:names.map((name,i)=>({name,type:'bar',stack:'all',data:values[i]}))
    });
    function mosaic(id, rows, field, categories, colors) {
      if (!rows.length) return emptyChart(id);
      const total = rows.length, tiles = []; let left = 0;
      regions.forEach(region => {
        const group = rows.filter(r=>r.region === region); if (!group.length) return;
        const width = group.length/total*100; let bottom = 0;
        categories.forEach((category,i)=>{
          const count = group.filter(r=>String(r[field]) === String(category)).length;
          const height = count/group.length*100;
          if (count) tiles.push({name:`${region} · ${category}: ${count}`,value:[left,bottom,left+width,bottom+height],itemStyle:{color:colors[i]}});
          bottom += height;
        });
        left += width;
      });
      chart(id,{grid:{left:40,right:15,top:25,bottom:45},xAxis:{min:0,max:100,axisLabel:{show:false},name:'Region width represents reporting-country count',nameLocation:'middle',nameGap:20},
        yAxis:{min:0,max:100,axisLabel:{formatter:'{value}%'}},tooltip:{formatter:p=>esc(p.name)},
        series:[{type:'custom',data:tiles,renderItem:(params,api)=>{
          const p1=api.coord([api.value(0),api.value(1)]),p2=api.coord([api.value(2),api.value(3)]);
          return {type:'rect',shape:{x:p1[0],y:p2[1],width:p2[0]-p1[0],height:p1[1]-p2[1]},style:api.style({stroke:'#fff',lineWidth:1})};
        }}]});
    }
    function csv(filename, rows, columns) {
      const quote = value => { let s = value == null ? '' : String(value); if (/^[=+@\t\r]/.test(s) || /^-[^\d.]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g,'""') + '"'; };
      const content = '\ufeff' + [columns,...rows.map(r=>columns.map(c=>r[c]))].map(r=>r.map(quote).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));
      const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function updateCountries() {
      // Union across years: allows time comparisons for countries missing in the selected year.
      const names = [...new Set(d.cap.filter(r=>state.region==='Total'||r.region===state.region).map(r=>r.country))].sort();
      simpleOptions('country',['Total',...names],state.country); state.country=$('country').value;
    }
    function linkedFilters() {
      if (!window.crosstalk) return;
      ['capacity','indicator'].forEach(type=>{
        const group='spar-'+type;
        if (!handles[group]) handles[group]=new crosstalk.FilterHandle(group);
        handles[group].set(C.select(type==='capacity'?d.cap:d.ind,state).map(r=>r.key));
      });
    }
    function renderOverview() {
      const metric=$('map-metric').value, threshold=+$('threshold').value;
      $('threshold-value').textContent=threshold;
      const all=C.select(d.cap,{...state,region:'Total'},true), rows=C.select(d.cap,state,true);
      const scores=rows.map(r=>r[metric]).filter(C.valid), above=scores.filter(x=>x>=threshold).length;
      const metrics=[[rows.length,'Reporting States Parties'],[fmt(C.mean(scores)),'Mean score / 100'],[above,'At or above threshold'],[scores.length?Math.round(above/scores.length*100)+'%':'No data','Share at or above threshold']];
      $('overview-metrics').innerHTML=metrics.map(([v,l])=>`<div class="metric"><span class="value">${esc(v)}</span><span class="label">${esc(l)}</span></div>`).join('');
      const isoNames=new Map(d.map_names.map(r=>[r.iso,r.map_name]));
      const mapSet=new Set(echarts.getMap('world').geoJSON.features.map(f=>f.properties.name));
      const mapRows=rows.filter(r=>isoNames.has(r.iso)&&mapSet.has(isoNames.get(r.iso)));
      const map=chart('world-map',{
        visualMap:{type:'piecewise',left:12,bottom:0,orient:'horizontal',pieces:[{value:0,label:`Below ${threshold}`,color:thresholdColors[0]},{value:1,label:`At or above ${threshold}`,color:thresholdColors[1]}]},
        tooltip:{formatter:p=>{const r=rows.find(x=>isoNames.get(x.iso)===p.name);return esc(r?`${r.country}: ${fmt(r[metric])} / 100`:`${p.name}: no matched observation`);}},
        series:[{type:'map',map:'world',roam:true,zoom:1.05,itemStyle:{areaColor:'#edf0f2',borderColor:'#fff',borderWidth:.5},emphasis:{itemStyle:{areaColor:'#e6ab02'}},
          data:mapRows.map(r=>({name:isoNames.get(r.iso),value:C.valid(r[metric])?(r[metric]>=threshold?1:0):null}))}]
      });
      if(map){map.off('click');map.on('click',p=>{const row=rows.find(r=>isoNames.get(r.iso)===p.name);if(row){state.country=row.country;$('country').value=row.country;update();const tab=[...document.querySelectorAll('[role=tab]')].find(el=>el.textContent.trim()==='Countries');if(tab)tab.click();}});}
      const unmatched=rows.filter(r=>!mapRows.includes(r)).map(r=>r.country);
      $('map-coverage').textContent=`Map matches ${mapRows.length} of ${rows.length} reporting States Parties. ${unmatched.length?'Not represented by this basemap: '+unmatched.join('; ')+'. ':''}All observations remain in charts and tables. Grey areas have no matched observation.`;
      pie('threshold-pie',[{name:'Below threshold',value:scores.length-above},{name:'At or above threshold',value:above}],thresholdColors);
      stacked('threshold-regions',regions,['Below threshold','At or above threshold'],[0,1].map(k=>regions.map(region=>all.filter(r=>r.region===region&&C.valid(r[metric])&&+(r[metric]>=threshold)===k).length)),{colors:thresholdColors});
    }
    function renderRegions() {
      const all=C.select(d.cap,{...state,region:'Total'},true), chosen=C.select(d.cap,state,true);
      const quantile=(xs,p)=>{const a=xs.filter(C.valid).sort((a,b)=>a-b),h=(a.length-1)*p,i=Math.floor(h);return a.length?(a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(h-i)):null;};
      chart('region-box',{grid:{left:50,right:15,top:20,bottom:45},xAxis:{type:'category',data:regions},yAxis:{min:0,max:100},series:[{type:'boxplot',data:regions.map(region=>{const xs=all.filter(r=>r.region===region).map(r=>r.overall);return [0,.25,.5,.75,1].map(p=>quantile(xs,p));}),itemStyle:{color:'#c6dbef',borderColor:'#0072b2'}}]});
      bar('region-mean',regions.map(region=>({name:region,value:C.mean(all.filter(r=>r.region===region).map(r=>r.overall))})),{max:100});
      const heatRegions=[...regions,'Total'], heat=[];
      heatRegions.forEach((region,y)=>{const source=region==='Total'?all:all.filter(r=>r.region===region);codes.forEach((code,x)=>{const mean=C.mean(source.map(r=>r[code]));heat.push([x,y,C.level(mean)||0,mean]);});});
      chart('region-heat',{grid:{left:70,right:20,top:10,bottom:70},xAxis:{type:'category',data:codes,axisLabel:{interval:0}},yAxis:{type:'category',data:heatRegions.map(x=>x==='Total'?'Global':x),inverse:true},
        visualMap:{type:'piecewise',orient:'horizontal',bottom:0,left:'center',pieces:[{value:0,label:'Zero / no level',color:'#e5e7eb'},...blues.map((color,i)=>({value:i+1,label:`Level ${i+1}`,color}))]},
        tooltip:{formatter:p=>`${esc(heatRegions[p.value[1]])} · ${codes[p.value[0]]}<br>Mean: ${fmt(p.value[3])}`},series:[{type:'heatmap',data:heat,label:{show:true,formatter:p=>C.valid(p.value[3])?p.value[3].toFixed(0):'–'},itemStyle:{borderWidth:2,borderColor:'#fff'}}]});
      stacked('capacity-levels',codes,['Zero / no level',...blues.map((_,i)=>`Level ${i+1}`)],Array.from({length:6},(_,i)=>codes.map(code=>chosen.filter(r=>(C.level(r[code])||0)===i).length)),{colors:['#e5e7eb',...blues],rotate:35});
      pie('overall-levels',Array.from({length:6},(_,i)=>({name:i?`Level ${i}`:'Zero / no level',value:chosen.filter(r=>(C.level(r.overall)||0)===i).length})),['#e5e7eb',...blues]);
      mosaic('level-mosaic',all.map(r=>({...r,level:C.level(r.overall)||0})),'level',[0,1,2,3,4,5],['#e5e7eb',...blues]);
    }
    function extremes(id, rows, lookup, codeField, scoreField) {
      const xs=rows.map(r=>({code:r[codeField],label:lookup.find(l=>l.id===r[codeField])?.detail||'',score:r[scoreField]})).filter(r=>C.valid(r.score));
      const low=r=>xs.filter(x=>x.score<r.score).length<3,high=r=>xs.filter(x=>x.score>r.score).length<3;
      table(id,['Group','Code','Description','Score'],xs.filter(r=>low(r)||high(r)).sort((a,b)=>b.score-a.score).map(r=>[high(r)?(low(r)?'Highest / lowest':'Highest'):'Lowest',r.code,r.label,r.score]));
    }
    function renderCountries() {
      const row=C.select(d.cap,state)[0], ind=C.select(d.ind,state)[0];
      const selected=state.country!=='Total';
      $('country-content').hidden=!selected||!row;
      $('country-empty').hidden=selected&&!!row;
      $('country-empty').textContent=selected?'No SPAR capacity observation for this country and year.':'Select one State Party to view its SPAR profile.';
      if(selected&&row){
        const capRows=codes.map(code=>({code,score:row[code]})),indRows=indCodes.map(code=>({code,score:ind?ind[code]:null}));
        bar('country-cap',capRows.slice().sort((a,b)=>a.score-b.score).map(r=>({name:r.code,value:r.score})),{max:100});
        bar('country-ind',indRows.slice().sort((a,b)=>a.score-b.score).map(r=>({name:r.code,value:r.score})),{max:100,rotate:65});
        const lookup=[...d.capacities.map(r=>({id:r.capacity,detail:r.detail})),...d.indicators.map(r=>({id:r.indicator,detail:r.detail}))];
        extremes('cap-extremes',capRows,lookup,'code','score');extremes('ind-extremes',indRows,lookup,'code','score');
      }
    }
    const compareRows=()=>C.compare(d,state,[...document.querySelectorAll('#comparison-year-options input:checked')].map(x=>+x.value),$('compare-capacity').value,$('compare-indicator').value);
    function renderCompare(){const rows=compareRows();['overall','capacity','indicator'].forEach(field=>bar('trend-'+field,rows.map(r=>({name:String(r.year),value:r[field]})),{max:100}));table('trend-table',['Year','Overall',$('compare-capacity').value,$('compare-indicator').value],rows.map(r=>[String(r.year),r.overall,r.capacity,r.indicator]));}
    function renderComments(){
      const words=C.keywords($('spar-keywords').value),counts=C.keywordCounts(C.select(d.comments,state),words).sort((a,b)=>b.value-a.value);
      bar('keyword-chart',counts,{rotate:35});table('keyword-table',['Capacity','Description','Occurrences'],counts.map(r=>[r.name,d.capacities.find(c=>c.capacity===r.name)?.detail||'',r.value]));
      const top=C.topWords(C.select(d.words,state),$('word-capacity').value);
      bar('word-chart',top.slice().reverse(),{horizontal:true});
      const max=top[0]?.value||1;
      $('word-cloud').innerHTML=top.length?top.map(r=>`<span title="${esc(r.value+' occurrences')}" style="font-size:${14+28*r.value/max}px;color:${blues[2+Math.round(r.value/max*2)]}">${esc(r.name)}</span>`).join(''):'<p class="note">No words for this selection.</p>';
    }
    function renderTables(){
      $('table-count').textContent=`${C.select(d.cap,state).length} capacity rows and ${C.select(d.ind,state).length} indicator rows match the sidebar selection. Scroll horizontally to inspect all scores.`;
      table('lookup-tables',['Code','Description'],[...d.capacities.map(r=>[r.capacity,r.detail]),...d.indicators.map(r=>[r.indicator,r.detail])]);
      linkedFilters();
    }
    function renderReporting(){
      const counts=d.submissions.filter(r=>+r.year===+state.year);
      bar('submission-regions',regions.map(region=>({name:region,value:counts.find(r=>r.region===region)?.n||0})));
      bar('submission-years',d.meta.years.map(year=>({name:String(year),value:d.submissions.filter(r=>+r.year===+year).reduce((s,r)=>s+r.n,0)})));
      const imp=C.select(d.implementation,state),statuses=['Achieved','Strength/best practice','Ongoing','Planned','Challenges/gaps','Other'];
      stacked('implementation',indCodes,statuses,statuses.map(status=>indCodes.map(code=>{const group=imp.filter(r=>r.indicator===code),n=group.reduce((s,r)=>s+r.n,0);return n?group.filter(r=>r.status===status).reduce((s,r)=>s+r.n,0)/n:null;})),{horizontal:true,max:1});
      bar('areas',C.sumBy(C.select(d.areas,state),r=>r.area,r=>r.n).sort((a,b)=>a.value-b.value),{horizontal:true});
      const raw=C.select(d.raw,state,true),all=C.select(d.raw,{...state,region:'Total'},true).filter(r=>r.approach);
      pie('compilation',C.sumBy(raw.filter(r=>r.approach),r=>r.approach));
      const approaches=[...new Set(all.map(r=>r.approach))];mosaic('compilation-mosaic',all,'approach',approaches,categorical);
      const splitCounts=field=>C.sumBy(raw.flatMap(r=>r[field]?r[field].split(', ').map(name=>({name})):[]),r=>r.name);
      pie('consultations',splitCounts('consultative'));bar('sectors',splitCounts('sector').sort((a,b)=>a.value-b.value),{horizontal:true});
    }
    const renders={overview:renderOverview,regions:renderRegions,countries:renderCountries,compare:renderCompare,comments:renderComments,tables:renderTables,reporting:renderReporting};
    function renderVisible(){
      try{
        Object.entries(renders).forEach(([name,render])=>{if(document.querySelector(`[data-page="${name}"]`)?.getClientRects().length)render();});
        charts.forEach(c=>c.resize());
      }catch(error){console.error(error);$('filter-summary').textContent='Dashboard error: '+error.message;}
    }
    function update(){
      const context=`${state.year} · ${state.region==='Total'?'All WHO regions':state.region} · ${state.country==='Total'?'All States Parties':state.country}`;
      document.querySelectorAll('[data-context]').forEach(el=>{el.textContent=context;});$('filter-summary').textContent=context;
      linkedFilters();renderVisible();
    }
    simpleOptions('year',d.meta.years,2025);simpleOptions('region',['Total',...regions],'Total');updateCountries();
    options('map-metric',[{value:'overall',label:'Overall SPAR score'},...capOptions(false)],'overall');
    options('compare-capacity',capOptions(false),'C1');options('word-capacity',capOptions(true),'Total');
    options('compare-indicator',d.indicators.map(r=>({value:r.indicator,label:`${r.indicator} · ${r.detail}`})),'C1.1');
    $('comparison-year-options').innerHTML=d.meta.years.map(year=>`<label><input type="checkbox" value="${year}" checked>${year}</label>`).join('');
    ['year','region','country'].forEach(id=>$(id).addEventListener('change',()=>{state[id]=id==='year'?+$(id).value:$(id).value;if(id==='region')updateCountries();update();}));
    ['map-metric','threshold','compare-capacity','compare-indicator','word-capacity'].forEach(id=>$(id).addEventListener(id==='threshold'?'input':'change',renderVisible));
    $('comparison-year-options').addEventListener('change',renderCompare);
    let timer;['spar-keywords'].forEach(id=>$(id).addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(renderComments,350);}));
    $('reset-filters').addEventListener('click',()=>{Object.assign(state,{year:2025,region:'Total',country:'Total'});$('year').value=2025;$('region').value='Total';updateCountries();$('country').value='Total';update();});
    $('download-capacity').addEventListener('click',()=>csv(`spar-capacity-${state.year}.csv`,C.select(d.cap,state),['year','region','country','iso',...codes,'overall']));
    $('download-indicator').addEventListener('click',()=>csv(`spar-indicator-${state.year}.csv`,C.select(d.ind,state),['year','region','country','iso',...indCodes]));
    $('download-comparison').addEventListener('click',()=>csv('spar-comparison.csv',compareRows(),['year','overall','capacity','indicator']));
    $('source-info').textContent=`Source MD5: ${d.meta.source_md5} · Build date: ${d.meta.build_date}`;
    document.addEventListener('shown.bs.tab',renderVisible);
    const observer=new MutationObserver(()=>requestAnimationFrame(renderVisible));
    document.querySelectorAll('.tab-pane').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class']}));
    let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>charts.forEach(c=>c.resize()),150);});
    window.addEventListener('load',()=>{linkedFilters();renderVisible();});
    update();
  }
  const run = () => start().catch(error=>{console.error(error);document.getElementById('filter-summary').textContent=error.message;});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();

