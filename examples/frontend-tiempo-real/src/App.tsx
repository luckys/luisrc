import { useEffect, useMemo, useRef, useState } from 'react'
import { LatestRequest, optimisticRename, type Order } from './state.ts'
import { windowRange, acceptEvent } from './data.ts'
import { ActionButton, DeliveryTable } from './components.tsx'
import { connectNote } from './collaboration.ts'
import { startLoopback } from './media.ts'

export type View =
  | 'orders'
  | 'search'
  | 'performance'
  | 'table'
  | 'components'
  | 'events'
  | 'note'
  | 'media'
export const views: View[] = [
  'orders',
  'search',
  'performance',
  'table',
  'components',
  'events',
  'note',
  'media',
]
export const initialOrder: Order = { id: 'o1', name: 'Pedido original', version: 1 }

export function App({ view, seed }: { view: View; seed: Order }) {
  return (
    <>
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <header>
        <p>Laboratorio: Frontend y tiempo real</p>
        <nav aria-label="Experimentos">
          {views.map((item) => (
            <a
              key={item}
              href={`/?view=${item}`}
              aria-current={view === item ? 'page' : undefined}
            >
              {item}
            </a>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <h1>Interfaces que explican lo que ocurre</h1>
        {view === 'orders' && <OrderEditor seed={seed} />}
        {view === 'search' && <Search />}
        {view === 'performance' && <VirtualList />}
        {view === 'table' && <PagedTable />}
        {view === 'components' && <ComponentCases />}
        {view === 'events' && <Events />}
        {view === 'note' && <Note />}
        {view === 'media' && <Media />}
      </main>
    </>
  )
}

function OrderEditor({ seed }: { seed: Order }) {
  const [order, setOrder] = useState(seed)
  const current = useRef(seed)
  const [name, setName] = useState(seed.name)
  const [pending, setPending] = useState(false)
  const [fail, setFail] = useState(false)
  const [message, setMessage] = useState('Sin cambios')
  const set = (value: Order) => {
    current.current = value
    setOrder(value)
  }
  return (
    <section aria-labelledby="order-title">
      <h2 id="order-title">Editar pedido</h2>
      <p>
        Nombre visible: <strong data-testid="order-name">{order.name}</strong>
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (pending) return
          setPending(true)
          setMessage('Guardando cambios')
          try {
            await optimisticRename(
              () => current.current,
              set,
              name,
              async (value) => {
                const response = await fetch('/api/order', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...value, fail }),
                })
                if (!response.ok)
                  throw new Error(
                    'No se pudo guardar. Se ha restaurado el nombre anterior.',
                  )
                return response.json()
              },
            )
            setMessage('Cambios guardados')
          } catch (error) {
            setMessage((error as Error).message)
          } finally {
            setPending(false)
          }
        }}
      >
        <label htmlFor="name">Nombre del pedido</label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
        />
        <label>
          <input
            type="checkbox"
            checked={fail}
            onChange={(event) => setFail(event.target.checked)}
          />
          Simular rechazo
        </label>
        <ActionButton type="submit" pending={pending}>
          Guardar
        </ActionButton>
      </form>
      <p role="status">{message}</p>
    </section>
  )
}

function Search() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<string[]>([])
  const [message, setMessage] = useState('Escribe una búsqueda')
  const request = useMemo(() => new LatestRequest<string[]>(), [])
  useEffect(() => {
    if (!query.trim()) {
      request.cancel()
      setResult([])
      setMessage('Escribe una búsqueda')
      return
    }
    setMessage('Buscando')
    void request
      .run(
        async (signal) => {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
            signal,
          })
          if (!response.ok) throw new Error('No se pudo buscar')
          return response.json()
        },
        (rows) => {
          setResult(rows)
          setMessage(`${rows.length} resultados`)
        },
      )
      .catch(() => setMessage('No se pudo buscar'))
    return () => request.cancel()
  }, [query, request])
  return (
    <section>
      <h2>Búsqueda</h2>
      <label htmlFor="query">Buscar entregas</label>
      <input
        id="query"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p role="status">{message}</p>
      <ul>
        {result.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </section>
  )
}

function VirtualList() {
  const [scrollTop, setScrollTop] = useState(0)
  const range = windowRange(100000, scrollTop, 320, 32, 2)
  const visible = Array.from({ length: range.end - range.start }, (_, offset) => {
    const index = range.start + offset + 1
    return { id: `d${index}`, name: `Entrega ${index}` }
  })
  return (
    <section>
      <h2>100.000 entregas, una ventana pequeña</h2>
      <p>
        Para recorrer o buscar todos los registros con teclado, usa la{' '}
        <a href="/?view=table">vista paginada</a>.
      </p>
      <div
        className="viewport"
        tabIndex={0}
        role="region"
        aria-label="Vista virtual de entregas"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: 100000 * 32, position: 'relative' }}>
          <ol
            style={{ position: 'absolute', top: range.start * 32 }}
            start={range.start + 1}
          >
            {visible.map((row) => (
              <li className="virtual-row" key={row.id}>
                {row.name}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p role="status">Filas montadas: {range.end - range.start}</p>
    </section>
  )
}

function PagedTable() {
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    void fetch(`/api/deliveries?page=${page}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('fetch')
        const rows = await response.json()
        if (!controller.signal.aborted) {
          setRows(rows)
          setLoading(false)
          if (page > 0) title.current?.focus()
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
          setFailed(true)
        }
      })
    return () => controller.abort()
  }, [page])
  return (
    <section>
      <h2 ref={title} tabIndex={-1}>
        Página {page + 1}
      </h2>
      <p role="status">
        {loading
          ? 'Cargando página'
          : failed
            ? 'No se pudo cargar'
            : `${rows.length} entregas`}
      </p>
      {!loading && !failed && <DeliveryTable rows={rows} />}
      <ActionButton disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>
        Anterior
      </ActionButton>
      <ActionButton disabled={page === 4999 || loading} onClick={() => setPage(page + 1)}>
        Siguiente
      </ActionButton>
    </section>
  )
}

function ComponentCases() {
  return (
    <section>
      <h2>Estados del componente</h2>
      <ActionButton>Normal</ActionButton>
      <ActionButton pending>Guardar</ActionButton>
      <ActionButton disabled>Sin permiso</ActionButton>
      <DeliveryTable rows={[]} />
      <DeliveryTable
        rows={[
          {
            id: 'd1',
            name: 'Una descripción larga que puede ocupar varias líneas en una pantalla pequeña',
          },
        ]}
      />
    </section>
  )
}

function Events() {
  const [sequence, setSequence] = useState(0)
  const [connected, setConnected] = useState(true)
  const [message, setMessage] = useState('Conectando')
  const cursor = useRef(0)
  useEffect(() => {
    if (!connected) {
      setMessage('Desconectado')
      return
    }
    const source = new EventSource(`/events?after=${cursor.current}`)
    const reset = (event: MessageEvent) => {
      cursor.current = Number(event.lastEventId)
      setSequence(cursor.current)
      setMessage('Snapshot recuperado')
    }
    source.addEventListener('reset', reset)
    source.onmessage = (event) => {
      const next = Number(event.lastEventId)
      const action = acceptEvent(cursor.current, next)
      if (action === 'duplicate') return
      if (action === 'resync') {
        source.close()
        setMessage('Hueco detectado: reconecta para obtener snapshot')
        return
      }
      cursor.current = next
      setSequence(next)
      setMessage('Sincronizado')
    }
    source.onerror = () => setMessage('Reconectando')
    return () => source.close()
  }, [connected])
  return (
    <section>
      <h2>Eventos SSE</h2>
      <p>
        Secuencia aplicada: <output>{sequence}</output>
      </p>
      <p role="status">{message}</p>
      <ActionButton onClick={() => setConnected(!connected)}>
        {connected ? 'Desconectar' : 'Reconectar'}
      </ActionButton>
      <ActionButton
        onClick={() => {
          void fetch('/api/event', { method: 'POST' })
        }}
      >
        Generar evento
      </ActionButton>
    </section>
  )
}

function Note() {
  const [text, setText] = useState('')
  const [value, setValue] = useState('')
  const [online, setOnline] = useState(true)
  const connection = useRef<ReturnType<typeof connectNote> | null>(null)
  useEffect(() => {
    connection.current = connectNote(setText)
    return () => connection.current?.close()
  }, [])
  return (
    <section>
      <h2>Nota compartida entre pestañas</h2>
      <p>Esta demo añade fragmentos; no es un editor de texto completo.</p>
      <label htmlFor="fragment">Fragmento</label>
      <input
        id="fragment"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <ActionButton
        onClick={() => {
          connection.current?.append(value)
          setValue('')
        }}
      >
        Añadir
      </ActionButton>
      <ActionButton
        onClick={() => {
          connection.current?.setOnline(!online)
          setOnline(!online)
        }}
      >
        {online ? 'Desconectar nota' : 'Reconectar nota'}
      </ActionButton>
      <pre data-testid="note">{text}</pre>
    </section>
  )
}

function Media() {
  const [message, setMessage] = useState('Sin llamada')
  const [active, setActive] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const call = useRef<Awaited<ReturnType<typeof startLoopback>> | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const stop = () => {
    controller.current?.abort()
    call.current?.stop()
    call.current = null
    if (audio.current) audio.current.srcObject = null
    setActive(false)
    setMessage('Llamada finalizada')
  }
  useEffect(
    () => () => {
      controller.current?.abort()
      call.current?.stop()
    },
    [],
  )
  return (
    <section>
      <h2>Audio WebRTC en loopback</h2>
      <p>
        Dos peer connections en esta página. No llama a otra persona. Usa auriculares.
      </p>
      <ActionButton
        disabled={active}
        onClick={async () => {
          const attempt = new AbortController()
          controller.current = attempt
          setActive(true)
          setMessage('Solicitando micrófono')
          try {
            const result = await startLoopback(attempt.signal, (stream) => {
              if (!attempt.signal.aborted && audio.current)
                audio.current.srcObject = stream
            })
            if (attempt.signal.aborted) {
              result.stop()
              return
            }
            call.current = result
            setMessage('Conexión creada; consulta estadísticas para verificar tráfico')
          } catch (error) {
            if (!attempt.signal.aborted) {
              setActive(false)
              setMessage(`No se pudo iniciar: ${(error as Error).name}`)
            }
          }
        }}
      >
        Iniciar audio
      </ActionButton>
      <ActionButton disabled={!active} onClick={stop}>
        Colgar
      </ActionButton>
      <ActionButton
        disabled={!active}
        onClick={async () => {
          const current = call.current
          if (!current) return
          const stats = await current.receiver.getStats()
          let packets = 0
          stats.forEach((report) => {
            if (report.type === 'inbound-rtp' && report.kind === 'audio')
              packets += report.packetsReceived ?? 0
          })
          if (call.current === current)
            setMessage(`Paquetes de audio recibidos: ${packets}`)
        }}
      >
        Consultar estadísticas
      </ActionButton>
      <audio ref={audio} controls aria-label="Audio recibido" />
      <p role="status">{message}</p>
    </section>
  )
}
