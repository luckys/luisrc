import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {selectRun,checkpoint,batchGroups,residual,resumeSummary} from '../public/assets/interactive/pytorch-training/model.mjs'
const origin=process.env.PYTORCH_DRAFT_ORIGIN??'http://127.0.0.1:4322'
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname))
const m=JSON.parse(await readFile('docs/editorial/pytorch-training-series.json'))
const data=JSON.parse(await readFile('public/assets/interactive/pytorch-training/comparison.json'))
const folder=await mkdtemp('/tmp/pytorch-training-layout.'),views=[],errors=[]
const fmt=v=>v===null?'Aún no calculado':Number(v).toLocaleString('es-ES',{maximumSignificantDigits:8})
const table=async(page,id)=>page.locator('#'+id+' tr').evaluateAll(rs=>rs.map(r=>[...r.cells].map(c=>c.textContent)))
async function checkChart(page,id,series,axis,epoch){
 const maxX=Math.max(...series.flatMap(s=>s.rows.map(r=>r[axis]))),maxY=Math.max(...series.flatMap(s=>s.rows.map(r=>r[s.key]).filter(v=>v!==null)))*1.06
 for(const s of series){
  const points=s.rows.filter(r=>r[s.key]!==null).map(r=>`${(58+r[axis]/maxX*300).toFixed(3)},${(255-r[s.key]/maxY*220).toFixed(3)}`).join(' ')
  assert.equal(await page.locator(`#${id} polyline[data-series="${s.id}"]`).getAttribute('points'),points)
  const h=s.rows.find(r=>r.epoch===epoch),circle=page.locator(`#${id} circle[data-checkpoint="${s.id}"]`)
  assert.equal(await circle.count(),h[s.key]===null?0:1)
  if(h[s.key]!==null){assert.ok(Math.abs(+(await circle.getAttribute('cx'))-(58+h[axis]/maxX*300))<1e-9);assert.ok(Math.abs(+(await circle.getAttribute('cy'))-(255-h[s.key]/maxY*220))<1e-9)}
 }
}
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)))
 for(const width of [1440,360]){
  await page.setViewportSize({width,height:1000})
  for(const a of m.articles){
   assert.equal((await page.goto(origin+'/posts/'+a.slug,{waitUntil:'networkidle'})).status(),200)
   await page.addStyleTag({content:'astro-dev-toolbar{display:none}'})
   assert.equal((await page.locator('h1#'+a.slug).textContent()).trim(),'# '+a.title)
   assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),a.id)
   let n=0
   for(const img of await page.locator('article img[src*="/pytorch-training/"]').all()){
    await img.scrollIntoViewIfNeeded();await page.waitForFunction(e=>e.complete&&e.naturalWidth>0,await img.elementHandle());assert.ok((await img.boundingBox()).width<=380.1)
    if(width===360)await img.screenshot({path:folder+'/'+a.id+'-figure-'+n++ +'.png'})
   }
   for(const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all())assert.equal((await page.request.get(origin+await link.getAttribute('href'))).status(),200)
   for(const region of await page.locator('article [role="region"],article pre[tabindex="0"]').all()){
    await region.scrollIntoViewIfNeeded();await region.focus();assert.ok(await region.evaluate(e=>e===document.activeElement))
    if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+2)){await region.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle());await region.evaluate(e=>e.scrollTo({left:0,behavior:'instant'}))}
   }
   if(a.id==='DL-RESUME'){await page.locator('iframe').scrollIntoViewIfNeeded();await page.frameLocator('iframe').locator('#seed:not([disabled])').waitFor()}
   const code=page.locator('article .expressive-code').first();if(width===360&&await code.count())await code.screenshot({path:folder+'/'+a.id+'-code.png'})
   await page.screenshot({path:folder+'/'+a.id+'-'+width+'.png',fullPage:true});views.push({id:a.id,width,status:'passed'})
  }
  const requests=[],listen=r=>requests.push(new URL(r.url()).pathname);page.on('request',listen)
  await page.goto(origin+'/assets/interactive/pytorch-training/explorer.html',{waitUntil:'networkidle'});await page.locator('#seed:not([disabled])').waitFor()
  let checkpoints=0,resumes=0,shapes=0,batchRows=0
  const setEpoch=async epoch=>{await page.locator('#epoch').evaluate((el,n)=>{el.value=n;el.dispatchEvent(new Event('input',{bubbles:true}))},epoch);assert.equal(await page.locator('#epoch-value').textContent(),String(epoch))}
  for(const seed of [7,19,31]){
   await page.selectOption('#seed',String(seed));const run=selectRun(data,seed)
   for(const axis of ['updates','epoch','examplesSeen']){
    await page.selectOption('#axis',axis)
    for(const epoch of [0,1,20,30,31,40,60]){
     await setEpoch(epoch);const h=checkpoint(run,epoch)
     assert.deepEqual(await table(page,'metrics'),[['Updates',fmt(h.updates)],['Muestras procesadas',fmt(h.examplesSeen)],['Train loss a pesos fijos',fmt(h.trainLoss)],['Validation loss',fmt(h.validationLoss)],['Loss online del recorrido',fmt(h.onlineLoss)],['Validation accuracy',fmt(h.validationAccuracy)],['Tasa usada',fmt(h.lrUsed)],['Tasa preparada para la siguiente epoch',fmt(h.lrNext)]])
     const batches=batchGroups(h,30);assert.deepEqual(await table(page,'order'),batches.map(g=>[String(g.number),String(g.size),g.ids.join(', ')]));batchRows+=batches.length
     await checkChart(page,'training-chart',[{id:'train',rows:run.history,key:'trainLoss'},{id:'validation',rows:run.history,key:'validationLoss'},{id:'online',rows:run.history,key:'onlineLoss'}],axis,epoch)
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
     checkpoints++
    }
   }
  }
  for(const r of data.resumed){
   await page.selectOption('#variant',r.variant)
   for(const axis of ['updates','epoch','examplesSeen']){
    await page.selectOption('#axis',axis)
    for(const epoch of [0,30,31,60]){
     await setEpoch(epoch);const s=resumeSummary(data,r.variant,epoch)
     assert.deepEqual(await table(page,'resume-values'),[['Updates',fmt(s.original.updates),fmt(s.resumed.updates)],['Validation loss',fmt(s.original.validationLoss),fmt(s.resumed.validationLoss)],['Tasa usada',fmt(s.original.lrUsed),fmt(s.resumed.lrUsed)],['Próxima tasa',fmt(s.original.lrNext),fmt(s.resumed.lrNext)]])
     assert.ok((await page.locator('#resume-error').textContent()).includes(s.error===0?'0':s.error.toExponential(6)))
     await checkChart(page,'resume-chart',[{id:'continuous',rows:data.runs[0].history,key:'validationLoss'},{id:'resumed',rows:r.history,key:'validationLoss'}],axis,epoch)
     assert.match(await page.locator('h2').filter({hasText:'Reanudación'}).textContent(),/seed 7/)
     resumes++
    }
   }
  }
  for(const mode of ['bad','good']){
   await page.selectOption('#shape',mode);const s=residual(data,mode)
   assert.deepEqual(await table(page,'residual'),s.matrix.map((row,i)=>['Fila '+i,...row.map(fmt)]))
   assert.ok((await page.locator('#shape-status').textContent()).includes(fmt(s.mse)));shapes++
  }
  await page.locator('#epoch').focus();await page.locator('#epoch').press('Home');assert.equal(await page.locator('#previous').isDisabled(),true)
  await page.locator('#next').click();assert.equal(await page.locator('#epoch').inputValue(),'1')
  await page.locator('#epoch').focus();await page.locator('#epoch').press('End');assert.equal(await page.locator('#next').isDisabled(),true)
  await page.locator('summary').first().click();await page.locator('summary').last().click();await page.locator('#provenance').focus();assert.ok(await page.locator('#provenance').evaluate(e=>e===document.activeElement))
  if(width===360){const region=page.locator('[aria-label="Batches y sus índices"]');await region.scrollIntoViewIfNeeded();await region.focus();await region.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle())}
  assert.ok(requests.every(p=>p.startsWith('/assets/interactive/pytorch-training/')),requests.join('\n'));page.off('request',listen)
  await page.screenshot({path:folder+'/viewer-'+width+'.png',fullPage:true});views.push({id:'viewer',width,checkpoints,resumes,shapes,batchRows,status:'passed'})
 }
 await page.route('**/comparison.json',r=>r.fulfill({status:404,body:'missing'}));await page.goto(origin+'/assets/interactive/pytorch-training/explorer.html',{waitUntil:'networkidle'})
 assert.match(await page.locator('#status').textContent(),/No se pudieron cargar/);assert.equal(await page.locator('select:not([disabled]),input:not([disabled]),button:not([disabled])').count(),0)
 assert.deepEqual(errors,[]);await writeFile(folder+'/report.json',JSON.stringify({origin,views,errors,missingReport:'explicit_error'},null,2)+'\n');console.log(folder+'/report.json')
}finally{await browser.close()}
