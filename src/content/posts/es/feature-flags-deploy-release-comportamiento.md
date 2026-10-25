---
id: CD-FLAGS
title: 'Feature flags: separar el deploy del comportamiento que reciben los usuarios'
published: 2026-10-25T13:02:00Z
locale: es
translationKey: progressive-delivery-flags
slug: feature-flags-deploy-release-comportamiento
draft: true
status: draft
level: intermedio
prerequisites: [CD-ARTIFACTS]
description: 'Activa y retira comportamiento sin reconstruir la image. Un router real muestra el estado de una flag, sus revisiones y sus límites: apagarla no deshace datos ni equivale a un control de acceso.'
author: 'Luis Ramírez Calle'
series: 'CI/CD: entregar cambios y conservar una vuelta atrás'
tags: [feature-flags, deployment, release, testing]
---

La nueva image ya está ejecutándose y, sin embargo, los usuarios siguen recibiendo el comportamiento anterior. No es necesariamente un despliegue incompleto: puede ser una forma deliberada de comprobar el entorno antes de activar una función.

Una **feature flag** permite decidir qué comportamiento se ejecuta sin reconstruir el artefacto. Después de [identificar las images](/posts/artefactos-inmutables-promocion-rollback), vamos a separar esa decisión de la instalación y a comprobar qué ocurre cuando una flag se apaga.

## Deploy instala una versión; release expone un comportamiento

Un **deploy** pone una versión en un entorno. Un **release** hace accesible un comportamiento a los usuarios que correspondan. Pueden coincidir, pero separarlos permite preparar una versión y ampliar su exposición después.

En el laboratorio, `green` ejecuta la image candidata mientras el router sigue enviando las peticiones de prueba a los slots estables. Además, la flag empieza desactivada. Son dos controles diferentes: elegir qué instancia atiende y elegir qué rama de comportamiento ejecuta esa instancia.

Podríamos dirigir tráfico a `green` con la flag apagada. Veríamos la revisión nueva respondiendo con el precio anterior. Más adelante activaremos la rama defectuosa y la volveremos a desactivar manteniendo el mismo image ID.

## Una flag introduce estados que deben probarse

`src/product.ts` contiene una función deliberadamente sencilla:

```typescript
export function priceForResponse(cents: number, enabled: boolean, divisor: number) {
  return enabled ? Math.round(cents / divisor) : cents
}
```

La release estable fija divisor uno. La candidata fija cien para introducir el fallo: al activarse, transforma `10000` en `100`, pero la API sigue devolviendo un campo llamado `priceCents`.

Esta conversión es **incorrecta a propósito**. No es una recomendación para implementar precios. Nos permite observar una regresión que conserva el status HTTP y el tipo numérico.

Las pruebas incluyen ambos estados y un valor conocido:

```javascript
  assert.equal(priceForResponse(10000, false, 1), 10000)
  assert.equal(priceForResponse(10000, false, 100), 10000)
  assert.equal(priceForResponse(10000, true, 100), 100)
```

La última aserción documenta el contraejemplo del fixture; otra prueba exige que el smoke rechace ese resultado. Si solo probáramos la flag apagada, la release candidata parecería correcta.

Con varias flags crecen las combinaciones. No siempre hace falta probarlas todas, pero sí identificar las interacciones posibles, las combinaciones soportadas y las que deben rechazarse. Mantener flags antiguas sin necesidad añade estados que el equipo debe seguir comprendiendo.

<img src="/assets/visuals/progressive-delivery/CD-FLAGS.svg" alt="La image candidata ya desplegada devuelve 10000 céntimos con la flag apagada. Al activarla devuelve 100 incorrectos; apagarla otra vez recupera la lectura correcta sin cambiar la identidad de la image." width="291" height="556" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/progressive-delivery/CD-FLAGS.svg).

## La decisión de exposición necesita una autoridad clara

El router recibe cambios por un canal **IPC privado del fixture**, con una revisión esperada. Primero valida el estado nuevo y sus destinos; después lo aplica y aumenta la revisión. Si llega una revisión antigua, rechaza el cambio sin sustituir el estado vigente.

Eso evita que un cambio atrasado deshaga otro más reciente dentro de este proceso. No es una base distribuida de configuración ni una garantía de propagación entre varias regiones.

Para cada petición, el router toma una referencia al estado elegido y transmite la decisión a la API mediante una cabecera interna. Ignora cualquier intento del cliente de imponer esa cabecera. El test del router verifica que enviar `x-lab-price-v2: 1` desde el cliente no activa la flag si la política vigente la mantiene apagada.

La cabecera es un mecanismo didáctico en una red local controlada. Los puertos de API están ligados al loopback del host, y el harness puede acceder directamente a ellos para verificar escrituras. Un sistema real necesitaría definir la frontera de confianza y evitar rutas que eludan su política.

## Una feature flag no es autorización

Activar una función para una cohorte responde a «qué variante le ofrecemos». Comprobar si una persona puede acceder a un recurso responde a «qué operaciones tiene permitidas». Son decisiones que pueden necesitar contextos y reglas diferentes.

En este fixture, las claves de cohorte son sintéticas y no representan usuarios autenticados. El hash determina una asignación estable para la prueba, no una identidad ni un permiso. Conocer o cambiar una clave de prueba no debería usarse como modelo de acceso a datos privados.

Si una función expone datos sensibles, su autorización debe mantenerse aunque la flag esté encendida. Apagar una flag tampoco revoca automáticamente credenciales ni cierra sesiones existentes.

## Apagar la flag puede mitigar sin deshacer lo ocurrido

Después de forzar la regresión dentro del entorno desechable, el ejercicio apaga la flag y ejecuta el smoke. Las lecturas vuelven a devolver el precio esperado y se inspecciona que `green` conserva la image candidata.

Eso prueba recuperación de esta lectura. No hay efectos externos ni actualizaciones de precios que revertir: el fallo solo altera la respuesta HTTP. Si la rama hubiera enviado correos o escrito importes incorrectos, apagarla detendría nuevas ejecuciones, pero no repararía esos efectos anteriores.

La vuelta de comportamiento y el rollback de image se verifican en eventos distintos. Mantener esa separación ayuda a decidir qué acción reduce el impacto y qué trabajo de corrección sigue pendiente.

## Cada flag necesita dueño, motivo y retirada

Una flag temporal debería tener un propósito, un valor por defecto, un responsable y una condición de retirada. Para una flag de release, la condición podría ser haber completado el despliegue y el periodo de observación acordado.

También hay que decidir qué hacer si falta la configuración. Un valor por defecto conservador puede ser útil, pero depende de la función: desactivar un control de seguridad por no leer su flag sería una mala política.

Este router conserva estado en memoria y recibe órdenes del harness. No implementa un servicio de flags, persistencia de cambios ni un sistema de aprobaciones. La captura sí registra revisiones, estados y resultados de las decisiones probadas.

## Código completo y pruebas

Consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/progressive-delivery/README.md) y el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/cd-flags/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/progressive-delivery run test
pnpm --filter @luisrc-examples/progressive-delivery run exercise
```

Compara `forced_negative_release` y `flag_disabled`: el resultado cambia y la image candidata permanece. El primero se fuerza exclusivamente como prueba negativa, después de haber retirado el canary que falló.

## Garantías y límites

Se comprobaron los dos estados, rechazo de una revisión atrasada y decisión impuesta por el router sobre la cabecera del cliente. Apagar la flag restauró las lecturas del fixture sin reconstrucción.

No se probaron propagación distribuida, cachés de configuración, SDK de proveedor ni cambios persistentes. Tampoco se repararon datos dañados: este caso no los modifica al calcular la respuesta.

## Ejercicio: diseñar la retirada antes de añadir otra condición

Describe una flag de release temporal y una flag operativa de emergencia. Para cada una decide valor por defecto, responsable, pruebas de ambos estados y qué evidencia permite retirarla o mantenerla. Añade qué efectos anteriores seguirían pendientes aunque consiguieras apagarla.

## Referencias

- [Pete Hodgson: Feature Toggles, categorías y coste de mantenimiento](https://martinfowler.com/articles/feature-toggles.html).
- [Google SRE: preparación y control de lanzamientos](https://sre.google/sre-book/reliable-product-launches/).
- [GitHub: configuración y control de deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).

Fuentes consultadas el 25 de octubre de 2026.
