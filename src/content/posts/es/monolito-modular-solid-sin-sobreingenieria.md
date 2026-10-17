---
id: DESIGN-MODULES
title: 'Un monolito modular sin ceremonia: SOLID, puertos y decisiones pequeñas'
published: 2026-10-17T02:01:00Z
locale: es
translationKey: reliable-modular-design
slug: monolito-modular-solid-sin-sobreingenieria
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-REQUIREMENTS]
description: 'Separa reglas e infraestructura con funciones e interfaces pequeñas. Aplica SOLID, KISS y YAGNI sin fabricar capas ni microservicios que no necesitas.'
author: 'Luis Ramírez Calle'
series: 'Diseñar servicios que se puedan cambiar'
tags: [arquitectura, solid, typescript, monolito-modular]
---

Una prueba de «no aceptar importes negativos» necesita levantar HTTP, PostgreSQL y un proveedor remoto. La regla es pequeña; el acoplamiento la ha vuelto cara de comprobar. Podemos corregir esa dependencia sin convertir el proyecto en una colección de servicios.

Después de [requisitos y capacidad](/posts/requisitos-capacidad-invariantes-servicio), elegiremos una estructura proporcional: **monolito modular**, reglas comprobables y adaptadores donde haya una frontera real.

## Un módulo agrupa una razón para cambiar

Podemos organizar el servicio en pedidos, operaciones externas y notificaciones. Cada módulo publica funciones o contratos pequeños y evita que otros escriban directamente en sus detalles internos.

La **cohesión** describe cuánto pertenecen juntas sus responsabilidades. El **acoplamiento** refleja cuánto depende una parte de decisiones de otra. Tener muchas carpetas no garantiza ninguna de las dos cosas: un módulo que consulta tablas y utilidades privadas de todos los demás sigue estando fuertemente acoplado.

Un monolito modular comparte despliegue, no necesariamente todas las decisiones internas. Facilita una transacción local cuando hace falta y evita introducir red entre funciones que todavía cambian juntas.

<img src="/assets/visuals/reliable-services/DESIGN-MODULES.svg" alt="El adaptador HTTP invoca un caso de uso que depende de un contrato pequeño de escritura; un adaptador PostgreSQL implementa ese contrato y las reglas no importan el router." width="763" height="652" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DESIGN-MODULES.svg).

## Invertir una dependencia sin un contenedor de DI

Archivo: `servicios-fiables/src/service.ts` (extracto).

```typescript
type Order = { id: string; money: Money; status: 'created' }
type OrderWriter = { save: (order: Order) => Promise<unknown> }

export async function createOrder(
  writer: OrderWriter,
  id: string,
  input: unknown,
): Promise<Order> {
  const order: Order = { id, money: parseCommand(input), status: 'created' }
  await writer.save(order)
  return order
}
```

El caso de uso decide qué necesita: guardar el pedido y esperar confirmación. No importa un cliente de PostgreSQL ni una clase del framework. Esa es la idea útil de **Dependency Inversion** aquí. Un parámetro basta para **dependency injection**.

La interfaz es estrecha, pero debe tener semántica. ¿Qué significa que `save` termine? ¿Qué errores propaga? Un adaptador que confirma antes de escribir y otro que espera al commit no son intercambiables solo porque tengan la misma firma.

## SOLID como preguntas de revisión

**SRP** invita a separar razones de cambio: serialización HTTP y reglas de pedido no suelen cambiar por la misma necesidad. **OCP** ayuda a introducir variaciones mediante contratos estables; no exige anticipar todos los proveedores posibles.

**LSP** pide que una sustitución mantenga el comportamiento prometido, incluida la semántica de errores. **ISP** evita obligar al consumidor a depender de operaciones que no utiliza. **DIP** evita que las reglas centrales queden subordinadas a detalles de infraestructura.

No necesitas una clase por letra. Una función pura y un objeto con un método pueden satisfacer mejor el problema que una jerarquía de diez clases.

**KISS** favorece entender el recorrido del dato. **YAGNI** evita añadir una abstracción para una variación que no existe. **DRY** no obliga a unir dos bloques parecidos si representan reglas distintas que probablemente evolucionen por separado.

## Qué no hace falta copiar de otras arquitecturas

Los términos **puerto** y **adaptador** describen la frontera, no una plantilla obligatoria de carpetas. Una arquitectura hexagonal puede ayudar a comunicarla; una organización por módulos y capas también puede funcionar si mantiene la dirección de dependencias.

Del modelado de dominio aprovechamos vocabulario e invariantes. No imponemos DDD completo, repositorios genéricos ni un Aggregate Root para cada tabla. Una entidad tiene identidad y una vida que importa al negocio; un pequeño value object puede proteger una representación. Usamos esas ideas cuando aclaran algo.

Tampoco partimos en microservicios para «escalar después». Un despliegue independiente puede justificarlo si existe aislamiento organizativo u operativo real. A cambio aparecen fallos parciales, contratos de red, ownership de datos y más operación.

## Garantías y límites

El test sustituye el writer por un fake y verifica que un fallo no devuelva una creación exitosa. No demuestra que el adaptador SQL tenga la semántica correcta; eso requiere una prueba de integración. Desacoplar hace posible probar por separado, no elimina esa obligación.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Desde `servicios-fiables/`:

```bash
node --test --test-name-pattern="caso de uso" tests/core.test.mjs
```

## Ejercicio: una ADR de diez líneas

Documenta por qué eliges monolito modular frente a tres servicios. Incluye una alternativa, un coste de la decisión y un hecho observable que justificaría revisarla. Después comprueba que puedes ejecutar la regla de creación sin red ni DB.

La siguiente entrega define [qué transiciones admite una operación](/posts/maquinas-estados-reglas-negocio).

## Referencias

- [Alistair Cockburn: arquitectura hexagonal](https://alistair.cockburn.us/hexagonal-architecture).
- [C4: contexto, contenedores y componentes](https://c4model.com/diagrams).
- [David Parnas: On the Criteria To Be Used in Decomposing Systems into Modules](https://doi.org/10.1145/361598.361623).

Fuentes consultadas el 17 de octubre de 2026. Las decisiones de estructura son recomendaciones para este alcance, no reglas universales.
