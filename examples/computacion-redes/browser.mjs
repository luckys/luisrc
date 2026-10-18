window.lab = { events: [], longTasks: [], authenticated: false }
function mark(name) {
  const event = { name, time: performance.now() }
  window.lab.events.push(event)
  const item = document.createElement('li')
  item.textContent = `${name}: ${event.time.toFixed(2)} ms desde el origen temporal de navegación`
  document.querySelector('#events').append(item)
}
new PerformanceObserver((list) => {
  for (const entry of list.getEntries())
    window.lab.longTasks.push({ start: entry.startTime, duration: entry.duration })
}).observe({ type: 'longtask', buffered: true })
document.addEventListener('DOMContentLoaded', () => mark('DOMContentLoaded'))
mark('module')
queueMicrotask(() => mark('microtask'))
localStorage.setItem('lab_example', 'visible-to-js')
fetch('/api/whoami')
  .then((response) => response.json())
  .then((data) => {
    window.lab.authenticated = data.authenticated
    document.querySelector('#identity').textContent = data.authenticated
      ? 'Cookie ficticia recibida por el servidor'
      : 'Sin cookie'
    mark('fetch:response')
  })
document.querySelector('#block').addEventListener('click', () => {
  mark('busy:start')
  setTimeout(() => mark('timer'), 0)
  const start = performance.now()
  while (performance.now() - start < 80) {} // Solo para observar un bloqueo deliberado.
  mark('busy:end')
})
