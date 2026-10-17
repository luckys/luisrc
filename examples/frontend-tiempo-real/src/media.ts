function gather(peer: RTCPeerConnection, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new DOMException('Cancelado', 'AbortError'))
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      peer.removeEventListener('icegatheringstatechange', changed)
      signal.removeEventListener('abort', aborted)
    }
    const changed = () => {
      if (peer.iceGatheringState === 'complete') {
        cleanup()
        resolve()
      }
    }
    const aborted = () => {
      cleanup()
      reject(new DOMException('Cancelado', 'AbortError'))
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('ICE gathering timeout'))
    }, 10000)
    peer.addEventListener('icegatheringstatechange', changed)
    signal.addEventListener('abort', aborted, { once: true })
  })
}

export async function startLoopback(
  signal: AbortSignal,
  receive: (stream: MediaStream) => void,
) {
  const sender = new RTCPeerConnection({ iceServers: [] })
  const receiver = new RTCPeerConnection({ iceServers: [] })
  let stream: MediaStream | undefined
  const stop = () => {
    signal.removeEventListener('abort', stop)
    sender.close()
    receiver.close()
    stream?.getTracks().forEach((track) => track.stop())
  }
  signal.addEventListener('abort', stop, { once: true })
  try {
    if (signal.aborted) throw new DOMException('Cancelado', 'AbortError')
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // El permiso puede resolverse después de pulsar Colgar.
    if (signal.aborted) {
      stop()
      throw new DOMException('Cancelado', 'AbortError')
    }
    receiver.ontrack = (event) => receive(event.streams[0])
    for (const track of stream.getTracks()) sender.addTrack(track, stream)
    await sender.setLocalDescription(await sender.createOffer())
    await gather(sender, signal)
    await receiver.setRemoteDescription(sender.localDescription!)
    await receiver.setLocalDescription(await receiver.createAnswer())
    await gather(receiver, signal)
    await sender.setRemoteDescription(receiver.localDescription!)
    return { sender, receiver, stream, stop }
  } catch (error) {
    stop()
    signal.removeEventListener('abort', stop)
    throw error
  }
}
