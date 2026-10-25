import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {selectRuns,summarize,seriesPoints} from '../public/assets/interactive/training-dynamics/model.mjs'
const origin=process.env.TRAINING_DRAFT_ORIGIN??'http://127.0.0.1:4322'
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname))
const m=JSON.parse(await readFile('docs/editorial/training-dynamics-series.json'))
const data=JSON.parse(await readFile('public/assets/interactive/training-dynamics/comparison.json'))
const folder=await mkdtemp('/tmp/training-dynamics-layout.'),views=[],errors=[]
const fmt=v=>v===null?'Sin actualización':Number(v).toLocaleString('es-ES',{maximumSignificantDigits:7})
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)))
 for(const width of [1440,360]){
  await page.setViewportSize({width,height:1000})
  for(const a of m.articles){
   assert.equal((await page.goto(origin+'/posts/'+a.slug,{waitUntil:'networkidle'})).status(),200)
   assert.equal((await page.locator('h1#'+a.slug).textContent()).trim(),'# '+a.title)
   assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),a.id)
   let n=0
   for(const img of await page.locator('article img[src*="/training-dynamics/"]').all()){
    await img.scrollIntoViewIfNeeded();await page.waitForFunction(e=>e.complete&&e.naturalWidth>0,await img.elementHandle())
    assert.ok((await img.boundingBox()).width<=380.1)
    if(width===360)await img.screenshot({path:folder+'/'+a.id+'-figure-'+n+++'.png'})
   }
   for(const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all())assert.equal((await page.request.get(origin+await link.getAttribute('href'))).status(),200)
   for(const region of await page.locator('article [role="region"],article pre[tabindex="0"]').all()){
    await region.scrollIntoViewIfNeeded();await region.focus();assert.ok(await region.evaluate(e=>e===document.activeElement))
    if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+2)){await region.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle())}
   }
   if(a.id==='DL-ACCUMULATION'){await page.locator('iframe').scrollIntoViewIfNeeded();await page.frameLocator('iframe').locator('#group:not([disabled])').waitFor()}
   const code=page.locator('article .expressive-code').first();if(width===360&&await code.count())await code.screenshot({path:folder+'/'+a.id+'-code.png'})
   await page.screenshot({path:folder+'/'+a.id+'-'+width+'.png',fullPage:true});views.push({id:a.id,width,status:'passed'})
  }
  const requests=[],listen=r=>requests.push(new URL(r.url()).pathname);page.on('request',listen)
  await page.goto(origin+'/assets/interactive/training-dynamics/explorer.html',{waitUntil:'networkidle'});await page.locator('#group:not([disabled])').waitFor()
  let states=0,rowChecks=0
  for(const[group,seed]of [['optimizers',7],['optimizers',19],['optimizers',31],['batch',7],['rate',7],['schedule',7]]){
   await page.selectOption('#group',group)
   if(group==='optimizers')await page.selectOption('#seed',String(seed))
   assert.equal(await page.locator('#seed').isDisabled(),group!=='optimizers')
   assert.equal(await page.locator('#seed').inputValue(),String(seed))
   const runs=selectRuns(data,group,seed)
   for(const axis of ['updates','epoch','examplesSeen'])for(const metric of ['validationLoss','trainLoss','lrLast']){
    await page.selectOption('#axis',axis);await page.selectOption('#metric',metric)
    for(const epoch of [0,1,5,40,80]){
     await page.locator('#epoch').evaluate((e,n)=>{e.value=n;e.dispatchEvent(new Event('input',{bubbles:true}))},epoch)
     assert.equal(await page.locator('#epoch-value').textContent(),String(epoch))
     const rows=await page.locator('#rows tr').evaluateAll(rs=>rs.map(r=>[...r.cells].map(c=>c.textContent)))
     assert.deepEqual(rows,runs.map(r=>{const h=summarize(r,epoch);return[r.id,...['updates','examplesSeen','trainLoss','validationLoss','validationAccuracy','lrLast'].map(k=>fmt(h[k]))]}))
     const all=runs.flatMap(r=>seriesPoints(r,axis,metric)),maxX=Math.max(...all.map(p=>p.x)),maxY=Math.max(...all.map(p=>p.y))*1.06||1
     for(const run of runs){
      const p=seriesPoints(run,axis,metric)
      const expected=p.map(v=>`${(58+v.x/maxX*300).toFixed(3)},${(255-v.y/maxY*220).toFixed(3)}`).join(' ')
      assert.equal(await page.locator(`polyline[data-run="${run.id}"]`).getAttribute('points'),expected)
      const h=run.history[epoch],circle=page.locator(`circle[data-checkpoint="${run.id}"]`)
      assert.equal(await circle.count(),h[metric]===null?0:1)
      if(h[metric]!==null){assert.ok(Math.abs(+(await circle.getAttribute('cx'))-(58+h[axis]/maxX*300))<1e-9);assert.ok(Math.abs(+(await circle.getAttribute('cy'))-(255-h[metric]/maxY*220))<1e-9)}
     }
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
     states++;rowChecks+=rows.length
    }
   }
  }
  await page.locator('#epoch').focus();await page.locator('#epoch').press('Home');assert.equal(await page.locator('#previous').isDisabled(),true)
  await page.locator('#next').click();assert.equal(await page.locator('#epoch').inputValue(),'1')
  await page.locator('#epoch').focus();await page.locator('#epoch').press('End');assert.equal(await page.locator('#next').isDisabled(),true)
  await page.locator('summary').click();await page.locator('#provenance').focus();assert.ok(await page.locator('#provenance').evaluate(e=>e===document.activeElement))
  const region=page.locator('.scroll');await region.scrollIntoViewIfNeeded();await region.focus()
  if(width===360){await region.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle())}
  assert.ok(requests.every(p=>p.startsWith('/assets/interactive/training-dynamics/')),requests.join('\n'));page.off('request',listen)
  await page.screenshot({path:folder+'/viewer-'+width+'.png',fullPage:true});views.push({id:'viewer',width,states,rowChecks,status:'passed'})
 }
 await page.route('**/comparison.json',r=>r.fulfill({status:404,body:'missing'}));await page.goto(origin+'/assets/interactive/training-dynamics/explorer.html',{waitUntil:'networkidle'})
 assert.match(await page.locator('#status').textContent(),/No se pudieron cargar/)
 assert.equal(await page.locator('select:not([disabled]),input:not([disabled]),button:not([disabled])').count(),0)
 assert.deepEqual(errors,[])
 await writeFile(folder+'/report.json',JSON.stringify({origin,views,errors,missingReport:'explicit_error'},null,2)+'\n');console.log(folder+'/report.json')
}finally{await browser.close()}
