import {analyzer,normalize,wordNgrams} from './analysis.mjs';
import {buildIndex,search} from './retrieval.mjs';
import {metrics} from './evaluation.mjs';
import {applyBpe,wordPiece} from './subwords.mjs';
import {bars} from './charts.mjs';
const data=await fetch('./comparison.json').then(r=>{if(!r.ok)throw Error('No se cargaron los datos');return r.json()});
const $=id=>document.getElementById(id),fmt=n=>n==null?'No aplica':n.toFixed(6);
const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const option=(value,label)=>{const o=element('option',label);o.value=value;return o};
for(const v of data.variants)$('variant').append(option(v.id,v.id));
$('variant').value='bm25-fold';
for(const q of data.queries)$('query').append(option(q.id,`${q.id} · ${q.split} · ${q.text}`));
for(let i=0;i<=data.subwords.merges.length;i++)$('step').append(option(String(i),String(i)));
$('step').value=String(data.subwords.merges.length);
let labeled=true;
function renderSearch(){
 const v=data.variants.find(v=>v.id===$('variant').value),q=data.queries.find(q=>q.id===$('query').value);
 const text=labeled?q.text:$('text').value,index=buildIndex(data.corpus,analyzer(v.mode,data.lexicon));
 const ranking=search(index,text,{method:v.method,...data.protocol.bm25});
 $('intent').textContent=labeled?`${q.intent} Relevantes: ${q.relevant.join(', ')||'ninguno'}.`: 'Consulta libre: no tiene etiquetas ni métricas gold.';
 $('tokens').textContent='Tokens: '+JSON.stringify(index.analyze(text));
 const m=labeled?metrics(ranking,q.relevant,3):null;
 $('query-metrics').textContent=m?`P@3 ${fmt(m.precision)} · R@3 ${fmt(m.recall)} · RR@3 ${fmt(m.rr)}`:labeled?'Sin respuesta en el corpus. Coincidencias no implican relevancia.':'Relevancia sin evaluar.';
 $('ranking').replaceChildren();
 if(!ranking.length)$('ranking').append(element('p','No hay términos compartidos con los documentos.'));
 for(const [i,row]of ranking.slice(0,3).entries()){
  const d=data.corpus.find(d=>d.id===row.id),a=element('article');a.dataset.document=row.id;
  a.append(element('h3',`${i+1}. ${d.id} · ${d.title}`),element('p',d.body),element('p',`Score ${fmt(row.score)}${labeled?' · '+(q.relevant.includes(row.id)?'Relevante según etiqueta':'No relevante según etiqueta'):''}`));
  if(row.terms.length){const box=element('div');box.className='scroll';box.tabIndex=0;box.role='region';box.ariaLabel='Contribuciones '+row.id;
   const table=element('table'),head=element('thead'),tr=element('tr');for(const t of ['Término','TF','DF','Longitud','IDF','Contribución'])tr.append(element('th',t));head.append(tr);table.append(head);
   const body=element('tbody');for(const t of row.terms){const tr=element('tr');for(const value of [t.term,t.tf,t.df,t.length,fmt(t.idf),fmt(t.contribution)])tr.append(element('td',value));body.append(tr);}table.append(body);box.append(table);a.append(box);
  }else a.append(element('small','TF-IDF: cosine entre vectores L2, sin descomposición BM25.'));
  $('ranking').append(a);
 }
 $('status').textContent=`${labeled?q.id:'Texto libre'} · ${v.id} · ${ranking.length} coincidencias positivas, se muestran hasta tres.`;
}
function renderAnalysis(){
 const text=$('analysis-text').value;$('analysis-results').replaceChildren();
 for(const mode of ['literal','fold','plural','lookup','char3'])$('analysis-results').append(element('h3',mode),element('pre',JSON.stringify(analyzer(mode,data.lexicon)(text))));
 $('analysis-results').append(element('h3','Bigrams de palabras con fold'),element('pre',JSON.stringify(wordNgrams(analyzer('fold')(text),2))));
}
function renderMetrics(){
 const split=$('split').value;$('metrics-rows').replaceChildren();
 for(const v of data.variants){const m=v.summary[split],row=element('tr');row.dataset.variant=v.id;for(const x of [v.id,m.answerable,fmt(m.precision),fmt(m.recall),fmt(m.mrr),v.vocabulary])row.append(element('td',x));$('metrics-rows').append(row);}
 $('metric-chart').innerHTML=bars('Recall@3 · '+split,data.variants.map(v=>({label:v.id,value:v.summary[split].recall})),{maximum:1});
 $('errors').replaceChildren(element('h3','Tres errores que el promedio oculta'));
 for(const [id,vId]of [['Q17','bm25-char3'],['Q19','bm25-fold'],['Q20','bm25-fold']]){const q=data.queries.find(q=>q.id===id),r=data.variants.find(v=>v.id===vId).rows.find(r=>r.id===id);$('errors').append(element('p',`${id} · ${vId} · «${q.text}»: ${r.ranking.slice(0,3).map(r=>r.id).join(', ')||'sin coincidencias'}. Relevantes: ${q.relevant.join(', ')||'ninguno'}.`));}
}
function renderSubwords(){
 const word=normalize($('word').value).replace(/\s/gu,''),n=Number($('step').value),bpe=applyBpe(word,data.subwords.merges.slice(0,n)),wp=wordPiece(word,data.protocol.subwords.vocabulary);
 $('pieces').textContent=`BPE: ${JSON.stringify(bpe)} · WordPiece: ${JSON.stringify(wp)}`;
 $('merge-trace').replaceChildren(element('h3','Merges aprendidos del corpus bajo/bajos/baja/caja'));
 for(const t of data.subwords.trace.slice(0,n))$('merge-trace').append(element('p',`${t.step}: ${t.pair.join(' + ')} → ${t.pair.join('')} · frecuencia ${t.frequency}`));
 $('merge-trace').append(element('pre','Vocabulario WordPiece: '+JSON.stringify(data.protocol.subwords.vocabulary)));
}
for(const button of document.querySelectorAll('[data-section]'))button.addEventListener('click',()=>{for(const b of document.querySelectorAll('[data-section]'))b.setAttribute('aria-pressed',String(b===button));for(const id of ['search','analysis','metrics','subwords'])$(id).hidden=id!==button.dataset.section;$('status').textContent='Sección '+button.textContent;});
$('variant').addEventListener('change',renderSearch);$('query').addEventListener('change',()=>{labeled=true;renderSearch()});
$('custom').addEventListener('submit',e=>{e.preventDefault();labeled=false;renderSearch()});
$('analysis-text').addEventListener('input',renderAnalysis);$('split').addEventListener('change',renderMetrics);$('word').addEventListener('input',renderSubwords);$('step').addEventListener('change',renderSubwords);
renderSearch();renderAnalysis();renderMetrics();renderSubwords();
