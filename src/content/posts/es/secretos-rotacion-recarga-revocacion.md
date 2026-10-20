---
id: API-THREATS-SECRETS
title: 'Rotar secretos: comprobar la nueva credencial antes de retirar la anterior'
published: 2026-10-18T04:31:00Z
locale: es
translationKey: secretos-rotacion-recarga-revocacion
slug: secretos-rotacion-recarga-revocacion
draft: true
status: draft
level: intermedio
prerequisites: [API-THREATS-CREDENTIALS]
description: 'Implementa recarga verificada, convivencia y revocación con peticiones HTTP reales. Distingue rotación programada de contención y evita secretos en logs y assets.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, api, secretos, rotacion, testing]
---

Cambiar una clave en su almacén no cambia automáticamente la copia que usa un servicio en ejecución. Si retiramos la anterior antes de que ese servicio cargue y compruebe la nueva, una rotación programada puede convertirse en una caída.

Vamos a seguir el cambio completo: emitir, distribuir, comprobar, seleccionar y revocar. Usaremos el [verificador de credenciales del artículo anterior](/posts/api-keys-credenciales-clientes-permisos) y un cliente HTTP local. Las claves se generan en memoria; no utilizaremos secretos de ninguna cuenta real.

## Almacenar un secreto y gestionar su ciclo de vida son tareas distintas

Un **secret manager** puede custodiar valores y controlar quién los obtiene. Aun así, necesitamos saber cuándo deja de valer una versión, qué consumidores la usan y cómo reaccionan si la recarga falla. La [guía de OWASP sobre secretos](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) trata ese ciclo de vida, no solo la elección de un lugar donde guardarlos.

En el ejercicio separamos tres responsabilidades:

- El **emisor/verificador** mantiene digest, permisos, expiración y revocación de cada clave.
- La función **readSecret** entrega al cliente una versión y su token. Representa el punto donde conectaríamos una fuente autorizada.
- El **cliente** conserva la credencial activa, comprueba una candidata y cambia de versión.

readSecret es una función inyectada que devuelve datos en memoria. No hemos integrado un proveedor cloud ni demostrado sus permisos, cifrado, disponibilidad o registro de accesos. Esta separación permite probar el comportamiento del consumidor sin fingir que el almacén ya está desplegado.

Tampoco podemos sustituir el token del cliente por su digest. El servidor puede verificar un token recibido comparando hashes; el cliente necesita presentar el token original. Entregar el digest como credencial crearía otro secreto reutilizable en lugar de eliminar esa necesidad.

## En una rotación programada conviven dos claves durante la transición

Primero emitimos una segunda credencial para el mismo cliente, tenant y scopes. La anterior continúa válida. Después cambiamos la fuente a la versión v2 y pedimos al consumidor que la recargue.

La convivencia evita exigir que todos los procesos cambien en el mismo instante. Sin embargo, mientras dure, ambas claves permiten acceso. Necesitamos un criterio para terminarla; emitir la siguiente y olvidar la anterior no es completar una rotación.

<img src="/assets/visuals/api-contracts/API-THREATS-SECRETS.svg" alt="La rotación programada emite una segunda clave mientras la anterior sigue válida. El cliente lee y comprueba la candidata con la API, cambia su copia activa y solo entonces se revoca la anterior. Si la prueba falla, conserva la copia previa sin convertirla en válida tras su revocación." width="298" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-THREATS-SECRETS.svg).

En un sistema con varias réplicas no bastaría con observar un único cliente. Haría falta conocer qué consumidores siguen utilizando la versión anterior, fijar un plazo y decidir qué hacer con los que no hayan migrado. Nuestro laboratorio tiene uno: no demuestra coordinación de una flota.

## Prueba la candidata antes de cambiar la credencial activa

La función `load` de `credential-client.mjs` valida formato y metadatos, llama a una lectura fija y solo selecciona la nueva clave si esa petición recibe 200:

```javascript
async function load() {
  try {
    const candidate = await readSecret()
    if (
      !candidate ||
      typeof candidate.version !== 'string' ||
      !/^v[1-9]\d{0,5}$/.test(candidate.version) ||
      typeof candidate.token !== 'string' ||
      !parseCredential(`Bearer ${candidate.token}`)
    )
      throw new Error('Invalid candidate')
    // Copiar antes del await impide que el source cambie el objeto comprobado.
    const next = { version: candidate.version, token: candidate.token }
    if ((await request(next.token)).status !== 200) throw new Error('Probe failed')
    current = next
    report({ event: 'secret_loaded', version: next.version })
  } catch {
    report({ event: 'secret_reload_failed' })
    throw new Error('credential_reload_failed')
  }
}
```

request hace un GET al documento d1 de North, con Authorization, redirects rechazados y un timeout de un segundo. El constructor acepta únicamente el origen HTTP loopback del fixture y tenants conocidos. No recibe una URL arbitraria de la fuente del secreto: eso podría enviar la credencial a otro destino.

Esta lectura es la operación que nuestro cliente necesita. Su éxito no demuestra permisos para escribir o importar. Para otro consumidor habría que elegir una comprobación inocua que represente sus requisitos, sin provocar efectos de negocio solo para probar una clave.

Copiamos los dos strings antes del await para que una modificación posterior del objeto de la fuente no sustituya el valor comprobado. Las recargas simultáneas comparten la misma promesa: no iniciamos dos lecturas que puedan terminar fuera de orden y seleccionar una candidata antigua al final.

La selección es una asignación dentro de un proceso. No es una transacción distribuida. Entre la prueba y la siguiente petición, el servidor podría revocar la nueva clave: el cliente tendrá que gestionar el rechazo.

## Conservar la versión previa no permite saltarse una revocación

Si readSecret falla o devuelve una clave rechazada, no sustituimos current. El consumidor puede seguir usando su versión anterior **si el servidor todavía la admite**. Si no existe una versión inicial, falla con credential_not_loaded; no inventa una clave por defecto.

Es una elección de disponibilidad para recargas rutinarias, no una forma de ignorar las decisiones del emisor. Cada llamada vuelve a pasar por la API. Si el servidor revoca la anterior o alcanza su fecha de caducidad, la copia local recibe 401 aunque siga en memoria.

Un error de recarga tampoco provoca una búsqueda automática entre todas las credenciales históricas. Eso ocultaría una migración fallida y podría reactivar una versión que queríamos retirar. En la demo, la acción de recuperación es explícita: arreglar la fuente y volver a ejecutar reload.

Si existe sospecha de compromiso, puede ser necesario **revocar inmediatamente**, aunque algunos consumidores dejen de funcionar. La ventana de convivencia de una rotación programada no es la respuesta por defecto a una filtración. Continuar aceptando una clave robada mientras esperamos al último cliente mantendría el acceso del atacante.

## Registra la transición, no el contenido de la credencial

El audit recibe objetos nuevos con campos permitidos: secret_loaded y una versión validada como v1 o v2; en caso de fallo, solo secret_reload_failed. No recibe el objeto original de readSecret, Authorization ni la excepción capturada.

Validar la versión también importa. Si copiáramos cualquier texto bajo esa etiqueta, una fuente podría colocar el secreto allí. El test intenta precisamente usar el token como version y comprueba que no llega al audit.

Otro test lanza un error cuyo mensaje incluye el token. El cliente lo sustituye por un error genérico sin adjuntar cause. Esto evita esa vía concreta de filtración, pero no demuestra que una librería HTTP, un proxy, un volcado de memoria o un logger externo nunca registren cabeceras. Hay que revisar esas fronteras aparte.

La función audit es síncrona y sus fallos se aíslan para no cambiar la identidad activa. Es una política explícita del laboratorio, no una auditoría durable: pueden perderse eventos. Un requisito de trazabilidad obligatoria necesitaría almacenamiento y tratamiento de fallos propios; no se resuelve envolviendo todo en un catch silencioso.

## Reproduce la transición con peticiones HTTP reales

Consulta el [laboratorio de amenazas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats/credential-client.mjs) y ejecuta `pnpm demo:credentials` con Node 24.19.0 o posterior. El comando crea la API local, emite claves efímeras, recarga el cliente, observa estas cinco etapas y cierra el servidor:

<div role="region" aria-label="Etapas de rotación y respuestas HTTP" tabindex="0" style="overflow-x:auto">

| Etapa                  | Clave anterior | Clave nueva       | Cliente con su copia activa |
| ---------------------- | -------------- | ----------------- | --------------------------- |
| Inicio, v1 cargada     | 200            | Todavía no existe | 200                         |
| Segunda clave emitida  | 200            | 200               | 200, todavía con v1         |
| Cliente recargado a v2 | 200            | 200               | 200, con v2                 |
| Anterior revocada      | 401            | 200               | 200, con v2                 |
| Expiración alcanzada   | 401            | 401               | 401                         |

</div>

Son respuestas de conexiones HTTP, no resultados predeterminados por el cliente. La expiración usa un reloj inyectado: avanzamos hasta 20 000 ms sin esperar veinte segundos. La tabla no mide latencia ni duración recomendable de las claves.

`observe-credentials.mjs` devuelve únicamente etapas, status y eventos permitidos. `credential-evidence.json` archiva esa proyección. El test vuelve a ejecutar la secuencia, la compara con el archivo y exige los resultados de la tabla de forma independiente. No archivamos tokens, identificadores aleatorios, digests o puertos temporales.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-threats-secrets/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-threats
```

## Garantías y límites

`pnpm test` incluye pruebas de primera carga ausente, candidata inválida, fallo de fuente, cambio correcto, revocación, expiración, recarga simultánea y errores de audit. Las claves solo se crean en tiempo de ejecución y no se escriben en los assets descargables.

No hay secret manager real, persistencia, varios procesos, TLS o borrado verificable de memoria. El cliente necesita conservar el secreto en memoria y el runtime puede mantener copias. La fuente inyectada no tiene deadline ni política de reintentos: integrar una fuente remota exigiría acotar también esa espera. El timeout HTTP de la prueba no la cubre.

Una clave de backend tampoco debe añadirse a un bundle de navegador. Que el frontend no muestre un string en pantalla no impide que el usuario inspeccione sus recursos o sus peticiones. El cliente de este ejercicio se ejecuta en Node, no dentro del blog.

La entrega cubre el ciclo local de una credencial, no una revisión de seguridad de infraestructura. Conservamos el riesgo residual en el threat model para que la existencia de un test verde no borre lo que falta desplegar y comprobar.

## Ejercicio: decidir qué hacer cuando una réplica no migra

Imagina tres consumidores y una ventana programada de convivencia. Dos cargan v2; el tercero sigue con v1 porque su fuente no responde. Define qué señales necesitas, cuánto tiempo aceptarías esa situación y quién puede decidir revocar.

Después cambia el escenario: v1 aparece en un repositorio público. Escribe una secuencia de contención distinta y prueba que revocar v1 rechaza incluso a un cliente que la tiene cargada. No intentes mantener disponibilidad ampliando por inercia la ventana de una clave comprometida.

## Referencias

- [OWASP: ciclo de vida y gestión de secretos](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).
- [OWASP: exclusión de tokens y secretos de los logs](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude).
- [Node.js: AbortSignal.timeout](https://nodejs.org/api/globals.html#static-method-abortsignaltimeoutdelay).

Fuentes consultadas el 20 de octubre de 2026. La tabla procede del laboratorio incluido, con tiempo lógico controlado.
