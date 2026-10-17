import * as Y from 'yjs'

export function connectNote(onText: (value: string) => void) {
  const document = new Y.Doc()
  const text = document.getText('note')
  const channel = new BroadcastChannel('blog-note-v1')
  const stored = localStorage.getItem('blog-note-v1')
  if (stored) Y.applyUpdate(document, Uint8Array.from(JSON.parse(stored)))
  let online = true
  const publish = () => {
    if (online) channel.postMessage(Y.encodeStateAsUpdate(document))
  }
  const update = (_update: Uint8Array, origin: unknown) => {
    localStorage.setItem(
      'blog-note-v1',
      JSON.stringify([...Y.encodeStateAsUpdate(document)]),
    )
    onText(text.toString())
    if (origin !== 'remote') publish()
  }
  document.on('update', update)
  channel.onmessage = ({ data }) => {
    if (!online) return
    if (data === 'sync') publish()
    else Y.applyUpdate(document, new Uint8Array(data), 'remote')
  }
  channel.postMessage('sync')
  onText(text.toString())
  return {
    append(value: string) {
      text.insert(text.length, value)
    },
    setOnline(value: boolean) {
      online = value
      if (online) {
        channel.postMessage('sync')
        publish()
      }
    },
    close() {
      channel.close()
      document.destroy()
    },
  }
}
