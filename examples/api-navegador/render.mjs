const output = document.querySelector('#output')
const params = new URLSearchParams(location.search)
const value = params.get('q') ?? 'Un comentario normal'

if (params.get('mode') === 'safe') {
  output.textContent = value
} else {
  // Intencionadamente vulnerable. Solo existe en este sandbox local.
  output.innerHTML = value
}
document.body.dataset.ready = 'yes'
