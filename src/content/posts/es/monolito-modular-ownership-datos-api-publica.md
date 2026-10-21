---
id: ARCH-OWNERSHIP
title: 'Monolito modular: quién puede cambiar los datos y por dónde se entra a un módulo'
published: 2026-10-21T10:02:00Z
locale: es
translationKey: architecture-module-ownership
slug: monolito-modular-ownership-datos-api-publica
draft: true
status: draft
level: intermedio
prerequisites: [ARCH-LAYERS, DOMAIN-CONTEXTS]
description: 'Define ownership y un API público para dos módulos del mismo proceso. Comprueba imports entre módulos y protege el estado interno sin confundir encapsulación con permisos o transacciones.'
author: 'Luis Ramírez Calle'
series: 'Arquitectura: dependencias, módulos y despliegues'
tags: [arquitectura, monolito-modular, ownership, typescript, testing]
---

Reporting necesita sumar cotizaciones y encuentra el `Map` donde Shipping las guarda. Leerlo directamente parece cómodo. Cuando también empieza a corregir importes ahí dentro, ya tenemos dos lugares que pueden cambiar los mismos datos por caminos distintos.

Podemos mantener ambos módulos en el mismo proceso y aun así establecer quién confirma una cotización, qué información publica y cómo se construye el resumen. No hace falta interponer HTTP para tener una frontera.

Después de [capas y dependencias](/posts/clean-architecture-capas-direccion-dependencias), cambiamos de escala: de la organización interna de una capacidad a la colaboración entre dos capacidades.

## Ownership significa responsabilidad sobre una decisión y sus cambios

En este ejercicio **Shipping** obtiene y confirma cotizaciones. **Reporting** mantiene un resumen de cuántas se han registrado y qué importe acumulan. Los datos de ambos están relacionados, pero no tienen la misma autoridad.

Shipping decide qué cotización existe como registro confirmado. Reporting puede calcular una representación derivada; no tiene permiso conceptual para modificar el importe original a través de su resumen.

**Data ownership** no significa que nadie más pueda leer información. Significa acordar qué módulo decide las escrituras válidas y por qué contrato colaboran los demás. Puede reflejarse también en responsabilidades de equipo, pero aquí no inventamos una organización empresarial para justificar dos carpetas.

Los [bounded contexts](/posts/bounded-context-limites-modelos) ayudan a pensar en significado. Un límite modular es una decisión de código y responsabilidad; no debemos asumir que todo módulo sea automáticamente un contexto DDD o un microservicio futuro.

## Una fachada pública es un acuerdo de acceso

Shipping expone `public.ts`, que reexporta el caso de uso, tipos, puertos y validadores necesarios en este programa. Reporting tiene su propia fachada y mantiene el algoritmo del resumen en `internal/projection.ts`.

Archivo completo: `packages/architecture-boundaries/src/modules/reporting/public.ts`.

```typescript
export { createSummary } from './internal/projection.ts'
```

El otro módulo no debería importar esa ruta interna. Si cambiamos el archivo donde está implementado el resumen, la fachada puede conservar la entrada pública mientras sus consumidores siguen funcionando.

Esto no obliga a exportar todo desde un único archivo en cualquier proyecto. Aquí el archivo es pequeño y permite automatizar una convención clara. Si termina reexportando cientos de detalles, habrá que revisar la API, no celebrar que existe un barrel.

Tampoco las exportaciones públicas son gratuitas: sus consumidores pueden depender de ellas. Cambiar un validador o un tipo público exige revisar quién lo utiliza, aunque no haya una red entre ambos.

## El almacén pertenece a la capacidad que define su contrato

El adaptador `memoryLedger` vive en `src/adapters`, pero implementa los contratos de Shipping. Su ubicación física no lo convierte en un almacén común que cualquier módulo pueda modificar por dentro.

Mantiene un `Map` de cotizaciones y un array de eventos dentro de una función. No devuelve esas referencias. `record` valida y copia la cotización; `find` devuelve una copia almacenada que ya está congelada; `eventsAfter` devuelve otro array con eventos congelados.

Archivo: `packages/architecture-boundaries/src/adapters/ledger.ts`, extracto de `record`. El contrato y los tipos están en la fuente completa.

```typescript
const quote = parseQuote(input)
if (shouldFail) { shouldFail = false; throw new Error('failure before record') }
if (quotes.has(quote.id)) throw new Error('duplicate quote id')
const event: QuoteRecorded = Object.freeze({ kind: 'QuoteRecorded', sequence: events.length + 1, quote })
quotes.set(quote.id, quote)
events.push(event)
```

La secuencia se asigna dentro del adaptador al confirmar. No la elige Reporting ni el proveedor de tarifas. El fallo inyectado ocurre antes de modificar el estado; el test verifica que no aparece ni registro ni evento.

Los dos cambios finales son síncronos en una instancia del proceso. Esto no demuestra una transacción durable ni recuperación ante una caída entre instrucciones. Para una base de datos habría que implementar y probar el commit pertinente, no trasladar la garantía del fake por analogía.

<img src="/assets/visuals/architecture-boundaries/ARCH-OWNERSHIP.svg" alt="Shipping confirma mediante su contrato en un ledger privado; el composition root entrega los eventos a Reporting, que mantiene un resumen propio sin acceder al Map de cotizaciones." width="327" height="754" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/architecture-boundaries/ARCH-OWNERSHIP.svg).

## El mismo proceso no obliga a compartir todas las estructuras

El composition root obtiene los eventos públicos del ledger y los entrega al resumen. Reporting importa el contrato de evento a través de la fachada de Shipping, no conoce el `Map` ni llama a sus detalles internos.

Eso sigue siendo acoplamiento: conoce el significado y la forma del evento. La diferencia es que depende de un contrato explícito que podemos revisar, en vez de una estructura privada que cambia accidentalmente al refactorizar almacenamiento.

El evento contiene la cotización completa por simplicidad educativa. Si el resumen solo necesitase ID, importe y moneda, un contrato de integración más reducido podría evitar exponer referencias del proveedor. No confundimos «hay un evento» con «ya minimizamos correctamente todos los datos».

La colaboración es local. No hay broker, serialización de mensajes de red o despliegues independientes. Mantener ese recorrido pequeño permite estudiar primero dónde está la autoridad sobre cada dato.

## Qué puede verificar una regla de imports

El checker del laboratorio rechaza que un módulo entre en otro por una ruta distinta de `public.ts`. Los tests incluyen un acceso permitido y otro prohibido.

Archivo: `packages/architecture-boundaries/tests/boundaries.test.mjs`, extracto.

```javascript
assert.equal(checkImport('src/modules/reporting/internal/projection.ts', '../../shipping/public.ts'), 'src/modules/shipping/public.ts')
assert.throws(() => checkImport('src/modules/reporting/internal/projection.ts', '../../shipping/domain.ts'), /public.ts/)
```

Comprobamos también imports reales de tipos y reexports. La convención no depende de que quien revise recuerde todas las rutas privadas.

Pero esto no es una barrera contra código hostil. Los archivos internos siguen estando en el repositorio y el proceso tiene sus capacidades. La política limita dependencias ordinarias verificadas; no reemplaza permisos, aislamiento de procesos o revisión de código.

## Si compartimos base de datos, ownership sigue necesitando reglas

En una aplicación real, dos módulos pueden usar la misma base de datos y mantener ownership sobre tablas o schemas distintos. Evitar que cada uno escriba directamente en las tablas ajenas sigue siendo una decisión importante.

Una carpeta no restringe SQL. Harían falta convenciones comprobables, repositorios o APIs locales apropiadas y, cuando proceda, roles y permisos de base de datos. El laboratorio no tiene SQL ni verifica esos mecanismos.

Compartir una base también puede permitir una transacción local cuando una invariante realmente abarca varios cambios. Si esa coordinación es constante, merece la pena revisar si el límite elegido separa cosas que deberían decidirse juntas. No es obligatorio reemplazar una transacción válida por mensajes solo para que el diseño parezca más modular.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/arch-ownership/README.md), el [ledger](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/architecture-boundaries/src/adapters/ledger.ts) y la [fachada de Reporting](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/architecture-boundaries/src/modules/reporting/public.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/architecture-boundaries boundaries
pnpm --dir packages/architecture-boundaries test
```

## Garantías y límites

Los tests rechazan rutas privadas entre módulos, duplicados y mutaciones ordinarias de las copias expuestas. El estado se conserva solo durante la vida de esa instancia. No se prueba seguridad multi-tenant, aislamiento SQL, durabilidad o independencia de despliegue.

La aplicación pequeña conserva un único proceso y coordinación explícita. No afirma que pueda extraerse un módulo como servicio sin rediseñar contratos y operación.

## Ejercicio: renombrar un detalle sin cambiar consumidores

Mueve la implementación privada del resumen a otro archivo dentro de Reporting y ajusta solo su fachada. Los consumidores deben seguir entrando por `public.ts`, con los mismos resultados y sin modificar Shipping. Después introduce un import privado desde otro módulo y comprueba que el checker lo rechaza.

Seguimos con [CQRS y consistencia del modelo de lectura](/posts/cqrs-modelos-lectura-consistencia): el resumen tiene una autoridad distinta y también puede estar un paso por detrás.

## Referencias

- [Martin Fowler: Monolith First](https://martinfowler.com/bliki/MonolithFirst.html).
- [Alistair Cockburn: límites de Ports and Adapters](https://alistair.cockburn.us/hexagonal-architecture).
- [TypeScript: módulos y exportaciones](https://www.typescriptlang.org/docs/handbook/2/modules.html).

Fuentes consultadas el 21 de octubre de 2026. Las reglas de ownership y la colaboración descrita son decisiones del laboratorio, no una organización desplegada.
