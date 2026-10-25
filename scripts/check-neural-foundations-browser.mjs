import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp}from'node:fs/promises'
import{chromium}from'@playwright/test'
import{infer,activation}from'../public/assets/interactive/neural-foundations/inference.mjs'
import{lossChart}from'../public/assets/interactive/neural-foundations/charts.mjs'
const origin=process.env.NEURAL_DRAFT_ORIGIN??'http://127.0.0.1:4322'
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname))
const manifest=JSON.parse(await readFile('docs/editorial/neural-foundations-series.json'))
const data=JSON.parse(await readFile('public/assets/interactive/neural-foundations/training.json'))
const folder=await mkdtemp('/tmp/neural-foundations-layout.'),report=[],errors=[]
const f=v=>Number(v).toFixed(6)
const color=v=>{const t=Math.max(0,Math.min(1,v));return `rgb(${Math.round(30+164*t)},${Math.round(58+7*t)},${Math.round(138-126*t)})`}
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)))
 for(const width of [1440,360]){
  await page.setViewportSize({width,height:1000})
  for(const a of manifest.articles){
   assert.equal((await page.goto(origin+'/posts/'+a.slug,{waitUntil:'networkidle'})).status(),200)
   assert.equal((await page.locator('h1#'+a.slug).textContent()).trim(),'# '+a.title)
   assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),a.id+'@'+width)
   for(const img of await page.locator('article img[src*="/neural-foundations/"]').all()){
    await img.scrollIntoViewIfNeeded();await page.waitForFunction(e=>e.complete&&e.naturalWidth>0,await img.elementHandle())
    if(width===360)await page.screenshot({path:folder+'/'+a.id+'-image-'+(await img.getAttribute('src')).split('/').at(-1)+'.png'})
   }
   for(const l of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all())assert.equal((await page.request.get(origin+await l.getAttribute('href'))).status(),200)
   for(const region of await page.locator('article [role="region"],article pre[tabindex="0"]').all()){
    await region.scrollIntoViewIfNeeded();await region.focus();assert.ok(await region.evaluate(e=>document.activeElement===e))
    if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+2)){
     await region.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle());await region.evaluate(e=>e.scrollTo({left:0,behavior:'instant'}))
    }
   }
   if(a.id==='DL-XOR'){await page.locator('iframe').scrollIntoViewIfNeeded();await page.frameLocator('iframe').locator('#case:not([disabled])').waitFor()}
   await page.screenshot({path:folder+'/'+a.id+'-'+width+'.png',fullPage:true})
   report.push({id:a.id,width,status:'passed'})
  }
  const requests=[],listener=req=>requests.push(new URL(req.url()).pathname);page.on('request',listener)
  await page.goto(origin+'/assets/interactive/neural-foundations/explorer.html',{waitUntil:'networkidle'})
  await page.locator('#case:not([disabled])').waitFor()
  for(const c of data.results.cases){
   await page.selectOption('#case',c.id)
   const range=page.locator('#epoch');await range.focus();await range.press('Home')
   for(let index=0;index<21;index++){
    if(index)await range.press('ArrowRight')
    const h=c.history[index],cells=await page.locator('#metrics tr').evaluateAll(rs=>Object.fromEntries(rs.map(r=>[r.cells[0].textContent,r.cells[1].textContent])))
    assert.equal(await page.locator('#epoch-value').textContent(),String(h.epoch))
    for(const[label,key]of Object.entries({'Loss train':'trainLoss','Loss validation':'validationLoss','Accuracy train':'trainAccuracy','Accuracy validation':'validationAccuracy'}))assert.equal(cells[label],f(h[key]))
    assert.equal(cells['Test al final'],index===20?f(c.test.accuracy):'No se evalúa en este checkpoint')
    for(const key of ['trainLoss','validationLoss'])assert.equal(await page.locator('#'+key).getAttribute('points'),lossChart(data.results.cases,c,index).match(new RegExp('id="'+key+'" points="([^"]+)"'))[1])
    const fill=await page.locator('#map rect[data-cell]').evaluateAll(es=>es.map(e=>e.getAttribute('fill')))
    assert.deepEqual(fill,data.results.grid.points.map(p=>color(infer(p,h.layers).probability)))
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   }
   assert.equal(await page.locator('#next').isDisabled(),true)
   for(let i=0;i<8;i++){
    await page.selectOption('#probe',String(i));const p=infer(data.protocol.probePoints[i],c.history.at(-1).layers)
    const cells=await page.locator('#prediction tr').evaluateAll(rs=>Object.fromEntries(rs.map(r=>[r.cells[0].textContent,r.cells[1].textContent])))
    assert.equal(cells['Logit'],f(p.logit));assert.equal(cells['p(y=1)'],f(p.probability))
   }
   if(c.width){
    await page.selectOption('#view','hidden')
    for(let unit=0;unit<4;unit++){
     await page.selectOption('#unit',String(unit))
     const fill=await page.locator('#map rect[data-cell]').evaluateAll(es=>es.map(e=>e.getAttribute('fill')))
     assert.deepEqual(fill,data.results.grid.points.map(p=>color((infer(p,c.history.at(-1).layers).hidden[unit]+1)/2)))
    }
    await page.selectOption('#view','probability')
   }else assert.equal(await page.locator('#view').isDisabled(),true)
   await page.locator('#previous').click();assert.equal(await page.locator('#epoch').inputValue(),'19')
  }
  for(const kind of ['tanh','sigmoid','relu']){
   await page.selectOption('#activation',kind)
   const range=page.locator('#input');await range.focus();await range.press('Home')
   for(let i=0;i<=100;i++){
    if(i)await range.press('ArrowRight')
    const x=+await range.inputValue();assert.equal(await page.locator('#activation-value').textContent(),`${kind}(${x}) = ${f(activation(kind,x))}`)
   }
  }
  await page.selectOption('#case','mlp-7');await page.locator('#epoch').focus();await page.locator('#epoch').press('Home');assert.equal(await page.locator('#previous').isDisabled(),true)
  await page.locator('#next').click();assert.equal(await page.locator('#epoch').inputValue(),'1')
  await page.locator('summary').click();await page.locator('#facts').focus();assert.ok(await page.locator('#facts').evaluate(e=>document.activeElement===e))
  assert.ok(requests.every(p=>p.startsWith('/assets/interactive/neural-foundations/')),requests.join('\n'));page.off('request',listener)
  await page.screenshot({path:folder+'/viewer-'+width+'.png',fullPage:true})
  report.push({id:'viewer',width,checkpoints:105,hiddenMaps:16,probes:40,activationSelections:303,status:'passed'})
 }
 await page.route('**/training.json',r=>r.fulfill({status:404,body:'missing'}));await page.goto(origin+'/assets/interactive/neural-foundations/explorer.html',{waitUntil:'networkidle'})
 assert.equal(await page.locator('#error').isVisible(),true);assert.equal(await page.locator('select:not([disabled]),input:not([disabled]),button:not([disabled])').count(),0)
 assert.deepEqual(errors,[])
 await writeFile(folder+'/report.json',JSON.stringify({origin,views:report,missingReport:'explicit_error',errors},null,2)+'\n');console.log(folder+'/report.json')
}finally{await browser.close()}
