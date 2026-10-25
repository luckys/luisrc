import assert from'node:assert/strict'
import{readFile,writeFile,mkdtemp}from'node:fs/promises'
import{chromium}from'@playwright/test'
import{scalarTrace,scalarStep,comparisonVector,formatNumber as f,methodNames}from'../public/assets/interactive/autodiff-foundations/model.mjs'
import{errorChart}from'../public/assets/interactive/autodiff-foundations/charts.mjs'
const origin=process.env.AUTODIFF_DRAFT_ORIGIN??'http://127.0.0.1:4322'
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname))
const manifest=JSON.parse(await readFile('docs/editorial/autodiff-foundations-series.json'))
const data=JSON.parse(await readFile('public/assets/interactive/autodiff-foundations/comparison.json'))
const folder=await mkdtemp('/tmp/autodiff-foundations-layout.'),views=[],errors=[]
const browser=await chromium.launch({headless:true})
const names={w:'w',x:'x',q:'q = w × x',r:'r = q + q',loss:'L = r²',dr:'dL/dr',dqLeft:'Contribución de q por uso izquierdo',dqRight:'Contribución de q por uso derecho',dq:'dL/dq, suma de caminos',dw:'dL/dw',dx:'dL/dx'}
const table=async(page,id)=>page.locator('#'+id+' tr').evaluateAll(rs=>Object.fromEntries(rs.map(r=>[r.cells[0].textContent,r.cells[1].textContent])))
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)))
 for(const width of [1440,360]){
  await page.setViewportSize({width,height:1000})
  for(const a of manifest.articles){
   assert.equal((await page.goto(origin+'/posts/'+a.slug,{waitUntil:'networkidle'})).status(),200)
   assert.equal((await page.locator('h1#'+a.slug).textContent()).trim(),'# '+a.title)
   assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),a.id+'@'+width)
   for(const img of await page.locator('article img[src*="/autodiff-foundations/"]').all()){
    await img.scrollIntoViewIfNeeded();await page.waitForFunction(e=>e.complete&&e.naturalWidth>0,await img.elementHandle())
    if(width===360)await page.screenshot({path:folder+'/'+a.id+'-image-'+(await img.getAttribute('src')).split('/').at(-1)+'.png'})
   }
   for(const l of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all())assert.equal((await page.request.get(origin+await l.getAttribute('href'))).status(),200)
   for(const region of await page.locator('article [role="region"],article pre[tabindex="0"]').all()){
    await region.scrollIntoViewIfNeeded();await region.focus();assert.ok(await region.evaluate(e=>document.activeElement===e))
    if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+2)){await region.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle());await region.evaluate(e=>e.scrollTo({left:0,behavior:'instant'}))}
   }
   if(a.id==='DL-GRADCHECK'){await page.locator('iframe').scrollIntoViewIfNeeded();await page.frameLocator('iframe').locator('#case:not([disabled])').waitFor()}
   await page.screenshot({path:folder+'/'+a.id+'-'+width+'.png',fullPage:true})
   views.push({id:a.id,width,status:'passed'})
  }
  const requests=[],listener=req=>requests.push(new URL(req.url()).pathname);page.on('request',listener)
  await page.goto(origin+'/assets/interactive/autodiff-foundations/explorer.html',{waitUntil:'networkidle'});await page.locator('#case:not([disabled])').waitFor()
  for(const item of data.scalarCases){
   for(const[id,step]of[['w',.25],['x',.5]]){const range=page.locator('#'+id);await range.focus();await range.press('Home');for(let i=0;i<Math.round((item.input[id]+3)/step);i++)await range.press('ArrowRight')}
   const t=scalarTrace(item.input.w,item.input.x),range=page.locator('#stage');await range.focus();await range.press('Home')
   for(let stage=0;stage<=6;stage++){
    if(stage)await range.press('ArrowRight')
    assert.deepEqual(await table(page,'scalar'),Object.fromEntries(Object.entries(scalarStep(t,stage)).map(([k,v])=>[names[k],f(v)])))
   }
   assert.equal(await page.locator('#next').isDisabled(),true);await page.locator('#previous').click();assert.equal((await table(page,'scalar'))['dL/dw'],undefined)
  }
  let combinations=0,parameters=0
  for(const[caseIndex,c]of data.cases.entries()){
   await page.selectOption('#case',c.id)
   for(let ei=0;ei<7;ei++){
    await page.selectOption('#epsilon',String(ei))
    const summary=await table(page,'summary'),finite=c.finite[ei]
    assert.equal(summary['Error máximo FD/manual'],f(finite.maxAbsError));assert.equal(summary['Error máximo manual/PyTorch'],f(c.maxTorchError))
    assert.equal((await page.locator('#agreement').textContent()).startsWith('Diferencias finitas aceptadas'),finite.passes)
    const expected=errorChart(data,caseIndex,ei)
    for(const id of ['error-0','error-1','error-2'])assert.equal(await page.locator('#'+id).getAttribute('points'),expected.match(new RegExp('id="'+id+'" points="([^"]+)"'))[1])
    assert.equal(await page.locator('#error-cursor').getAttribute('cx'),expected.match(/id="error-cursor" cx="([^"]+)"/)[1])
    for(const method of Object.keys(methodNames)){
     await page.selectOption('#method',method)
     const comparison=comparisonVector(c,method,ei)
     const max=Math.max(...data.cases.flatMap(o=>[...o.manual,...comparisonVector(o,method,ei)]).filter(Number.isFinite).map(Math.abs),1e-12)
     const bars=await page.locator('#gradient-chart rect[data-parameter]').evaluateAll(es=>es.map(e=>({i:+e.dataset.parameter,series:+e.dataset.series,x:e.getAttribute('x'),width:e.getAttribute('width')})))
     assert.equal(bars.length,34-comparison.filter(v=>v===null).length)
     for(const bar of bars){const v=bar.series?comparison[bar.i]:c.manual[bar.i],length=123*Math.abs(v)/max;assert.equal(bar.width,length.toFixed(2));assert.equal(bar.x,(v<0?221-length:221).toFixed(2))}
     assert.equal(await page.locator('#gradient-chart text').filter({hasText:/^None$/}).count(),comparison.filter(v=>v===null).length)
     const cells=await table(page,'parameter-values'),pi=+await page.locator('#parameter').inputValue()
     assert.equal(cells[methodNames[method]],f(comparison[pi]));combinations++
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    }
   }
   await page.selectOption('#epsilon','2')
   for(const method of Object.keys(methodNames)){
    await page.selectOption('#method',method);const vector=comparisonVector(c,method,2)
    for(let i=0;i<17;i++){
     await page.selectOption('#parameter',String(i));const cells=await table(page,'parameter-values')
     assert.equal(cells['Nombre'],c.names[i]);assert.equal(cells['Manual NumPy'],f(c.manual[i]));assert.equal(cells['PyTorch autograd'],f(c.torch[i]));assert.equal(cells[methodNames[method]],f(vector[i]));parameters++
    }
   }
   const checks=await table(page,'checks');assert.equal(checks['Hojas con gradiente en ese mismo paso'],'true');assert.equal(checks['Hidden sin retain_grad después de backward'],'None')
  }
  await page.locator('#stage').focus();await page.locator('#stage').press('Home');assert.equal(await page.locator('#previous').isDisabled(),true)
  await page.locator('#next').click();assert.equal(await page.locator('#stage').inputValue(),'1')
  await page.locator('summary').click();await page.locator('#facts').focus();assert.ok(await page.locator('#facts').evaluate(e=>document.activeElement===e))
  assert.ok(requests.every(p=>p.startsWith('/assets/interactive/autodiff-foundations/')),requests.join('\n'));page.off('request',listener)
  await page.screenshot({path:folder+'/viewer-'+width+'.png',fullPage:true});views.push({id:'viewer',width,scalarStages:28,comparisons:combinations,parameterSelections:parameters,status:'passed'})
 }
 await page.route('**/comparison.json',r=>r.fulfill({status:404,body:'missing'}));await page.goto(origin+'/assets/interactive/autodiff-foundations/explorer.html',{waitUntil:'networkidle'})
 assert.equal(await page.locator('#error').isVisible(),true);assert.equal(await page.locator('select:not([disabled]),input:not([disabled]),button:not([disabled])').count(),0);assert.deepEqual(errors,[])
 await writeFile(folder+'/report.json',JSON.stringify({origin,views,missingReport:'explicit_error',errors},null,2)+'\n');console.log(folder+'/report.json')
}finally{await browser.close()}
