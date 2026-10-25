---
id: CD-SMOKE
title: 'Smoke tests: detectar una release incorrecta aunque responda 200'
published: 2026-10-25T13:03:00Z
locale: es
translationKey: progressive-delivery-smoke
slug: smoke-tests-release-correcta-http-200
draft: true
status: draft
level: intermedio
prerequisites: [CD-FLAGS, P055]
description: 'Define un smoke pequeño que comprueba identidad y unidades sobre HTTP real. Distingue liveness, readiness y corrección, prueba el candidato con flags y establece una condición clara para detener la entrega.'
author: 'Luis Ramírez Calle'
series: 'CI/CD: entregar cambios y conservar una vuelta atrás'
tags: [smoke-tests, testing, release, http]
---

El endpoint devuelve `200` y un JSON válido: `priceCents` contiene `100`. El producto cuesta cien euros, así que el valor correcto era `10000`. El protocolo funciona y el resultado incumple el contrato.

Un **smoke test** comprueba un recorrido pequeño sobre el entorno que acabamos de preparar. Su utilidad depende de que el criterio de éxito represente algo que el usuario necesita, además de que el proceso esté vivo.

Después de [separar deploy y release mediante una flag](/posts/feature-flags-deploy-release-comportamiento), prepararemos el gate que usarán los pasos de rolling, blue-green y canary.

## Liveness, readiness y smoke cubren preguntas diferentes

**Liveness** comprueba si el proceso puede atender el chequeo definido. **Readiness** decide si está en condiciones de recibir el trabajo para el que se ha definido. En el fixture, `/ready` consulta PostgreSQL con `SELECT 1`.

Ese chequeo no lee un producto ni calcula su precio. Puede pasar mientras la API devuelve unidades incorrectas. Por eso no reutilizamos sin más el healthcheck como prueba funcional del despliegue.

El smoke consulta dos productos con valores conocidos. No intenta cubrir todo el catálogo. Comprueba una parte del contrato lo bastante concreta como para detectar esta regresión antes de ampliar exposición.

<img src="/assets/visuals/progressive-delivery/CD-SMOKE.svg" alt="Un HTTP 200 y un JSON con número pasan comprobaciones de transporte y forma. El smoke compara 10000 céntimos esperados con 100 observados, falla y obliga a detener o retirar la exposición del candidato." width="277" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/progressive-delivery/CD-SMOKE.svg).

## El criterio combina status, identidad y significado

La función de `src/gates.ts` recibe la respuesta observada y el valor esperado:

```typescript
export function checkSmoke(response: { status: number; body: Record<string, unknown> }, id: string, expectedCents: number) {
  return response.status === 200 && response.body.id === id && response.body.priceCents === expectedCents
}
```

Comprobar el identificador evita aceptar por accidente otro producto con el mismo precio. La igualdad estricta rechaza una cadena como `"10000"`. La comparación del valor rechaza el número `100`, aunque sea un entero perfectamente válido.

Esta función no es un validador exhaustivo del contrato JSON. No revisa todos los campos ni cualquier producto posible. El conjunto pequeño de aserciones refleja el riesgo que queremos detectar en este paso.

No añadimos conversiones para conseguir que una respuesta incorrecta pase. Si el contrato exige céntimos enteros y la API devuelve euros, el gate debe fallar y conservar el valor observado.

## Probar más de un caso evita un ejemplo accidentalmente favorable

`scripts/smoke.mjs` utiliza dos productos inicializados en SQL: `book-1`, con `10000` céntimos, y `book-2`, con `99`. El candidato activado devuelve `100` y `1`, respectivamente.

Usar solo un producto gratuito no detectaría una división por cien: cero seguiría siendo cero. Los valores de prueba se eligen por el fallo que podrían distinguir, no por ser los más cómodos de escribir.

Las pruebas del gate incluyen status incorrecto, identificador diferente, tipo equivocado y precio incorrecto. También conservan una respuesta válida para evitar que una implementación que rechace todo parezca correcta.

El smoke hace peticiones **HTTP reales** contra la API o el router. Cada petición tiene un timeout. Si no puede leer o interpretar la respuesta, el script falla; no inventa un resultado correcto a partir de la última ejecución.

## El estado de la flag cambia lo que has probado

La versión candidata pasa el smoke con la flag apagada porque ejecuta la lectura anterior. Ese resultado acredita ese estado, no la rama que todavía no se ha activado.

Más adelante, el ejercicio activa la flag en una exposición controlada. El mismo smoke rechaza las respuestas aunque ambas sean `200`. Apagar la flag vuelve a producir los valores esperados con la misma image.

Por eso conviene registrar versión, configuración y destino junto a los resultados. Es fácil escribir «staging pasó» y perder la información de que el comportamiento nuevo estaba desactivado durante la prueba.

## Read-only simplifica la repetición, pero no prueba escrituras

Este smoke solo lee productos ficticios predecibles. Repetirlo no crea pedidos, envía correos ni acumula registros. El fixture puede usarlo después de cada cambio de ruta sin añadir un mecanismo de limpieza por petición.

La contrapartida es clara: el smoke no valida la escritura completa. El ejercicio añade por separado un `POST` de la versión antigua después de expandir el esquema, otro de la candidata y una escritura final tras el rollback.

Si el recorrido importante de un servicio fuera crear un recurso, un smoke de lectura podría ser insuficiente. Habría que diseñar datos sintéticos aislados, identificadores y limpieza apropiados, y evitar efectos irreversibles en sistemas ajenos.

## Un fallo debe detener una transición concreta

Para el canary del laboratorio, los resultados incorrectos obligan a retirar esa exposición. Después se vuelve a ejecutar el smoke contra la ruta estable. La recuperación tiene una observación posterior; no se da por hecha porque el router haya aceptado la orden.

La activación completa del candidato defectuoso ocurre después y se marca como **prueba negativa forzada**. Su propósito es probar la flag y el rollback, no recomendar que se ignore un gate que acaba de fallar.

Un entorno real tendría que definir quién decide entre retirar tráfico, apagar una flag, volver de artefacto o corregir hacia delante. El criterio debe estar preparado antes de que la única señal disponible sea un fallo de usuarios.

## Consultar las respuestas sin ejecutar la release

La [captura interactiva](/assets/interactive/progressive-delivery/explorer.html) permite comparar las fases de smoke y los resultados del canary. Muestra valores archivados, sin conectarse al entorno Docker del lector.

Un status correcto y un precio incorrecto permanecen visibles como hechos diferentes. Esa separación es el motivo de conservar los casos completos en la evidencia, además del booleano final `ok`.

## Código completo y pruebas

Consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/progressive-delivery/README.md) y el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/cd-smoke/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/progressive-delivery run test
pnpm --filter @luisrc-examples/progressive-delivery run exercise
pnpm --filter @luisrc-examples/progressive-delivery run verify
```

El CLI de smoke acepta únicamente HTTP loopback para este fixture. Su salida conserva cada caso; devuelve un exit code distinto de cero si alguno incumple el contrato.

## Garantías y límites

Dos valores conocidos detectaron la regresión con flag activa. La versión estable y la candidata con flag apagada conservaron los resultados esperados. Se verificaron respuestas de servicios y router reales.

No es un test exhaustivo, una prueba de carga, una suite UI E2E ni una validación de todos los tenants o combinaciones de configuración. El smoke complementa las demás pruebas y las señales posteriores al release.

## Ejercicio: elegir un caso que haga fallar una implementación equivocada

Propón dos respuestas numéricamente plausibles que un chequeo de tipos aceptaría, pero que incumplirían el contrato del endpoint. Escribe la aserción que distinguiría cada una y el dato de prueba necesario. Después decide en qué transición de la entrega debe bloquear el avance.

## Referencias

- [Google SRE: verificación en release engineering](https://sre.google/sre-book/release-engineering/).
- [Google SRE: evaluar cambios mediante canaries](https://sre.google/workbook/canarying-releases/).
- [Kubernetes: liveness, readiness y startup probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/).

Fuentes consultadas el 25 de octubre de 2026.
