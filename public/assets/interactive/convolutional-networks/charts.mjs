const colors=['#38bdf8','#fb923c','#a78bfa','#4ade80']
export function color(value,lo,hi){
 const t=lo<0?(value/hi+1)/2:value/hi
 const lerp=(a,b,u)=>a.map((v,i)=>Math.round(v+(b[i]-v)*u))
 const rgb=lo<0?(t<.5?lerp([37,99,235],[241,245,249],t*2):lerp([241,245,249],[249,115,22],(t-.5)*2)):lerp([15,23,42],[56,189,248],Math.max(0,Math.min(1,t)))
 return `rgb(${rgb.join(',')})`
}
export function heatmap(matrix,{lo=0,hi=1,highlight=[],region=null}={}){
 const h=matrix.length,w=matrix[0].length,size=288
 return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Mapa numérico de ${h} filas y ${w} columnas">${matrix.flatMap((line,row)=>line.map((v,col)=>`<rect data-row="${row}" data-col="${col}" data-value="${v}" x="${col*size/w}" y="${row*size/h}" width="${size/w}" height="${size/h}" fill="${color(v,lo,hi)}" ${highlight.some(p=>p.row===row&&p.col===col)?'stroke="#f43f5e" stroke-width="3"':''}><title>Fila ${row}, columna ${col}: ${v}</title></rect>`)).join('')}${region?`<rect x="${region.col*size/w}" y="${region.row*size/h}" width="${region.width*size/w}" height="${region.height*size/h}" fill="none" stroke="#f43f5e" stroke-width="3"/>`:''}</svg>`
}
export function curve(series,title){
 const width=380,height=310,left=58,top=40,bottom=230,right=364
 const max=Math.max(...series.flatMap(s=>s.points.map(p=>p.y)),.001)*1.05
 const x=e=>left+e/40*(right-left),y=v=>bottom-v/max*(bottom-top)
 const ticks=[0,.25,.5,.75,1].map(f=>`<text x="${left-6}" y="${y(f*max)+4}" text-anchor="end">${(f*max).toFixed(2)}</text><path d="M${left},${y(f*max)}H${right}" stroke="#334155"/>`).join('')
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><rect width="100%" height="100%" fill="#0f172a"/><g font-family="sans-serif" font-size="14" fill="#e2e8f0"><text x="12" y="22">${title}</text>${ticks}${[0,10,20,30,40].map(v=>`<text x="${x(v)}" y="252" text-anchor="middle">${v}</text>`).join('')}<text x="${left}" y="276">Epoch completada · loss media</text>${series.map((s,i)=>`<polyline data-series="${s.name}" data-points="${s.points.length}" fill="none" stroke="${colors[i]}" stroke-width="2" points="${s.points.map(p=>`${x(p.x)},${y(p.y)}`).join(' ')}"/><text x="${12+i%2*186}" y="${292+Math.floor(i/2)*16}" fill="${colors[i]}">${s.name}</text>`).join('')}</g></svg>`
}
