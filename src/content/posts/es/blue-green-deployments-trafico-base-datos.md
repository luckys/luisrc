---
id: CD-BLUEGREEN
title: 'Blue-green deployments: cambiar tráfico sin olvidar la base de datos'
published: 2026-10-25T13:05:00Z
locale: es
translationKey: progressive-delivery-bluegreen
slug: blue-green-deployments-trafico-base-datos
draft: true
status: draft
level: intermedio
prerequisites: [CD-ROLLING]
description: 'Prepara otro grupo de API y conmuta tráfico con un router real. Explica la capacidad duplicada, los efectos compartidos y por qué volver al grupo anterior no revierte automáticamente la base de datos.'
author: 'Luis Ramírez Calle'
series: 'CI/CD: entregar cambios y conservar una vuelta atrás'
tags: [blue-green, deployment, routing, postgresql]
---

Preparas un entorno nuevo, lo compruebas y cambias el tráfico. Si algo falla, vuelves al anterior. El plan parece completo hasta que la versión nueva modifica una base de datos que ambos grupos comparten.

**Blue-green** permite preparar otro grupo antes de hacerlo activo. La vuelta del tráfico puede ser sencilla; recuperar datos, contratos o efectos externos depende de decisiones adicionales.

Después de [sustituir instancias por pasos con rolling](/posts/rolling-deployments-versiones-compatibilidad), cambiaremos la unidad de transición: ahora seleccionaremos un grupo preparado de antemano.

## Blue y green representan grupos intercambiables para servir

Llamamos **blue** al grupo que atiende y **green** al que preparamos. Los nombres describen sus papeles en una entrega; no son niveles permanentes de calidad. En una entrega posterior los papeles podrían intercambiarse.

El ejemplo usa `a/b` como blue y el servicio `green` como otro grupo de API. Es una simplificación local: blue tiene dos slots y green uno. No estamos clonando dos stacks de producción idénticos ni demostrando equivalencia de capacidad.

Ambos grupos comparten PostgreSQL. Green necesita ver los datos actuales para probar sus lecturas, y blue necesita seguir entendiéndolos si retiramos el cambio. Esa base queda fuera de la frontera que se conmuta al mover tráfico HTTP.

<img src="/assets/visuals/progressive-delivery/CD-BLUEGREEN.svg" alt="El router puede elegir blue, formado por los slots a y b, o green con el candidato preparado. Ambos grupos acceden al mismo PostgreSQL; cambiar la ruta no cambia ni restaura automáticamente ese estado compartido." width="323" height="424" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/progressive-delivery/CD-BLUEGREEN.svg).

## Preparado no significa expuesto

El ejercicio levanta green después de ampliar el esquema. Comprueba que está listo y que puede leer una fila escrita por la versión antigua. Mientras tanto, el router sigue enviando las peticiones de prueba al grupo blue.

Eso permite comprobar el candidato sin darle todavía ese tráfico. El fixture accede directamente a su puerto loopback para hacer probes y escrituras de control; ese acceso pertenece al harness.

En un entorno real habría que revisar también tareas que no dependan del router. Un worker de green podría empezar a consumir mensajes o un cron podría escribir datos aunque todavía no reciba HTTP. No recibir tráfico de usuarios no equivale a no ejecutar ningún efecto.

El laboratorio no tiene workers ni cron y sus lecturas no escriben precios. Mantener ese alcance pequeño permite observar con claridad qué acción produce cada cambio.

## Conmutar tráfico requiere saber qué componente lo decide

Aquí el router aplica una lista de slots mediante IPC. Para elegir green se usa una única entrada:

```javascript
  const switched = await setRoute(state(['green']))
  const switchedSmoke = await smoke(router.origin); assert.equal(switchedSmoke.ok, true)
```

El script no reconstruye la image durante la conmutación. Cambia la ruta y ejecuta el smoke contra el mismo punto de entrada que utilizarán las peticiones del ejercicio.

La actualización tiene efecto sobre decisiones nuevas de este router. No demuestra una conmutación simultánea de balanceadores distribuidos, cachés DNS o conexiones abiertas en varios centros de datos. El mecanismo elegido determina esos tiempos y condiciones.

La captura registra revisión de ruta y respuestas. Así podemos distinguir que green esté arrancado de que una petición haya llegado efectivamente a él.

## La flag apagada permite separar instalación y comportamiento

Al conmutar, green ejecuta la release candidata con la flag apagada. El precio sigue siendo correcto. Además, una petición que intenta imponer la cabecera de activación desde fuera no cambia la decisión del router.

Este resultado acredita el camino probado. No valida la rama nueva, que contiene la regresión deliberada. La siguiente fase de canary ampliará la evidencia activándola de forma controlada.

Es frecuente querer agrupar «cambiar la versión» y «activar todas las novedades» en un solo paso. Separarlos puede ayudar a localizar la causa de un fallo, pero también deja más estados que probar y documentar. La [flag](/posts/feature-flags-deploy-release-comportamiento) no elimina ese coste.

## Volver a blue exige conservar un grupo utilizable

Conservar blue consume recursos mientras green se verifica. Ese coste puede estar justificado por la rapidez de vuelta, pero depende del tamaño del sistema y del tiempo que deba mantenerse la opción.

También debe seguir funcionando. Si blue conserva una credencial caducada, una conexión rota o un contrato que ya se retiró, cambiar el router no lo convierte en un destino válido. Conviene comprobar el camino de vuelta, no solo que sus containers aparezcan en una lista.

Antes de este ejercicio, el harness cierra el recorrido rolling y vuelve a preparar blue con la image estable. Registra peticiones a v1 antes de conmutar y a v2 después. Blue permanece preparado mientras se comprueba green; la fase `blue_restored` vuelve a dirigirle tráfico y registra sus respuestas.

Son experimentos secuenciales en un mismo fixture. No se presenta la preparación de grupos como una prueba de continuidad bajo carga real.

## La base de datos compartida necesita una estrategia propia

La expansión añade `display_name` nullable y conserva `name`. La versión antigua escribe `name`; la nueva escribe ambos y puede leer mediante fallback. Así el grupo anterior sigue siendo viable.

Si el cambio hubiera eliminado `name`, la vuelta de blue reintroduciría consultas incompatibles. Duplicar únicamente los procesos de API no crea una segunda copia de ese esquema ni revierte las escrituras recientes.

Duplicar también la base plantea otros problemas: sincronizar cambios, decidir quién escribe y evitar pérdidas o conflictos al volver. Blue-green no resuelve automáticamente esa coordinación. En este caso compartimos una base para centrarnos en compatibilidad de aplicación.

El [artículo final de rollback](/posts/rollback-aplicacion-esquema-datos-compatibles) ensaya una retirada prematura de columna dentro de una transacción y demuestra por qué rompería la consulta antigua.

## Blue-green y canary pueden combinarse

Tener un grupo green preparado no obliga a enviarle todo el tráfico de golpe. Puedes empezar por una cohorte pequeña y compararla con blue. La preparación de grupos y el criterio de exposición son decisiones relacionadas, pero distintas.

En el [siguiente artículo](/posts/canary-releases-candidato-control-muestras) usaremos green como candidato y `a/b` como control. El porcentaje de routing no se tomará como prueba suficiente; observaremos el resultado del precio en cada grupo.

## Código completo y pruebas

Consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/progressive-delivery/README.md) y el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/cd-bluegreen/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/progressive-delivery run exercise
pnpm --filter @luisrc-examples/progressive-delivery run verify
```

## Garantías y límites

Se levantó el candidato sin tráfico del router, se conmutó a green y se volvió a blue con respuestas observadas. Las versiones compartieron PostgreSQL mediante un esquema compatible.

No se ha clonado un stack completo, probado capacidad equivalente ni verificado DNS, balanceadores externos, sesiones largas o tareas asíncronas durante el cambio. Tampoco se ha restaurado una base de datos.

## Ejercicio: dibujar la frontera real de la conmutación

Dibuja API, workers, scheduler, cache y base de datos de un servicio sencillo. Marca cuáles cambiaría tu decisión blue-green y cuáles seguirían compartidos. Para cada componente compartido, escribe qué debe seguir siendo compatible si vuelves al grupo anterior.

## Referencias

- [AWS: blue-green deployments](https://docs.aws.amazon.com/whitepapers/latest/blue-green-deployments/welcome.html).
- [AWS: sincronización de datos y cambios de esquema](https://docs.aws.amazon.com/whitepapers/latest/blue-green-deployments/best-practices-for-managing-data-synchronization-and-schema-changes.html).
- [Google SRE: canarying releases y evaluación progresiva](https://sre.google/workbook/canarying-releases/).

Fuentes consultadas el 25 de octubre de 2026.
