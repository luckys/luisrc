import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {selectRun,checkpoint,snapshot,normalization,format as f} from '../public/assets/interactive/generalization-stability/model.mjs'
const origin=process.env.GENERALIZATION_DRAFT_ORIGIN??'http://127.0.0.1:4322'
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname))
const manifest=JSON.parse(await readFile('docs/editorial/generalization-stability-series.json'))
const data=JSON.parse(await readFile('public/assets/interactive/generalization-stability/comparison.json'))
const folder=await mkdtemp('/tmp/generalization-stability-layout.'),views=[],errors=[]
const table=async(page,id)=>page.locator('#'+id+' tr').evaluateAll(rs=>rs.map(r=>[...r.cells].map(c=>c.textContent)))
const nf=v=>Number(v).toLocaleString('es-ES',{maximumSignificantDigits:5})
const setRange=async(page,id,value)=>page.locator('#'+id).evaluate((el,n)=>{el.value=n;el.dispatchEvent(new Event('input',{bubbles:true}))},value)
async function line(page,chart,id,points,{minX=0,maxX,minY=0,maxY}){
 const expected=points.map(p=>`${(58+(p.x-minX)/(maxX-minX)*300).toFixed(3)},${(255-(p.y-minY)/(maxY-minY)*215).toFixed(3)}`).join(' ')
 assert.equal(await page.locator('#'+chart+' polyline[data-series="'+id+'"]').getAttribute('points'),expected)
}
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)))
 for(const width of [1440,360]){
  await page.setViewportSize({width,height:1000})
  for(const a of manifest.articles){
   assert.equal((await page.goto(origin+'/posts/'+a.slug,{waitUntil:'networkidle'})).status(),200)
   await page.addStyleTag({content:'astro-dev-toolbar{display:none}'})
   assert.equal((await page.locator('h1#'+a.slug).textContent()).trim(),'# '+a.title)
   assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),a.id)
   let n=0
   for(const img of await page.locator('article img[src*="/generalization-stability/"]').all()){
    await img.scrollIntoViewIfNeeded();await page.waitForFunction(e=>e.complete&&e.naturalWidth>0,await img.elementHandle())
    assert.ok((await img.boundingBox()).width<=380.1)
    if(width===360)await img.screenshot({path:folder+'/'+a.id+'-figure-'+n++ +'.png'})
   }
   for(const link of await page.locator('article a[href^="/posts/"],article a[href^="/assets/"]').all())assert.equal((await page.request.get(origin+await link.getAttribute('href'))).status(),200)
   for(const region of await page.locator('article [role="region"],article pre[tabindex="0"]').all()){
    await region.scrollIntoViewIfNeeded();await region.focus();assert.ok(await region.evaluate(e=>e===document.activeElement))
    if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+2)){await region.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle())}
   }
   if(a.id==='DL-EARLY-STOPPING'){await page.locator('iframe').scrollIntoViewIfNeeded();await page.frameLocator('iframe').locator('#seed:not([disabled])').waitFor()}
   await page.screenshot({path:folder+'/'+a.id+'-'+width+'.png',fullPage:true});views.push({id:a.id,width,status:'passed'})
  }
  const requests=[],listen=r=>requests.push(new URL(r.url()).pathname);page.on('request',listen)
  await page.goto(origin+'/assets/interactive/generalization-stability/explorer.html',{waitUntil:'networkidle'});await page.locator('#seed:not([disabled])').waitFor()
  let checkpoints=0,phases=0,layers=0,norms=0,clips=0
  for(const seed of [7,19,31])for(const variant of Object.keys(data.protocol.variants)){
   await page.selectOption('#seed',String(seed));await page.selectOption('#variant',variant)
   const r=selectRun(data,seed,variant)
   assert.equal(+(await page.locator('#checkpoint').getAttribute('max')),r.history.length-1)
   for(const index of new Set([0,r.history.findIndex(h=>h.epoch===r.best.epoch),r.history.length-1])){
    await setRange(page,'checkpoint',index);const h=checkpoint(r,index)
    assert.equal(await page.locator('#epoch-value').textContent(),String(h.epoch))
    assert.deepEqual(await table(page,'metrics'),[['Epoch / updates',f(h.epoch)],['Train MSE',f(h.trainMse)],['Validation MSE',f(h.validationMse)],['Loss online del último update',f(h.onlineMseLast)],['Norma del gradiente de ese update',f(h.gradientNormLast)],['Norma total de parámetros',f(h.parameterNorm)],['Parámetros escalares',String(r.parameterCount)]])
    const maxY=Math.max(...r.history.flatMap(h=>[h.trainMse,h.validationMse]))*1.05
    for(const[id,key]of [['train','trainMse'],['validation','validationMse']])await line(page,'curves',id,r.history.map(h=>({x:h.epoch,y:h[key]})),{maxX:r.last.epoch,maxY})
    checkpoints++
   }
   assert.deepEqual(await table(page,'snapshots'),[['Último',f(r.last.epoch),f(r.last.trainMse),f(r.last.validationMse)],['Mejor observado',f(r.best.epoch),f(r.best.trainMse),f(r.best.validationMse)],['Elegido',f(r.selected.epoch),f(r.selected.trainMse),f(r.selected.validationMse)]])
   for(const phase of ['initial','best','last','selected']){
    await page.selectOption('#phase',phase);const h=snapshot(r,phase),bound=Math.ceil(Math.max(...data.data.y.map(Math.abs),...['initial','last','best','selected'].flatMap(k=>r[k].prediction.map(Math.abs)),1)*1.1)
    for(const[id,ys]of [['signal',data.data.truth],['prediction',h.prediction]])await line(page,'fit',id,data.data.grid.map((x,i)=>({x,y:ys[i]})),{minX:-1,maxX:1,minY:-bound,maxY:bound})
    assert.equal(await page.locator('#fit [data-sample]').count(),24)
    assert.equal(await page.locator('#fit [data-sample="8"]').getAttribute('fill'),'#fb7185')
    phases++
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  }
  for(const summary of await page.locator('summary').all())await summary.click()
  for(const degree of [1,5,15]){
   await page.selectOption('#degree',String(degree));const r=data.biasVariance.models.find(r=>r.degree===degree)
   assert.deepEqual(await table(page,'bias-values'),[['Bias² del conjunto finito',f(r.biasSquared)],['Variance del conjunto finito',f(r.variance)],['Error contra la señal',f(r.cleanRisk)],['Ruido esperado del generador',f(r.knownNoiseVariance)]])
  }
  for(const scheme of data.initialization){
   await page.selectOption('#scheme',scheme.id)
   for(const metric of ['secondMoment','gradientNorm','saturationFraction']){
    await page.selectOption('#init-metric',metric)
    const maxY=Math.max(...data.initialization.flatMap(s=>s.layers.map(l=>l[metric]).filter(v=>v!==null)),.001)*1.05
    for(let i=0;i<8;i++){
     await setRange(page,'layer',i);const l=scheme.layers[i]
     assert.deepEqual(await table(page,'initialization-values'),[['Capa',String(i+1)],['Varianza',f(l.variance)],['Segundo momento',f(l.secondMoment)],['Norma de gradientes de weights',f(l.gradientNorm)],['Fracción de ceros',f(l.zeroFraction)],['Fracción de tanh saturada',f(l.saturationFraction)],['Norma de gradiente respecto a inputs',f(scheme.inputGradientNorm)]])
     for(const other of data.initialization)await line(page,'initialization-chart',other.id,other.layers.flatMap((l,j)=>l[metric]===null?[]:[{x:j+1,y:l[metric]}]),{minX:1,maxX:8,maxY})
     assert.equal(await page.locator('#initialization-chart [data-mark="layer"]').count(),l[metric]===null?0:1)
     layers++
    }
   }
  }
  for(const a of data.activations.functions){
   await page.selectOption('#activation',a.id)
   assert.deepEqual(await table(page,'activation-values'),a.input.map((x,i)=>[f(x),f(a.output[i]),f(a.gradient[i])]))
  }
  for(const kind of ['batch','layer'])for(const context of ['A','B']){
   await page.selectOption('#normalization',kind);await page.selectOption('#context',context)
   const n=normalization(data,kind,context)
   assert.deepEqual(await table(page,'norm-input'),n.input.map((row,i)=>[String(i),...row.map(nf)]))
   assert.deepEqual(await table(page,'norm-output'),n.output.map((row,i)=>[String(i),...row.map(nf)]));norms++
  }
  for(const clip of data.clipping.curves){
   await page.selectOption('#clip-kind',clip.id)
   assert.equal(+(await page.locator('#clip-step').getAttribute('max')),clip.history.length-1)
   for(const index of [0,Math.floor((clip.history.length-1)/2),clip.history.length-1]){
    await setRange(page,'clip-step',index);const c=clip.history[index]
    assert.deepEqual(await table(page,'clip-values'),[['Step',String(c.step)],['Theta antes del update',f(c.theta)],['MSE antes del update',f(c.loss)],['Norma de gradiente previa',f(c.gradientBefore)],['Norma posterior al recorte',f(c.gradientAfter)],['Norma del desplazamiento',f(c.stepNorm)]])
    const maxY=Math.max(...data.clipping.curves.flatMap(c=>c.history.map(h=>Math.log10(1+h.loss))))*1.05
    for(const other of data.clipping.curves)await line(page,'clipping-chart',other.id,other.history.map(h=>({x:h.step,y:Math.log10(1+h.loss)})),{maxX:40,maxY})
    clips++
   }
  }
  await page.locator('#checkpoint').focus();await page.locator('#checkpoint').press('Home');assert.equal(await page.locator('#previous').isDisabled(),true)
  await page.locator('#next').click();assert.equal(await page.locator('#checkpoint').inputValue(),'1')
  await page.locator('#checkpoint').focus();await page.locator('#checkpoint').press('End');assert.equal(await page.locator('#next').isDisabled(),true)
  await page.locator('#provenance').focus();assert.ok(await page.locator('#provenance').evaluate(e=>e===document.activeElement))
  if(width===360){const region=page.locator('[aria-label="Último, mejor y elegido"]');await region.scrollIntoViewIfNeeded();await region.focus();await region.press('ArrowRight');await page.waitForFunction(e=>e.scrollLeft>0,await region.elementHandle())}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  assert.ok(requests.every(p=>p.startsWith('/assets/interactive/generalization-stability/')),requests.join('\n'));page.off('request',listen)
  await page.screenshot({path:folder+'/viewer-'+width+'.png',fullPage:true});views.push({id:'viewer',width,checkpoints,phases,layers,norms,clips,status:'passed'})
 }
 await page.route('**/comparison.json',r=>r.fulfill({status:404,body:'missing'}));await page.goto(origin+'/assets/interactive/generalization-stability/explorer.html',{waitUntil:'networkidle'})
 assert.match(await page.locator('#status').textContent(),/No se pudieron cargar/);assert.equal(await page.locator('select:not([disabled]),input:not([disabled]),button:not([disabled])').count(),0)
 assert.deepEqual(errors,[]);await writeFile(folder+'/report.json',JSON.stringify({origin,views,errors,missingReport:'explicit_error'},null,2)+'\n');console.log(folder+'/report.json')
}finally{await browser.close()}
