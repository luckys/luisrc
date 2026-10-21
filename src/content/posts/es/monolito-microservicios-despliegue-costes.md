---
id: P046
title: 'De monolito modular a microservicios: qué problema justifica pagar el coste'
published: 2026-10-21T10:04:00Z
locale: es
translationKey: architecture-deployment-costs
slug: monolito-microservicios-despliegue-costes
draft: true
status: draft
level: intermedio
prerequisites: [ARCH-CQRS, DESIGN-REQUIREMENTS]
description: 'Compara módulos y despliegues independientes sin asumir que una arquitectura sea siempre mejor. Examina red, ownership, transacciones, operación y señales concretas para revisar la decisión.'
author: 'Luis Ramírez Calle'
series: 'Arquitectura: dependencias, módulos y despliegues'
tags: [arquitectura, monolito-modular, microservicios, system-design, testing]
---

Shipping y Reporting ya tienen contratos separados. ¿El siguiente paso debería ser desplegarlos como dos servicios? No necesariamente: todavía no hemos identificado un problema que requiera separarlos físicamente.

Tener una frontera lógica permite discutir el despliegue con más información. No convierte la distribución en la fase obligatoria de madurez de una aplicación.

Después de [CQRS y modelos de lectura](/posts/cqrs-modelos-lectura-consistencia), cerramos la serie comparando qué cambia cuando una llamada local pasa a ser una conversación entre procesos.

## Módulo, proceso y despliegue independiente son decisiones distintas

Un **módulo** delimita responsabilidades y acceso al código. Un **proceso** tiene su memoria y ejecución. Un **despliegue independiente** permite publicar una parte sin exigir publicar simultáneamente las demás, siempre que sus contratos sigan siendo compatibles.

Podemos tener muchos módulos en un proceso. También varios procesos que solo puedan actualizarse juntos porque comparten supuestos incompatibles. Añadir contenedores no garantiza independencia.

La descripción de [microservicios de James Lewis y Martin Fowler](https://martinfowler.com/articles/microservices.html) incluye capacidades y despliegues independientes, no simplemente servicios pequeños con endpoints. Esa distinción evita confundir una división de carpetas con una arquitectura operativa.

## Qué podría justificar separar Reporting

Podría aparecer una carga de consultas que necesitase escalar de forma distinta, un ritmo de despliegue independiente o un requisito de aislamiento que el proceso compartido no satisface. Habría que observar el problema, no suponerlo.

Antes de separar por rendimiento, mediríamos dónde se consume tiempo y recursos. Una consulta SQL deficiente no se corrige moviéndola a otro servicio. Antes de separar por autonomía, revisaríamos si los cambios realmente pueden hacerse sin coordinar contratos y datos con Shipping.

En el laboratorio no hay tráfico representativo, equipos con calendarios distintos o incidentes de producción. Por eso la decisión actual conserva un proceso de aplicación. No afirmamos haber demostrado que esa estructura sea óptima para una carga inexistente.

<img src="/assets/visuals/architecture-boundaries/P046.svg" alt="La decisión parte de una necesidad comprobada de carga, despliegue o aislamiento, compara costes de red y operación y conserva módulos en un despliegue mientras no haya evidencia para distribuirlos." width="324" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/architecture-boundaries/P046.svg).

## Lo que una llamada de red añade al contrato

Nuestro adaptador de proveedor ya permite observar parte de ese coste, aunque no represente un microservicio propio. Debe serializar datos, esperar respuesta, limitarla, validar su forma y decidir qué errores propaga.

Archivo: `packages/architecture-boundaries/src/adapters/http-provider.ts`, extracto. `endpoint`, `shipment` y `timeoutMs` se configuran y validan en el archivo completo.

```typescript
const response = await fetch(endpoint, {
  method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ grams: shipment.weightGrams, area: shipment.zone }),
})
```

Una función local también puede fallar, pero normalmente podemos observar su retorno o excepción dentro del mismo proceso. Con red aparece incertidumbre: el otro lado puede completar una operación y perderse la respuesta. Un timeout en el cliente no revierte lo ocurrido en el servidor.

Nuestros tests comprueban 503, redirects rechazados y una respuesta que no llega a completarse antes del timeout. No miden una red entre máquinas ni prueban una estrategia completa de resiliencia. No hemos añadido breakers, retries, tracing o autenticación entre servicios.

Ese es el tipo de trabajo adicional que hay que valorar, en lugar de dar por hecho que un puerto de aplicación ya resuelve toda la distribución.

## Ownership de datos cambia el modo de coordinar escrituras

Un monolito puede coordinar cambios sobre una base de datos dentro de una transacción local si esa base y el diseño lo permiten. No ocurre automáticamente por compartir proceso: nuestro `Map` no es ACID.

Si dos servicios poseen almacenes diferentes, una transacción local de uno no confirma también el cambio del otro. Puede hacer falta redefinir la invariante, usar un protocolo de coordinación o diseñar un proceso con estados intermedios y compensaciones.

No significa que toda arquitectura distribuida esté obligada a ofrecer solo consistencia eventual. Existen mecanismos de coordinación con garantías más fuertes y costes concretos. Lo que no podemos hacer es asumir que dos commits independientes forman una operación atómica.

La serie ya trata [Outbox e Inbox](/posts/transactional-outbox-inbox-eventos) y procesos con recuperación en sus entregas de sistemas distribuidos. Aquí no repetimos esas implementaciones ni llamamos outbox a una lista volátil de eventos.

## Una comparación útil conserva los costes de ambas opciones

<div class="overflow-x-auto" role="region" aria-label="Comparación de costes entre un despliegue modular y servicios separados" tabindex="0">

| Decisión | Un despliegue modular | Servicios desplegables por separado |
| --- | --- | --- |
| Cambio de contrato interno | Coordinado dentro del mismo artefacto | Debe tolerar versiones coexistentes |
| Aislamiento de recursos | Comparte recursos y fallos de proceso | Puede aislarse, con límites bien configurados |
| Datos relacionados | Puede permitir transacción local | Requiere revisar ownership y coordinación |
| Operación | Menos unidades, no cero trabajo | Más unidades, señales y recuperación |

</div>

Las posibilidades no son garantías automáticas. Un servicio sin límites de recursos puede saturar una dependencia compartida. Un monolito puede desplegar varias réplicas y escalar horizontalmente si su estado y sus dependencias lo permiten.

También hay fallos compartidos entre microservicios: base de datos, red, credenciales o librerías con el mismo defecto. Separar procesos reduce ciertos acoplamientos y crea otros. Hay que identificar cuáles importan para el sistema concreto.

## Dos mitos que llevan a decidir antes de mirar el problema

«Un monolito no escala» es un mito. Se pueden usar réplicas, optimizar consultas, separar trabajos y ajustar recursos. Lo que puede limitar una arquitectura es la carga, el estado compartido, las dependencias y cómo se opera, no su etiqueta por sí sola.

«Microservicios significa poder cambiar cualquier cosa sin coordinar» tampoco es cierto. Un contrato incompatible o una tabla compartida que todos modifican puede exigir cambios simultáneos aunque cada componente tenga su pipeline.

El análisis de [Microservice Premium](https://martinfowler.com/bliki/MicroservicePremium.html) ayuda a hacer visible el coste añadido. La discusión de [prerrequisitos operativos](https://martinfowler.com/bliki/MicroservicePrerequisites.html) recuerda que desplegar más unidades exige capacidades de observación y recuperación, no solo escribir endpoints.

No invertimos el mito para declarar que siempre hay que empezar o terminar en un monolito. Un requisito real de aislamiento o equipos con fronteras estables puede justificar servicios desde el principio. Lo importante es explicar ese requisito y el coste que aceptamos.

## Registrar una decisión que podamos reabrir

El laboratorio guarda una ADR que elige un despliegue, dos módulos lógicos y proveedor de fixture o loopback en tests. Es una decisión del ejercicio, no una aprobación de un equipo o una infraestructura desplegada.

Archivo: `packages/architecture-boundaries/docs/decisions/0001-single-deployment.md`, extracto.

```markdown
## Señales para revisar

- Necesidad observada de publicar Reporting sin coordinar su release con Shipping.
- Perfil de carga medido que justifique aislar recursos y no se resuelva con cambios locales.
- Requisito concreto de aislamiento operativo o de datos que el despliegue actual no satisfaga.
```

La ADR también registra alternativas y lo que no se ha medido. Una señal no ejecuta una migración automáticamente: abre otra evaluación. Antes de extraer habrá que diseñar compatibilidad, observabilidad, ownership, recuperación y rollback.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p046/README.md), la [decisión completa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/architecture-boundaries/docs/decisions/0001-single-deployment.md) y los tests de fallos del transporte.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/architecture-boundaries test
pnpm --dir packages/architecture-boundaries boundaries
pnpm --dir packages/architecture-boundaries demo
```

## Garantías y límites

Se ejecutan módulos locales, un read model y un adaptador HTTP contra fixtures. No hay despliegues independientes, medición de capacidad, comparativa de costes cloud, base de datos o migración a microservicios.

La ADR justifica la estructura educativa actual. No demuestra una estrategia de producción ni completa las fichas distribuidas del roadmap. Las pruebas son evidencia del comportamiento implementado, no una votación automática sobre qué arquitectura elegir.

## Ejercicio: proponer una extracción sin implementarla todavía

Escribe una propuesta para separar Reporting. Define quién posee sus datos, cómo recibiría eventos, qué mostraría mientras va por detrás, cómo toleraría versiones distintas y cómo reconstruirías su estado. Identifica una señal medible que justificaría el cambio y un coste que podría hacerlo innecesario.

Usa la guía de [ADR y evidencia](/posts/adr-decisiones-arquitectura-evidencia) para registrar la decisión. Si la propuesta solo enumera tecnologías, todavía falta describir qué problema resuelve.

## Referencias

- [James Lewis y Martin Fowler: Microservices](https://martinfowler.com/articles/microservices.html).
- [Martin Fowler: Microservice Premium](https://martinfowler.com/bliki/MicroservicePremium.html).
- [Martin Fowler: Microservice Prerequisites](https://martinfowler.com/bliki/MicroservicePrerequisites.html).
- [Martin Fowler: Monolith First](https://martinfowler.com/bliki/MonolithFirst.html).

Fuentes consultadas el 21 de octubre de 2026. Las alternativas se comparan conceptualmente; no se inventa un benchmark o despliegue para justificar la elección.
