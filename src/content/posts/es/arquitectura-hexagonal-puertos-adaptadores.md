---
id: P045
title: 'Arquitectura hexagonal: cambiar el adaptador sin cambiar el caso de uso'
published: 2026-10-21T10:00:00Z
locale: es
translationKey: architecture-hexagonal-adapters
slug: arquitectura-hexagonal-puertos-adaptadores
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-DIP, DOMAIN-CONTEXTS]
description: 'Cotiza un envío con un fake y con HTTP sin cambiar el caso de uso. Trabaja puertos, traducción, errores y pruebas reales de transporte sin confundir un fixture con un proveedor comercial.'
author: 'Luis Ramírez Calle'
series: 'Arquitectura: dependencias, módulos y despliegues'
tags: [arquitectura, hexagonal, ports-and-adapters, typescript, testing]
---

Una prueba de cotización no debería necesitar un transportista disponible para comprobar que un peso negativo se rechaza. Pero tampoco podemos dar por correcto el cliente HTTP porque el caso de uso funcione con un fake.

Son dos comprobaciones diferentes. La **arquitectura hexagonal**, también llamada **Ports and Adapters**, ayuda a separarlas: el caso de uso expresa la conversación que necesita y un adaptador se encarga de hablar con la tecnología concreta.

La [serie de principios terminaba distinguiendo conocimiento y abstracciones](/posts/dry-duplicacion-conocimiento-abstracciones). Aquí aplicamos esa idea a una frontera real del programa, no a una plantilla de carpetas.

## Un puerto define una conversación, no un protocolo de red

Nuestro nuevo laboratorio obtiene una tarifa de transporte y guarda la cotización. Es un ejercicio independiente del cálculo comercial anterior: no aplica el umbral de envío gratuito ni el recargo. Ahora el precio procede de un proveedor de pruebas.

Archivo: `packages/architecture-boundaries/src/modules/shipping/ports.ts`, extracto. Los tipos se importan desde `domain.ts`; no son respuestas de Fetch.

```typescript
export type RateProvider = { quote: (shipment: Shipment) => Promise<Rate> }
export type QuoteWriter = { record: (quote: DeliveryQuote) => Promise<void> }
export type QuoteReader = { find: (id: string) => Promise<DeliveryQuote | null> }
```

`RateProvider` pide una cotización para un envío válido. Su respuesta expresa céntimos de EUR y una referencia del proveedor. No menciona headers, códigos HTTP, JSON o un SDK.

La palabra «puerto» no se refiere al número TCP del servidor. Describe una capacidad por la que la aplicación conversa con el exterior. [El artículo original de Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture) plantea esa separación entre la aplicación y los dispositivos o servicios que la rodean.

El hexágono no prescribe seis adaptadores, seis capas o seis interfaces.

## El caso de uso coordina sin conocer Fetch

Archivo: `packages/architecture-boundaries/src/modules/shipping/application.ts`, función completa. Los imports de tipos y validadores están en el archivo enlazado.

```typescript
export async function createDeliveryQuote(
  provider: RateProvider,
  writer: QuoteWriter,
  id: string,
  input: unknown,
): Promise<DeliveryQuote> {
  validId(id)
  const shipment = parseShipment(input)
  const rate = parseRate(await provider.quote(shipment))
  const quote = Object.freeze({ id, ...rate })
  await writer.record(quote)
  return quote
}
```

Primero comprueba la entrada. Después solicita una tarifa, valida su representación y confirma la cotización. Solo entonces devuelve éxito.

El parser admite pesos enteros entre 1 y 20000 gramos y las zonas `local` y `remote`. Una tarifa tiene importe entero entre 0 y 1000000000, moneda EUR y referencia alfanumérica con guiones. Son límites del ejercicio, no una descripción universal del transporte.

Validar la tarifa en la aplicación protege su entrada aunque un adaptador o doble incumpla lo prometido. La anotación TypeScript no verifica un JSON ni impide que un test JavaScript entregue un objeto inválido.

Si el proveedor falla, no se guarda una cotización. Si guardar falla, no se devuelve éxito. No hay retries silenciosos ni una tarifa cero usada para esconder una avería.

## Dos lados de la conversación

Un **driving adapter** inicia la operación. En el laboratorio son el programa `demo.ts` y los tests que llaman a la función. No hemos construido un servidor público de nuestra aplicación.

Un **driven adapter** satisface una necesidad de la aplicación. Aquí hay un proveedor de fixture, un cliente HTTP y un almacén en memoria. El programa que los conecta decide cuál entregar al caso de uso.

<img src="/assets/visuals/architecture-boundaries/P045.svg" alt="Un demo o test invoca createDeliveryQuote; el caso de uso depende de RateProvider y puede recibir fixtureProvider sin red o httpRateProvider con transporte HTTP a un proveedor local de pruebas." width="500" height="582" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/architecture-boundaries/P045.svg).

Ese cambio no requiere editar la función de aplicación. No significa que cambiar cualquier proveedor sea gratis: el adaptador necesita traducir su contrato y habría que revisar las diferencias de significado.

## El adaptador HTTP traduce nombres, unidades y fallos

El proveedor de pruebas recibe `grams` y `area` en un POST a `/rate`. Devuelve `price_minor`, `currency_code` y `quote_ref`. Esos nombres no salen del adaptador hacia el caso de uso.

Archivo: `packages/architecture-boundaries/src/adapters/http-provider.ts`, extracto final de la traducción. `data` es el cuerpo ya leído con límite y parseado como JSON.

```typescript
if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('invalid provider body')
const body = data as Record<string, unknown>
return parseRate({ amountMinor: body.price_minor, currency: body.currency_code, providerReference: body.quote_ref })
```

El `as` permite consultar propiedades después de comprobar que es un objeto; no certifica los tipos de sus valores. Esa comprobación la hace `parseRate`. Si llega USD, un importe negativo o una referencia vacía, se rechaza.

También hay decisiones de transporte: solo acepta estado 200, rechaza redirects, exige el media type `application/json`, limita el cuerpo leído a 2048 bytes y utiliza una señal de timeout. [AbortSignal](https://nodejs.org/api/globals.html#class-abortsignal) proporciona el mecanismo de cancelación utilizado por Fetch.

Un timeout cancela nuestra espera. No demuestra que el servidor remoto no haya recibido o procesado la petición. Aquí solo consultamos una tarifa; si fuese un cobro, harían falta idempotencia y reconciliación, no un simple retry.

## Un fake no prueba el adaptador de red

Los tests de aplicación usan `fixtureProvider` y comprueban validación, coordinación y fallos previos a confirmar. Eso permite estudiar la regla sin sockets.

Los tests HTTP levantan además servidores Node reales en `127.0.0.1`, con puertos efímeros. Capturan método, ruta y cuerpo. Devuelven respuestas válidas, 503, redirects, JSON inválido, otra moneda y un cuerpo excesivo. Otro servidor deja la respuesta pendiente para comprobar que el timeout rechaza la operación.

Así verificamos traducción y transporte reales contra un contrato que controlamos. No contactamos a un transportista comercial ni a Stripe sandbox. Una integración real necesitaría contrastar documentación, autenticación, errores, cuotas y garantías.

El adaptador solo permite configurar un origen HTTP de loopback IPv4. Es una restricción del harness para no salir de la máquina, no una política SSRF general ni una configuración de producción con TLS.

## Cuándo aporta esta frontera y cuándo no

Tiene sentido cuando queremos probar la aplicación sin el servicio externo, cuando la traducción tiene reglas propias o cuando hay formas distintas de iniciar la misma operación.

No necesitamos una interfaz para cada función interna. Si un adaptador solo reenvía un objeto idéntico y no protege una decisión relevante, puede añadir archivos sin reducir dependencias.

La arquitectura tampoco hace opcional al proveedor en producción. El fake permite ejecutar pruebas sin él; no genera una tarifa comercial válida cuando el proveedor real está caído. La disponibilidad sigue siendo una decisión del servicio.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p045/README.md), el [caso de uso](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/architecture-boundaries/src/modules/shipping/application.ts) y el [adaptador HTTP completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/architecture-boundaries/src/adapters/http-provider.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/architecture-boundaries test
pnpm --dir packages/architecture-boundaries typecheck
```

## Garantías y límites

Se sustituye un proveedor de fixture por un adaptador HTTP local sin cambiar el caso de uso. Se comprueban sus errores y traducciones. No hay SQL, credenciales, TLS, proveedor comercial, autenticación del usuario ni persistencia entre reinicios.

El laboratorio no cumple la parte de P045 que exige sustituir Stripe sandbox. Demuestra el mecanismo con un proveedor ficticio y deja esa aceptación pendiente, sin equiparar ambas integraciones.

## Ejercicio: otro formato remoto, mismo contrato interno

Añade un proveedor local que devuelva el importe como string decimal de céntimos. Implementa otro adaptador que acepte solo enteros decimales válidos, sin coerciones de strings vacíos o espacios. Conserva los tests de aplicación y añade pruebas HTTP para el nuevo formato.

Continúa con [capas y Clean Architecture](/posts/clean-architecture-capas-direccion-dependencias): además de dibujar una frontera, necesitamos evitar que los imports vuelvan a cruzarla al revés.

## Referencias

- [Alistair Cockburn: Hexagonal Architecture, artículo original](https://alistair.cockburn.us/hexagonal-architecture).
- [Node.js: Fetch y AbortSignal](https://nodejs.org/api/globals.html).
- [TypeScript: compatibilidad estructural](https://www.typescriptlang.org/docs/handbook/type-compatibility.html).

Fuentes consultadas el 21 de octubre de 2026. HTTP se ejecuta realmente, pero solo contra fixtures locales; no hay evidencia de compatibilidad con una API comercial.
