---
id: P006
title: 'TCP, UDP y QUIC: entregar todos los datos no siempre significa llegar a tiempo'
published: 2026-10-18T02:05:00Z
locale: es
translationKey: computing-transport-loss-latency
slug: tcp-udp-quic-perdida-latencia
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P005]
description: 'Entrega fiable, datagramas, control de flujo y congestión: entender los trade-offs de TCP, UDP y QUIC mediante un modelo explícito de pérdida y plazos.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [redes, tcp, udp, quic, latencia]
---

Un mensaje de voz puede llegar intacto y resultar inútil porque la conversación ya ha continuado. En una descarga, en cambio, omitir una parte para llegar antes puede dejar un fichero corrupto. La palabra «rápido» no describe por sí sola qué entrega necesita cada aplicación.

Después de [nombres, direcciones y rutas](/posts/internet-ip-routing-nat-dns), veremos qué añade el **transport**. Separaremos fiabilidad, orden y plazo, compararemos TCP, UDP y QUIC, y utilizaremos una simulación pequeña sin presentarla como una medición de sus implementaciones reales.

## TCP ofrece un flujo ordenado de bytes, no mensajes de aplicación

**TCP** establece una conexión y mantiene estado para transmitir bytes de forma fiable y ordenada. El intercambio inicial coordina números de secuencia y otros parámetros; no autentica por sí solo la identidad de una empresa o usuario.

El emisor numera datos y el receptor confirma recepción mediante **ACKs**. Si falta información, el transporte puede retransmitirla. Mientras permanezca un hueco, los bytes posteriores de ese flujo no se entregan a la aplicación como si la secuencia estuviera completa.

Esta propiedad introduce **head-of-line blocking** dentro del flujo: datos que ya han llegado pueden esperar a una pérdida anterior. No significa que toda la máquina se bloquee, sino que ese orden limita qué bytes puede consumir su aplicación.

Una llamada a `write` tampoco crea necesariamente un mensaje que el receptor obtendrá en una única lectura. La aplicación debe definir su propio encuadre: longitud, delimitadores o un protocolo como HTTP. Y confirmar recepción TCP no confirma que una operación de negocio haya hecho commit.

## Control de flujo y control de congestión protegen cosas distintas

**Flow control** evita enviar más datos de los que el receptor puede aceptar según su capacidad anunciada. **Congestion control** ajusta el envío a señales sobre la red y sus recursos compartidos.

Un receptor rápido no garantiza una red libre de congestión. Tampoco basta con aumentar buffers para mejorar latencia: una cola mayor puede acumular más espera. Medir throughput sin observar el tiempo en cola puede ocultar un problema para tráfico interactivo.

La recuperación de pérdidas y las ventanas cambian con condiciones y algoritmos. No existe un único número de milisegundos que describa «cuánto tarda TCP en retransmitir» para todas las conexiones.

## UDP conserva límites de datagrama, pero no resuelve la entrega

**UDP** transporta datagramas sin establecer una conexión fiable equivalente a TCP. La aplicación puede recibirlos incompletos como secuencia: algunos no llegan, se reordenan o se duplican. El límite entre datagramas sí forma parte de la interfaz.

Eso permite decidir que una muestra antigua ya no merece recuperarse, pero desplaza responsabilidades a la aplicación. Un protocolo multimedia puede necesitar numeración, timestamps, jitter buffer, protección de datos y una política de pérdida. «Usar UDP» no implementa ninguna de esas decisiones.

Tampoco autoriza a enviar sin control: una aplicación sobre UDP debe considerar congestión y convivencia con otros flujos. Comparar solo el tamaño de las cabeceras no demuestra mejor rendimiento de extremo a extremo.

<img src="/assets/visuals/computing-series/P006.svg" alt="Una pérdida anterior hace esperar a bytes posteriores en una entrega ordenada; en datagramas independientes pueden consumirse las muestras siguientes, a cambio de conservar un hueco que la aplicación debe tratar." width="957" height="662" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P006.svg).

## QUIC combina streams fiables con un transporte sobre UDP

**QUIC** implementa conexiones seguras, control de congestión y streams sobre UDP. No equivale a «UDP sin pérdidas» ni a eliminar todas las esperas. Integra TLS para proteger la conexión, tema del siguiente artículo.

Su multiplexación permite que una pérdida que bloquea un stream no imponga el mismo orden de entrega a todos los demás streams. Aun así, comparten conexión y recursos de red; un paquete puede contener información de varios streams. La congestión y la pérdida siguen importando.

Los streams fiables de QUIC retransmiten información cuando corresponde. Elegir una entrega de datagramas con otras garantías requiere la extensión y API pertinentes; no se obtiene por llamar QUIC a cualquier envío UDP.

## Un modelo de seis muestras permite distinguir orden y plazo

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/computing-networks/concepts.mjs) envía seis unidades cada veinte milisegundos. Fijamos cuarenta de latencia, perdemos la unidad uno y, para el modo fiable, añadimos cien de recuperación. El deadline de cada unidad es su envío más ochenta.

Todos estos tiempos son **supuestos de la simulación**, no valores medidos de TCP, UDP o QUIC.

Archivo: `computing-networks/concepts.mjs`, aplicación del bloqueo ordenado.

```javascript
if (id === lost) delivered = mode === 'datagram' ? null : delivered + recovery
if (mode === 'ordered') {
  delivered = Math.max(delivered, previous)
  previous = delivered
}
```

En modo ordenado, la unidad uno llega a 160 ms y las dos siguientes esperan hasta ese instante. Tres unidades incumplen su deadline. En el modo de datagramas, la unidad uno no se entrega, pero las cinco restantes llegan dentro de plazo bajo estos parámetros.

<img src="/assets/visuals/computing-series/transport-delivery.svg" alt="Con los supuestos del modelo, las unidades uno, dos y tres se entregan tarde en modo ordenado; el modelo de datagramas pierde la unidad uno y permite entregar las posteriores sin esperar ese hueco." width="900" height="480" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/visuals/computing-series/transport-delivery.svg).

Puedes [cambiar latencia, recuperación y deadline en el simulador](/assets/interactive/computing-series/transport.html). La tabla conserva tiempos y pérdidas para no depender solo del color de la gráfica.

## La política depende de qué significa una unidad perdida

En una API, perder bytes de una petición no suele ser una salida válida: necesitamos un protocolo íntegro y gestionar después timeout, cancelación e idempotencia. En audio interactivo puede interesar ocultar una pérdida antes que reproducir voz demasiado tarde.

Estas diferencias no hacen de un transporte el ganador universal. También importan compatibilidad de red, proxies, cifrado, consumo y el protocolo de aplicación. Incluso un medio que tolera pérdida puede necesitar recuperar metadatos o estados que no admite omitir.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p006/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/computing-networks
```

## Garantías y límites

La simulación demuestra sus reglas de orden y deadline. No implementa handshake, ACKs, ventanas, adaptación de RTT, congestión o cifrado, y no compara stacks reales. Sus tiempos no deben publicarse como benchmark de protocolos.

## Ejercicio: llegar completo y llegar a tiempo

Mantén la pérdida y reduce recuperación hasta que ninguna unidad ordenada llegue tarde. Después aumenta latencia por encima del deadline. Explica por qué eliminar el bloqueo entre unidades no corrige un retraso que ya afecta a cada una por separado.

Seguimos con [cómo TLS protege y autentica el extremo de la conexión](/posts/https-tls-certificados-identidad).

## Referencias

- [RFC 9293: TCP](https://www.rfc-editor.org/rfc/rfc9293).
- [RFC 5681: control de congestión TCP](https://www.rfc-editor.org/rfc/rfc5681).
- [RFC 768: UDP](https://www.rfc-editor.org/rfc/rfc768.html).
- [RFC 9000: QUIC](https://www.rfc-editor.org/rfc/rfc9000).
