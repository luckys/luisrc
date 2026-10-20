---
id: API-VERSION-MIGRATION
title: 'Versionar y retirar una API: convivencia, deprecación y migración de clientes'
published: 2026-10-18T04:11:00Z
locale: es
translationKey: versionado-api-deprecacion-migracion-consumidores
slug: versionado-api-deprecacion-migracion-consumidores
draft: true
status: draft
level: intermedio
prerequisites: [P025]
description: 'Diseña una transición entre versiones HTTP: URL o headers, SemVer del SDK, Deprecation, Sunset, guía y criterios de retirada.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, versionado, deprecacion, migracion, contratos]
---

El servidor ya ofrece v2 y la aplicación móvil sigue usando v1. Publicar otra representación no actualiza los dispositivos desplegados ni demuestra que sus responsables hayan leído la guía.

Después de [detectar incompatibilidades con contract tests](/posts/evolucion-api-versiones-consumidores-contratos), toca diseñar la convivencia. Una transición necesita una alternativa utilizable, señales comprensibles y criterios para saber cuándo puede terminar el soporte anterior.

El laboratorio conserva amountMinor y currency en v1 y utiliza money.minorUnits y money.currency en v2. Ambos representan 1250 unidades menores EUR como 12,50 euros. No cambiamos la unidad como parte de esta migración.

## Versionar en URL o en headers cambia cómo se opera la transición

Elegimos **versiones en URL**: `/v1/orders` y `/v2/orders`. Resultan visibles en ejemplos, logs y pruebas. También hacen explícito qué representación solicita cada cliente. La contrapartida es mantener rutas y documentación durante la convivencia.

Otra opción utiliza negociación mediante **Accept** y media types versionados. Mantiene una URI para el recurso, pero el routing, los caches y las herramientas deben distinguir representaciones. Cuando la respuesta depende de Accept, la política de `Vary` y cache keys necesita reflejarlo.

Una cabecera propia también requiere acordar valores, errores y comportamiento por defecto. Añadir un header de versión no vuelve automáticamente más compatible el servicio ni elimina la necesidad de mantener la versión anterior.

La demo implementa solo la variante de URL. No simulamos negociación para luego presentarla como una función probada. Tampoco creamos v2 por añadir `label`: la versión nueva sirve para retirar y reorganizar una estructura que un consumidor antiguo sí necesita.

<img src="/assets/visuals/api-contracts/API-VERSION-MIGRATION.svg" alt="La transición publica v2, mantiene v1, comunica Deprecation y Sunset, ofrece una guía y revisa adopción antes de una retirada que la demo no ejecuta." width="342" height="815" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-VERSION-MIGRATION.svg).

## SemVer del SDK no sustituye la versión del protocolo HTTP

**Semantic Versioning** permite comunicar cambios de una API pública de software mediante MAJOR.MINOR.PATCH. Para un SDK estable, añadir una capacidad compatible suele corresponder a MINOR; cambiar una firma de forma incompatible requiere MAJOR; corregir un bug de manera compatible corresponde a PATCH.

El paquete del SDK, la representación HTTP y `info.version` de OpenAPI son ejes distintos. Un SDK 2.0.0 podría seguir consultando `/v1` si cambió su propia interfaz. Un SDK 1.4.0 podría añadir soporte optativo para `/v2` sin romper las llamadas anteriores. Esos números son ejemplos de política, no releases que hayamos publicado.

No basta con subir el major del SDK si una aplicación antigua sigue llamando a una ruta que acabamos de romper. El servidor debe respetar los contratos que aún mantiene, con independencia de que exista una librería nueva para quienes puedan actualizarla.

## Deprecar comunica una transición; no ejecuta la migración

Las respuestas v1 del laboratorio incluyen **Deprecation**, **Sunset** y un **Link** a `/migration/v2`, una guía local que sí sirve el servidor. OpenAPI también marca la operación antigua como deprecated.

Deprecation utiliza el formato de fecha estructurada de **RFC 9745**, con `@` seguido de segundos desde epoch. No usamos un booleano inventado ni copiamos el formato HTTP-date de Sunset. **RFC 8594** define Sunset para anunciar cuándo se prevé que el recurso deje de responder como hasta entonces.

Las fechas son ficticias y explícitas: deprecación desde el 18 de octubre de 2026 y retirada propuesta para el 18 de abril de 2027. La demo no apaga v1 al llegar esa fecha. No existe un servicio público al que estemos imponiendo una retirada.

La guía explica qué campos cambian, que la unidad monetaria se conserva y qué debe hacer el consumidor con la URL. También indica que los cursores están ligados a la versión: migrar exige iniciar otro recorrido. Pretender reutilizar cualquier token v1 en v2 sería una promesa adicional que no implementamos.

## Una guía debe permitir completar el cambio, no solo anunciarlo

La ruta `/migration/v2` explica tres pasos concretos: leer el importe dentro de money, pasar a la URL v2 e iniciar el recorrido de páginas de nuevo. El último paso importa porque los tokens están ligados a la versión.

Si el cliente copia un cursor v1 al cambiar la URL, la demo lo rechaza. No es una caída de la base de datos: el token ya no pertenece al ámbito solicitado. La migración debe anticiparlo para que el consumidor no lo descubra como un error inesperado.

Los tests hacen peticiones reales a la guía y comprueban que las respuestas v1 incluyen las cabeceras, mientras las v2 no anuncian esa deprecación. Eso demuestra que las señales se sirven; no demuestra que un cliente real las vea, que se monitoricen o que alguien haya terminado de migrar.

La guía local se sirve como HTML estático. No hay un portal de desarrolladores, una campaña de avisos o responsables externos. Es una pieza pequeña ejecutable sobre la que explicar el flujo sin atribuirle coordinación que no existe.

## Retirar una versión necesita evidencia, no solo un calendario

Una transición práctica empieza identificando consumidores y responsables. Después se publica la alternativa, se mantienen ambas representaciones, se ofrecen ejemplos de migración y se observa qué clientes siguen utilizando la anterior. La fecha se comunica con suficiente margen y una política conocida.

Antes de retirar, necesitamos criterios: ¿quedan clientes críticos?, ¿hay una aplicación que no puede actualizarse?, ¿se ha probado el nuevo contrato con ellos?, ¿qué respuesta documentada recibirán tras la retirada? Si no podemos identificar el uso antiguo, no podemos afirmar que todos migraron.

El laboratorio no tiene usuarios ni telemetría de adopción, así que no declara ese paso completado. Sí aporta una guía, headers y pruebas de convivencia que podemos ejecutar antes de plantear la retirada. Ninguna cabecera demuestra por sí sola que un consumidor la leyó o adaptó su código.

Mantener indefinidamente dos versiones también cuesta: correcciones duplicadas, revisión de seguridad y más combinaciones de tests. Evitar una ruptura no significa prometer soporte eterno. Significa hacer explícito qué contrato se mantiene y cómo termina esa obligación.

## La fecha y el comportamiento posterior deben estar acordados

Deprecated significa que se desaconseja seguir utilizando una opción bajo una política documentada; no significa que deje de funcionar al recibir la cabecera. Sunset comunica una retirada prevista, pero tampoco implementa el cambio del router.

Antes de ejecutarla deberíamos decidir qué recibirán las solicitudes antiguas, durante cuánto tiempo se mantendrá esa respuesta y cómo podrán encontrar ayuda. No publicamos aquí un código universal de retirada: depende del servicio y de lo que se haya acordado con sus consumidores.

Si se aplaza la fecha por un cliente crítico, la documentación, las señales y el plan deben seguir siendo coherentes. Mantener una fecha antigua mientras el comportamiento depende de excepciones desconocidas dificulta operar la transición.

La demo permite inspeccionar y probar cabeceras, guía y convivencia. La adopción y retirada efectiva requieren evidencia externa que no tenemos en un proyecto local. El post termina en ese límite, no afirma que las dos funciones de prueba representen todos los usuarios.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-version-migration/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-pagination-evolution
```

## Garantías y límites

El [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-pagination-evolution/README.md) incluye el servidor, la guía HTML y OpenAPI con dos operaciones. Las fechas de deprecación y Sunset están fijadas como datos ficticios del ejemplo.

```bash
pnpm install --frozen-lockfile
node --test tests/http.test.mjs
node run.mjs serve
```

El último comando requiere la imagen PostgreSQL ya local y crea su propio contenedor. Imprime un puerto local; utiliza las rutas v1, v2 y migration/v2 del README. Ctrl+C cierra el servidor y elimina únicamente ese entorno privado.

No hay negociación Accept implementada, SDK publicado, usuarios externos, telemetría de adopción ni apagado automático. Versionar tampoco resuelve autenticación, permisos o la compatibilidad de cualquier otro cambio de comportamiento.

## Ejercicio: diseñar una retirada que se pueda comprobar

Escribe una guía para un consumidor que no puede actualizarse hoy. Indica representación actual, alternativa, fecha propuesta, cómo detectar su uso y qué criterio permitirá retirar el soporte. Distingue las comprobaciones que puedes automatizar en este laboratorio de las que necesitan coordinación con usuarios reales.

Continúa con [sesiones web y cookies](/posts/sesiones-web-cookies-identidad), el inicio del bloque de identidad. La serie sigue abierta: estos fundamentos no completan todavía permisos, amenazas e integración.

## Referencias

- [Semantic Versioning 2.0.0](https://semver.org/).
- [RFC 9745: Deprecation](https://www.rfc-editor.org/rfc/rfc9745.html).
- [RFC 8594: Sunset](https://www.rfc-editor.org/rfc/rfc8594.html).
- [RFC 9110: negociación y Vary](https://httpwg.org/specs/rfc9110.html).
- [OpenAPI 3.1.1: operaciones deprecated](https://spec.openapis.org/oas/v3.1.1.html).

Fuentes consultadas el 18 de octubre de 2026. Fechas y versiones de migración son ejemplos, no anuncios de una API pública.
