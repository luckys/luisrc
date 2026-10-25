import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { estimate, simulate } from '../public/assets/interactive/capacity-costs/model.mjs'
import { chart } from '../public/assets/interactive/capacity-costs/chart.mjs'
const origin=process.env.CAPACITY_DRAFT_ORIGIN??'http://127.0.0.1:4322'
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname))
const manifest=JSON.parse(await readFile('docs/editorial/capacity-costs-series.json'))
const data=JSON.parse(await readFile('public/assets/interactive/capacity-costs/comparison.json'))
const folder=await mkdtemp('/tmp/capacity-costs-layout.'),report=[],errors=[]
const usd=v=>v===null?'No definido (denominador cero)':(BigInt(v)/1000000n)+','+(BigInt(v)%1000000n).toString().padStart(6,'0')+' USD'
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
   for(const img of await page.locator('article img[src*="/capacity-costs/"]').all()){
    await img.scrollIntoViewIfNeeded();await page.waitForFunction(e=>e.complete&&e.naturalWidth>0,await img.elementHandle())
    if(width===360)await page.screenshot({path:folder+'/'+a.id+'-diagram-'+(await img.getAttribute('src')).split('/').at(-1)+'.png'})
   }
   for(const l of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all())assert.equal((await page.request.get(origin+await l.getAttribute('href'))).status(),200)
   for(const region of await page.locator('article [role="region"],article pre[tabindex="0"]').all()){
    await region.scrollIntoViewIfNeeded();await region.focus();assert.ok(await region.evaluate(e=>document.activeElement===e))
   }
   if(a.id==='CAP-ESTIMATES'){
    await page.locator('iframe').scrollIntoViewIfNeeded();await page.frameLocator('iframe').locator('#profile:not([disabled])').waitFor()
   }
   await page.screenshot({path:folder+'/'+a.id+'-'+width+'.png',fullPage:true})
   report.push({id:a.id,width,status:'passed'})
  }
  const requests=[]
  const listener=req=>requests.push(new URL(req.url()).pathname)
  page.on('request',listener)
  await page.goto(origin+'/assets/interactive/capacity-costs/explorer.html',{waitUntil:'networkidle'})
  await page.locator('#profile:not([disabled])').waitFor()
  let combinations=0
  for(const profile of data.input.profiles){
   await page.selectOption('#profile',profile.id)
   for(const cpu of [10,30]){
    const range=page.locator('#cpu');await range.focus();await range.press('Home')
    for(let value=5;value<cpu;value+=5)await range.press('ArrowRight')
    for(const bytes of [10000,100000]){
     await page.selectOption('#payload',String(bytes))
     for(const success of [9990,0]){
      await page.selectOption('#success',String(success))
      const r=estimate(profile.segments,{...data.input.shape,cpuMs:cpu},data.input.rates,{...data.input.pricing,bytesPerRequest:bytes,successBps:success})
      const cells=await page.locator('#costs tr').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.cells[0].textContent,row.cells[1].textContent])))
      assert.equal(cells['Peticiones ofrecidas'],String(r.requests));assert.equal(cells['Subtotal parcial'],usd(r.subtotal))
      assert.equal(cells['Por millón buenas asumidas'],usd(r.perMillionGood))
      assert.equal((await page.locator('#scope').textContent()).startsWith('INVIABLE'),!r.feasibleCpuModel)
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));combinations++
     }
    }
   }
  }
  await page.selectOption('#profile','steady');await page.selectOption('#payload','10000');await page.selectOption('#success','9990')
  await page.locator('#cpu').focus();await page.locator('#cpu').press('Home');await page.locator('#cpu').press('ArrowRight')
  await page.locator('#latency').focus();await page.locator('#latency').press('End');assert.match(await page.locator('#little').textContent(),/100 peticiones/)
  for(const mode of ['reactive','prewarmed','slowDatabase']){
   await page.selectOption('#trace',mode)
   const policy={...data.input.shape,...data.input.policy,...(mode==='prewarmed'?{min:6}:{}),...(mode==='slowDatabase'?{dbRps:200}:{})}
   const rows=simulate(policy), range=page.locator('#sample');await range.focus();await range.press('Home')
   for(let i=0;i<60;i++){
    if(i)await range.press('ArrowRight')
    const cells=await page.locator('#snapshot tr').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.cells[0].textContent,row.cells[1].textContent])))
    for(const [label,key]of Object.entries({'Demanda RPS':'rps','Techo RPS':'capacityRps','Réplicas listas':'ready','Objetivo calculado':'desired','Cola al final':'queue','Llegadas acumuladas':'arrived','Servidas acumuladas':'served','Rechazadas acumuladas':'rejected'}))assert.equal(cells[label],String(rows[i][key]),`${mode}/${i}/${label}`)
    for(const id of ['demand-line','capacity-line'])assert.equal(await page.locator('#'+id).getAttribute('points'),chart(rows,i).match(new RegExp('id="'+id+'" points="([^"]+)"'))[1])
    assert.equal(await page.locator('#cursor').getAttribute('d'),chart(rows,i).match(/id="cursor" d="([^"]+)"/)[1])
   }
   assert.equal(await page.locator('#next').isDisabled(),true)
   await page.locator('#previous').click();assert.equal(await page.locator('#sample').inputValue(),'58')
  }
  await page.selectOption('#trace','reactive');await page.locator('#startup').focus();await page.locator('#startup').press('Home')
  assert.equal(JSON.parse(await page.locator('#facts').textContent()).simulation.final.rejected,0)
  await page.locator('#sample').focus();await page.locator('#sample').press('Home');assert.equal(await page.locator('#previous').isDisabled(),true)
  await page.locator('#next').click();assert.equal(await page.locator('#sample').inputValue(),'1')
  assert.ok(requests.every(p=>p.startsWith('/assets/interactive/capacity-costs/')),requests.join('\n'))
  page.off('request',listener)
  await page.screenshot({path:folder+'/viewer-'+width+'.png',fullPage:true})
  await page.locator('#trace-title').scrollIntoViewIfNeeded();await page.screenshot({path:folder+'/viewer-trace-'+width+'.png'})
  report.push({id:'viewer',width,monthlyCombinations:combinations,traceSelections:180,status:'passed'})
 }
 await page.route('**/comparison.json',route=>route.fulfill({status:404,body:'missing'}))
 await page.goto(origin+'/assets/interactive/capacity-costs/explorer.html',{waitUntil:'networkidle'})
 assert.equal(await page.locator('#error').isVisible(),true);assert.match(await page.locator('#error').textContent(),/No se ha podido calcular/)
 assert.equal(await page.locator('select:not([disabled]),input:not([disabled]),button:not([disabled])').count(),0)
 assert.deepEqual(errors,[])
 await writeFile(folder+'/report.json',JSON.stringify({origin,views:report,missingReport:'explicit_error',errors},null,2)+'\n')
 console.log(folder+'/report.json')
}finally{await browser.close()}
