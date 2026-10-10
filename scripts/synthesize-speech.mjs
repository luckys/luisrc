import { EdgeTTS } from 'edge-tts-universal/isomorphic'

// Isolated worker: the parent can terminate a stalled WebSocket request.
try {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  const result = await new EdgeTTS(text, process.argv[2]).synthesize()
  process.stdout.write(Buffer.from(await result.audio.arrayBuffer()))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
