---
id: P075
title: 'WebRTC: de pedir el micrófono a transportar audio y cerrar la llamada'
published: 2026-10-17T05:08:00Z
locale: es
translationKey: frontend-webrtc-audio
slug: webrtc-audio-ice-stun-turn
draft: true
status: draft
level: intermedio
prerequisites: [P073, API-SECURITY]
description: 'Señalización, ICE, STUN, TURN y estadísticas mediante un loopback de audio local con cancelación y cierre de recursos.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, webrtc, audio, redes]
---

Pedir acceso al micrófono no establece una llamada. Faltan negociar formatos, encontrar una ruta y transportar audio. Si el usuario cuelga mientras aparece el permiso, también hay que impedir que el micrófono quede abierto al concederlo después.

Tras [sincronizar datos entre clientes](/posts/sse-websockets-reconexion-eventos-perdidos), cambiamos de medio: un paquete de voz demasiado tardío puede ser menos útil que continuar sin él.

## Señalización y audio recorren caminos distintos

**WebRTC** ofrece APIs para conectar peers y transmitir medios y datos. La aplicación intercambia información de sesión: oferta, respuesta y candidatos de conectividad.

Ese intercambio es **signaling**. No tiene que implementarse con WebSocket. El servicio elegido debe autorizar quién participa: conocer el ID de una sala no debería bastar para entrar.

La descripción **SDP** comunica parámetros de sesión, no contiene el audio. Después de negociar, el tráfico multimedia utiliza la ruta seleccionada. La [guía de conectividad](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity) explica las piezas.

<img src="/assets/visuals/frontend-series/P075.svg" alt="El permiso produce un stream, la señalización intercambia SDP, ICE busca conectividad y después se transporta audio; colgar cierra peers y detiene tracks." width="558" height="982" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P075.svg).

## ICE busca rutas; STUN no sustituye a TURN

**ICE** reúne y comprueba candidatos. Una dirección local puede bastar entre extremos alcanzables. **STUN** ayuda a descubrir información de dirección visible desde otra red, pero no garantiza que las redes permitan una conexión directa.

**TURN** proporciona un relay cuando hace falta. Añade infraestructura, capacidad y coste. Que una prueba funcione en localhost sin TURN no demuestra que funcione entre móviles o redes corporativas diferentes.

El laboratorio crea dos **RTCPeerConnection** en una página con `iceServers: []`. Este **loopback local** intercambia offer y answer en memoria. Espera a reunir candidatos antes de pasar las descripciones, sin implementar trickle ICE.

Así observamos el mecanismo sin cuentas ni servicios externos. No sustituye señalización real ni pruebas entre equipos.

## La captura puede completarse después de cancelar

**getUserMedia** necesita permiso y un contexto permitido por el navegador. Localhost permite desarrollar sin publicar la demo. Un rechazo debe dejar la interfaz utilizable, no bloqueada en «Solicitando micrófono».

El caso menos evidente aparece al colgar con la solicitud pendiente. Abortar nuestro intento no obliga a cerrar el diálogo ni impide que la captura resuelva después. Debemos comprobar la señal al recibir el stream.

Archivo: `realtime-frontend/src/media.ts`, cierre de recursos del intento.

```typescript
const stop = () => {
  signal.removeEventListener('abort', stop)
  sender.close()
  receiver.close()
  stream?.getTracks().forEach((track) => track.stop())
}
```

La función completa registra ese cierre en el `AbortSignal`. Después de recibir el stream comprueba otra vez si se canceló y detiene los tracks recién obtenidos. Si la negociación falla, también libera recursos.

Cada intento tiene su controlador. Un intento antiguo no puede reactivar la interfaz después de colgar. El componente limpia igualmente al desmontarse. Eliminar el elemento `audio` no equivale a detener la captura.

## Conectado, recibiendo y escuchando son hechos diferentes

Crear descripciones no demuestra recepción de paquetes. El estado de conexión y los informes de [getStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats) permiten observar etapas distintas.

La prueba usa un micrófono sintético de Chromium, espera paquetes recibidos y verifica que colgar limpia el stream del reproductor. No afirma que una persona haya escuchado audio. La reproducción puede requerir una acción adicional según la política del navegador.

En una llamada interesan pérdida, **jitter** y retardo. Jitter es variación del tiempo de llegada; el buffering suaviza irregularidades a cambio de espera. El **RTT** de una ruta no es la latencia completa desde la boca al oído: faltan captura, codificación, buffers y reproducción.

No calculamos esa latencia a partir del número de paquetes. Medirla exige otro experimento, especialmente si los extremos tienen relojes distintos.

## Elegir medios según la tarea

Para avisar de una transcripción nueva puede bastar SSE. Para procesar audio grabado después, una subida de archivo puede ser más sencilla. Para conversación interactiva, WebRTC aporta mecanismos de medios, pero no elimina gestión de sesiones ni operación de relays.

Tampoco garantiza un camino siempre directo entre peers. Puede haber TURN u otra infraestructura multimedia. Esa elección tiene consecuencias de coste y privacidad.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p075/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/realtime-frontend
```

## Garantías y límites

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/realtime-frontend/src/media.ts). Desde `realtime-frontend/`: `pnpm test:browser --grep WebRTC`.

Se prueban transporte local de audio sintético y cierre de llamada. No se prueban STUN, TURN, redes remotas, calidad perceptiva o latencia extremo a extremo. No es un servicio de llamadas listo para publicar.

## Ejercicio: conceder permiso después de colgar

Controla la promesa de `getUserMedia`: inicia, cuelga y resuelve después con un stream de prueba. Sus tracks deben terminar y la interfaz no debe reactivar la llamada. Añade otro caso donde se rechace el permiso.

Antes de ampliar el panel, vuelve a recorrerlo con teclado y corta las conexiones. La tarea debe seguir siendo comprensible cuando falla, no solo cuando el caso feliz se ve bien.

## Referencias

- [MDN: conectividad WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity).
- [W3C: WebRTC](https://www.w3.org/TR/webrtc/).
- [MDN: getStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats).
- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- [MDN: detener tracks](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop).

Fuentes consultadas el 17 de octubre de 2026. Los medios sintéticos se usan solo en pruebas automatizadas.
