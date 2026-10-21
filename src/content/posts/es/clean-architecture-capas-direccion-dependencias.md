---
id: ARCH-LAYERS
title: 'Capas y Clean Architecture: la dirección de los imports importa más que los nombres'
published: 2026-10-21T10:01:00Z
locale: es
translationKey: architecture-layers-clean
slug: clean-architecture-capas-direccion-dependencias
draft: true
status: draft
level: intermedio
prerequisites: [P045]
description: 'Distingue capas lógicas, Clean Architecture y despliegue. Comprueba los imports de un laboratorio TypeScript con reglas ejecutables y explica qué no garantiza ese chequeo.'
author: 'Luis Ramírez Calle'
series: 'Arquitectura: dependencias, módulos y despliegues'
tags: [arquitectura, clean-architecture, capas, typescript, testing]
---

Tenemos carpetas llamadas `domain`, `application` e `infrastructure`, pero una regla importa el cliente HTTP. El dibujo dice que el dominio es independiente; el código necesita cargar un detalle de red para utilizarlo.

Cambiar el nombre de la carpeta no arregla esa relación. Necesitamos decidir qué puede conocer cada parte y detectar cuándo una dependencia contradice esa decisión.

En [arquitectura hexagonal](/posts/arquitectura-hexagonal-puertos-adaptadores) separamos conversación y transporte. Ahora revisaremos la estructura interna sin tratar capas, hexágonos y despliegues como si fueran lo mismo.

## Una capa lógica no es necesariamente un servidor

Podemos distinguir presentación, aplicación, reglas y acceso a datos dentro de un único proceso. Son **logical layers**: agrupan responsabilidades y restricciones sobre cómo se relacionan.

Un **tier** de despliegue describe dónde se ejecuta una parte del sistema. Una web, una API y una base de datos pueden estar en procesos distintos, pero eso no nos dice si la lógica comercial está correctamente separada.

Tampoco toda arquitectura en capas implica que el dominio dependa de una implementación SQL. Las capas se pueden organizar con interfaces e inversión de dependencias. «Por capas» y «hexagonal» describen aspectos que pueden coexistir.

La pregunta práctica es qué decisiones quedan en cada parte y qué importa su código. El número de carpetas no responde ninguna de las dos.

## Clean Architecture añade una regla sobre esas dependencias

La **Dependency Rule** de [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) orienta las dependencias de código hacia las políticas internas. Los detalles exteriores se adaptan a sus contratos, no al revés.

Su esquema distingue reglas generales, casos de uso, adaptación y frameworks o drivers. No obliga a reproducir un número fijo de círculos ni a utilizar clases. En nuestro programa pequeño no necesitamos inventar una jerarquía de entidades para representar tres datos.

El criterio se vuelve concreto: `domain.ts` no importa Fetch, Node HTTP o almacenamiento. `application.ts` coordina utilizando esos tipos y los puertos. Los adaptadores conocen las tecnologías y traducen sus datos.

## Los datos internos no son una Response de Fetch

Archivo: `packages/architecture-boundaries/src/modules/shipping/domain.ts`, tipos del ejercicio.

```typescript
export type Shipment = Readonly<{ weightGrams: number; zone: 'local' | 'remote' }>
export type Rate = Readonly<{ amountMinor: number; currency: 'EUR'; providerReference: string }>
export type DeliveryQuote = Readonly<Rate & { id: string }>
export type QuoteRecorded = Readonly<{ kind: 'QuoteRecorded'; sequence: number; quote: DeliveryQuote }>
```

Estos datos expresan el vocabulario de la cotización. No incluyen `statusCode`, `headers`, un cursor SQL o un tipo generado por un SDK. Tampoco impuestos o estados que el ejercicio no contempla.

`Readonly` facilita detectar escrituras accidentales en TypeScript. Los parsers construyen además copias congeladas con primitivos para proteger las instancias del fixture en ejecución. Eso no hace inmutable cualquier estructura anidada.

El adaptador HTTP lee una respuesta de Fetch y traduce sus campos a `Rate`. Si el proveedor cambia `price_minor` por otro nombre, cambia esa traducción; el caso de uso no debería empezar a buscar propiedades remotas.

## La llamada puede salir mientras el import apunta hacia dentro

En ejecución, `createDeliveryQuote` llama al proveedor. El adaptador termina realizando una petición de red. Ese recorrido no obliga a que `application.ts` importe `http-provider.ts`.

La aplicación conoce `RateProvider`, definido en sus puertos. El adaptador importa ese contrato y lo implementa. El composition root conoce ambos para construir y conectar el objeto correcto.

<img src="/assets/visuals/architecture-boundaries/ARCH-LAYERS.svg" alt="Las dependencias de código van de adaptadores a contratos de aplicación y de aplicación a tipos del dominio; la nota distingue estas flechas del orden de ejecución de una petición." width="297" height="754" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/architecture-boundaries/ARCH-LAYERS.svg).

Esta distinción ya aparecía en [DIP e inyección](/posts/dip-inyeccion-dependencias-sin-contenedor). Clean Architecture la utiliza para mantener separadas políticas y mecanismos, no para eliminar todas las dependencias.

## Convertir el acuerdo en una prueba

El laboratorio incluye un checker que utiliza el parser de **TypeScript** para inspeccionar imports y reexports de los seis archivos dentro de `src/modules`. No busca simplemente palabras: distingue declaraciones estáticas y rechaza imports dinámicos que esta política no admite.

Las restricciones de Shipping son explícitas: dominio no importa otros módulos; puertos solo importa dominio; aplicación solo importa dominio y puertos; su fachada pública puede reexportar esos tres archivos.

Un test negativo intenta que dominio importe puertos, aplicación, Node o un adaptador. Otro prueba imports de tipos y reexports indebidos. Esperamos que el checker los rechace, no que el typecheck encuentre necesariamente un problema.

Archivo: `packages/architecture-boundaries/tests/boundaries.test.mjs`, extracto. `checkImport` y `assert` se importan al inicio del test.

```javascript
for (const specifier of ['./ports.ts', './application.ts', 'node:fs', '../../adapters/http-provider.ts'])
  assert.throws(() => checkImport('src/modules/shipping/domain.ts', specifier))
```

No significa que puertos sea un mal lugar. Significa que el dominio no necesita conocer a quien define colaboraciones de aplicación. Estamos haciendo explícita la relación elegida.

## Qué no detecta ese checker

No es un sandbox ni una prueba de pureza. Un archivo podría llamar a un global como `fetch` sin importarlo y este chequeo no lo detectaría. Tampoco verifica autorización, semántica de una interfaz o calidad del modelo.

La política trabaja con rutas relativas y un conjunto local de archivos. Rechaza imports dinámicos en vez de resolverlos y no soporta aliases o todas las formas de cargar código. Si el proyecto incorporase esas opciones, habría que ampliar la herramienta o elegir reglas de análisis adaptadas al repositorio.

Un archivo nuevo dentro de Shipping requiere revisar si debe añadirse a las restricciones por capa. El test que cuenta archivos señala el cambio, pero no decide en qué capa pertenece.

La evidencia es: estos imports cumplen estas restricciones y los ejemplos negativos son rechazados. Sería excesivo concluir que la herramienta garantiza Clean Architecture.

## Cuándo las capas añaden más recorrido del necesario

Una operación CRUD pequeña puede funcionar con un handler, validación y acceso a datos bien delimitado. Añadir un mapper para cada par de objetos idénticos puede hacer que cualquier cambio atraviese más archivos sin proteger una decisión real.

Por otro lado, mantener una regla pura no exige compartir modelos del framework. Podemos empezar con funciones y extraer adaptadores cuando aparece una frontera reconocible, como el proveedor de tarifas.

No se trata de elegir entre «todo junto» y una plantilla completa. Podemos reservar la separación más estricta para las reglas cuyo comportamiento queremos conservar mientras cambian los mecanismos exteriores.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/arch-layers/README.md), el [checker](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/architecture-boundaries/scripts/check-boundaries.mjs) y los tests negativos.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/architecture-boundaries boundaries
pnpm --dir packages/architecture-boundaries test
pnpm --dir packages/architecture-boundaries typecheck
```

## Garantías y límites

Las reglas observan imports y reexports estáticos del fixture. Los tests de aplicación y HTTP observan su comportamiento por separado. Ningún grupo demuestra por sí solo una arquitectura mantenible para cualquier necesidad futura.

No hay ORM, UI, aliases, contenedor de DI o generación de clientes. Los límites por capa no implican procesos distintos ni prueban independencia de despliegue.

## Ejercicio: introducir una dependencia que el test detecte

En una rama de prueba, importa el adaptador HTTP desde `application.ts`. Verifica que `boundaries` falla aunque TypeScript pueda resolver ese import. Devuelve la construcción al composition root y comprueba que ambas verificaciones pasan otra vez.

Después sigue con [ownership en un monolito modular](/posts/monolito-modular-ownership-datos-api-publica). Las capas ordenan decisiones dentro de una capacidad; también necesitamos acordar cómo se relacionan capacidades distintas.

## Referencias

- [Robert C. Martin: The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).
- [Robert C. Martin: A Little Architecture](https://blog.cleancoder.com/uncle-bob/2016/01/04/ALittleArchitecture.html).
- [TypeScript: Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API).

Fuentes consultadas el 21 de octubre de 2026. El checker aplica una política deliberadamente pequeña; no se presenta como un analizador general de proyectos TypeScript.
