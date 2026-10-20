---
id: DESIGN-REQUIREMENTS
title: 'Antes de elegir arquitectura: requisitos, invariantes y capacidad'
published: 2026-10-17T02:00:00Z
locale: es
translationKey: reliable-requirements-capacity
slug: requisitos-capacidad-invariantes-servicio
draft: true
status: draft
level: intermedio
prerequisites: [API-HTTP]
description: 'Convierte necesidades vagas en reglas, escenarios y estimaciones revisables. Calcula concurrencia sin confundir una hipótesis de carga con capacidad medida.'
author: 'Luis Ramírez Calle'
series: 'Diseñar servicios que se puedan cambiar'
tags: [arquitectura, requisitos, capacity-planning, backend]
---

«El servicio debe ser rápido y no duplicar reservas» mezcla dos necesidades que se comprueban de formas distintas. Una pide definir una experiencia aceptable. La otra exige precisar qué identifica una reserva y cuándo dos solicitudes representan la misma intención.

Abrimos **Diseñar servicios que se puedan cambiar** después de [los contratos HTTP](/posts/contratos-http-recursos-operaciones). Antes de discutir capas o microservicios, construiremos un conjunto pequeño de requisitos que permita aceptar o rechazar un diseño.

## Una invariante no es una preferencia de implementación

Una **invariante** es una propiedad que debe mantenerse en los estados considerados válidos. En una reserva de inventario podríamos exigir que las unidades disponibles no sean negativas. En una operación externa, que un estado confirmado no retroceda por un aviso atrasado.

«Usar Redis» no es una invariante. Es una elección de tecnología que podría servir a un requisito o no. «Devolver siempre en menos de 100 ms» tampoco es una definición suficiente: falta decir desde dónde medimos, qué peticiones cuentan y con qué carga.

Una ficha inicial puede separar:

| Necesidad             | Cómo hacerla comprobable                                              |
| --------------------- | --------------------------------------------------------------------- |
| Evitar duplicados     | Repetir la misma intención con una identidad estable y contar efectos |
| No bloquear la UI     | Aceptar trabajo y ofrecer estado consultable cuando corresponda       |
| Recuperarse de caídas | Definir qué estado persiste antes y después de cada efecto            |
| Responder con rapidez | Elegir un SLI, una ventana y una distribución de carga                |

No todos esos requisitos deben resolverse el primer día. Sí deben estar escritos antes de afirmar que una arquitectura los cumple.

<img src="/assets/visuals/reliable-services/DESIGN-REQUIREMENTS.svg" alt="Una necesidad se convierte en escenario e invariante; las hipótesis de carga generan estimaciones que después se contrastan con pruebas." width="562" height="788" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DESIGN-REQUIREMENTS.svg).

## Throughput y concurrencia no son la misma magnitud

**Throughput** expresa trabajo completado por unidad de tiempo. **Concurrencia** cuenta trabajo en curso. Un servicio que recibe 100 solicitudes por segundo y tarda de media 0.2 segundos por solicitud tendría unas 20 solicitudes en curso de media en un sistema estable bajo las condiciones de la ley de Little.

La relación es `L = λ × W`: solicitudes en curso = solicitudes por segundo × segundos por solicitud. No se utiliza p99 en lugar de la media sin cambiar el razonamiento.

Archivo: `reliable-services/src/service.ts` (extracto del cálculo).

```typescript
export function capacity(rps: number, seconds: number): number {
  return rps * seconds
}
```

El test verifica `capacity(100, 0.2) === 20`. Es una **estimación calculada con datos hipotéticos**, no una medición de nuestra API. Tampoco implica 20 conexiones de DB: una solicitud puede usar una conexión solo durante una fracción de su tiempo.

Si la latencia del proveedor sube a dos segundos con la misma tasa, el trabajo pendiente puede multiplicarse. Abrir más conexiones no arregla necesariamente la causa; podría saturar antes la base de datos.

## Estimar almacenamiento obliga a preguntar por retención

Supongamos, de forma hipotética, un millón de eventos diarios y un tamaño medio de 500 bytes por payload. Eso da 500 millones de bytes diarios **solo de payload**. Faltan filas, índices, versiones, WAL, copias, réplicas y espacio operativo.

Una estimación útil registra esas exclusiones. «Cabe en medio giga» sería una conclusión injustificada. También necesitamos saber cuánto se conserva, qué se puede anonimizar o borrar y qué información mínima permite investigar un incidente.

El [particionado y la retención](/posts/particionado-retencion-postgresql) ayudan a operar datos, pero no deciden por sí solos la política del producto.

## Elige una decisión reversible para la incertidumbre actual

Si desconoces el volumen y solo necesitas un API y un worker, un despliegue sencillo con PostgreSQL permite aprender antes que varias bases y servicios. Si existe un requisito real de aislamiento o despliegue independiente, anótalo y evalúa su coste.

Una **ADR**, Architecture Decision Record, puede registrar contexto, alternativas, decisión y consecuencias. No necesita veinte páginas. Lo importante es dejar qué observación justificaría revisarla: por ejemplo, saturación medida de un recurso compartido, no «algún día creceremos».

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-requirements/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

La estimación no demuestra rendimiento, tolerancia a fallos ni coste cloud. La ley de Little describe medias en condiciones apropiadas; no predice por sí sola ráfagas, crecimiento indefinido de colas ni tiempos extremos.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/src/service.ts). Archivo: terminal, desde `reliable-services/`.

```bash
node --test --test-name-pattern="denominador" tests/core.test.mjs
```

## Ejercicio: requisitos que descarten una solución

Escribe tres invariantes y tres hipótesis de carga para una API de reservas. Define para cada una una prueba y una condición de fallo. Si «procesar dos veces el mismo mensaje» no tiene un resultado esperado explícito, el contrato está incompleto.

Seguimos con [un monolito modular y dependencias pequeñas](/posts/monolito-modular-solid-sin-sobreingenieria).

## Referencias

- [Google SRE: objetivos de servicio y medición](https://sre.google/sre-book/service-level-objectives/).
- [John D. C. Little: A Proof for the Queuing Formula L = λW](https://doi.org/10.1287/opre.9.3.383).
- [C4: diagramas para comunicar arquitectura](https://c4model.com/diagrams).

Fuentes consultadas el 17 de octubre de 2026. Todas las cifras de capacidad de esta entrega son hipotéticas.
