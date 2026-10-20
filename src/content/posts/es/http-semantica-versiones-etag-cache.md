---
id: P008
title: 'HTTP y caché: por qué una respuesta 304 necesita algo que ya tienes'
published: 2026-10-18T02:07:00Z
locale: es
translationKey: computing-http-cache-etag
slug: http-semantica-versiones-etag-cache
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P006, P007]
description: 'Semántica HTTP, conexiones y caché: construir un recurso con ETag y observar 200, 304 y una representación nueva tras un cambio.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [http, cache, etag, redes]
---

Un cliente recibe 304 y trata de parsear el cuerpo como JSON. No encuentra un documento vacío por accidente: el servidor está diciendo que puede seguir utilizando una representación que ya tenía. Si el cliente la descartó, le falta una parte esencial del protocolo de caché.

Después de [TLS e identidad del extremo](/posts/https-tls-certificados-identidad), veremos qué significan las peticiones HTTP, qué cambia entre versiones y cómo validar una copia sin transferir otra vez su contenido.

## HTTP expresa una intención sobre un recurso

Un **resource** es aquello que identificamos mediante una URI; una **representation** es una forma de describirlo, como un documento JSON. No tenemos que identificar recurso con una fila de base de datos o con un fichero físico.

Una petición combina método, destino, cabeceras y, cuando corresponde, contenido. La respuesta aporta un status y metadatos que ayudan a interpretarla. `Content-Type` describe el formato; `ETag` identifica una versión de representación según la política del servidor.

**GET** solicita una representación y **HEAD** sus metadatos sin transferir el cuerpo de la respuesta GET equivalente. **POST** delega procesamiento en el recurso; **PUT** plantea crear o reemplazar su estado según el contrato; **DELETE** solicita eliminar su asociación con la funcionalidad actual. **PATCH** aplica un cambio descrito por su formato.

Un método **safe** no solicita una modificación de estado de negocio como efecto esperado. Puede generar logs u otros efectos incidentales. Un método **idempotent** conserva el efecto pretendido al repetirse, pero eso no obliga a devolver exactamente el mismo status ni impide registros de auditoría adicionales.

Estas propiedades ayudan a clientes e intermediarios. No deben utilizarse como etiquetas decorativas mientras un GET confirma una compra o un PUT añade otra unidad en cada repetición.

GET y HEAD son safe e idempotent; PUT y DELETE son idempotent, pero no safe. POST y PATCH no aportan una garantía general de idempotencia por el mero método: un contrato concreto puede añadirla, por ejemplo mediante una clave de operación.

## Las versiones cambian el transporte de mensajes, no el significado de GET

**HTTP/1.1** permite conexiones persistentes: no necesitamos abrir una conexión nueva por cada recurso. La reutilización evita parte del establecimiento, aunque necesita gestionar límites, cierres y mensajes pendientes.

**HTTP/2** multiplexa streams sobre una conexión TCP y utiliza framing binario y compresión de cabeceras. Varias respuestas pueden avanzar sin necesitar una conexión TCP por cada una, pero una pérdida en ese flujo TCP puede retrasar datos de los streams que lo comparten.

**HTTP/3** utiliza QUIC. Su separación de streams reduce esa dependencia de orden entre streams de transporte; no elimina congestión, dependencias de aplicación ni todo coste de establecimiento. Los escenarios en que aporta una mejora dependen del camino de red y de las implementaciones.

El laboratorio utiliza HTTP/1.1 de Node. Explicar las otras versiones no significa haber ejecutado una comparación entre ellas.

## Freshness permite reutilizar; validation comprueba si sigue sirviendo

Una caché puede reutilizar una respuesta **fresh** sin consultar siempre al origen, si las reglas lo permiten. Con `max-age` se establece una duración de frescura; determinar la edad implica las reglas de caché y sus metadatos, no solo mirar cuándo abrimos la pestaña.

Una respuesta que necesita **validation** puede conservarse y volver a comprobarse. `no-cache` no significa «no almacenar»: exige la validación aplicable antes de reutilizar. **no-store** pide no almacenar la respuesta bajo las reglas de la directiva.

**private** restringe el almacenamiento a cachés privadas; no autoriza a una caché compartida a conservar datos personalizados por el mero hecho de que la URL sea idéntica. Mezclar respuestas entre usuarios puede ser una fuga aunque cada JSON sea correcto por separado.

<img src="/assets/visuals/computing-series/P008.svg" alt="Primero el cliente recibe 200 con JSON y ETag; después envía If-None-Match y recibe 304 sin cuerpo para reutilizar su copia; cuando cambia el recurso recibe 200 y un ETag distinto." width="890" height="774" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P008.svg).

## ETag permite preguntar por la representación que ya tenemos

El servidor del [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/computing-networks/http-server.mjs) calcula un ETag fuerte a partir del JSON que sirve. El cliente conserva la primera copia y envía su validador mediante **If-None-Match**.

Archivo: `computing-networks/http-server.mjs`, resultado de una coincidencia del validador.

```javascript
if (matches) {
  response.writeHead(304)
  response.end()
  return
}
```

La secuencia comprobada es **200, 304, 200**. El segundo paso transfiere cero bytes de cuerpo. Después cambiamos el contenido del fixture y el ETag deja de coincidir, por lo que se envía una representación nueva.

La función de test consume las respuestas, conserva ambos ETags y verifica que son distintos. No presentamos esos requests de Node como una caché completa de navegador: el experimento construye explícitamente la petición condicional.

Un ETag **weak**, marcado con `W/`, sirve para ciertas comparaciones semánticas; no afirma identidad byte a byte. Las condiciones de GET y las precondiciones de escritura no utilizan todas exactamente la misma comparación. Este ejemplo aborda GET/HEAD y no implementa edición concurrente con If-Match.

## La clave de caché también debe representar las variantes

Si la representación varía según una cabecera, **Vary** comunica esa dimensión a la caché. Ignorar idioma o negociación de contenido puede reutilizar una variante equivocada aunque la URL coincida.

Nuestro fixture sirve un único JSON sin compresión negociada. No debemos copiar su cálculo de ETag fuerte a una cadena que modifica los bytes después de calcularlo sin revisar el significado del validador y las variantes.

No aplicar caché simplifica algunos estados, pero puede incrementar transferencias y carga. Permitir frescura evita consultas mientras acepta un periodo de posible obsolescencia. Revalidar reduce cuerpos transferidos, aunque sigue necesitando una interacción con el servidor.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p008/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/computing-networks
```

## Garantías y límites

Se verifican semántica condicional básica y cuerpos sobre un servidor real. No implementamos una caché compartida, un parser general de todas las variantes de ETag ni comparación HTTP/2/3. El validador detecta cambios de representación bajo su contrato; no es una credencial ni una prueba de autorización.

## Ejercicio: una copia que el cliente ya no conserva

Repite la secuencia, pero descarta el JSON inicial antes de recibir 304. Explica por qué no puedes reconstruirlo desde esa respuesta y qué debería hacer un cliente que necesita recuperar la representación. Después distingue `no-cache` de `no-store` sin usar «borra todo» como explicación.

Seguimos con [cómo el navegador convierte respuestas en una pantalla y nuevas peticiones](/posts/navegador-dom-cssom-event-loop-fetch).

## Referencias

- [RFC 9110: semántica HTTP y peticiones condicionales](https://www.rfc-editor.org/rfc/rfc9110.html).
- [RFC 9111: caché HTTP](https://www.rfc-editor.org/rfc/rfc9111).
- [RFC 9113: HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html) y [RFC 9114: HTTP/3](https://www.rfc-editor.org/rfc/rfc9114.html).
