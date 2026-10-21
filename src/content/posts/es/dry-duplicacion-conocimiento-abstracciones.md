---
id: DESIGN-DRY
title: 'DRY: cuándo dos fragmentos repiten una regla y cuándo solo se parecen'
published: 2026-10-21T09:06:00Z
locale: es
translationKey: design-dry-knowledge
slug: dry-duplicacion-conocimiento-abstracciones
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-SIMPLICITY]
description: 'Distingue duplicación de conocimiento y parecido sintáctico. Compara dos políticas independientes y una validación compartida, con tests de sus límites y del cambio aislado.'
author: 'Luis Ramírez Calle'
series: 'Principios de diseño sin sobreingeniería'
tags: [diseno-software, dry, abstracciones, typescript, refactoring, testing]
---

Dos políticas comparan días transcurridos con un límite y devuelven un booleano. Parece una oportunidad evidente para extraer una función común. Pero una permite devolver un paquete entregado y la otra reembolsar una descarga que no se ha utilizado.

Se parecen al escribirlas; no representan necesariamente la misma decisión. Unificarlas demasiado pronto puede hacer que cambiar una política obligue a entender también la otra.

Esta entrega cierra la serie de principios después de [KISS y YAGNI](/posts/kiss-yagni-diseno-necesidad-actual). Vamos a separar la duplicación que provoca divergencias de la coincidencia que conviene mantener independiente.

## DRY habla de conocimiento, no de contar líneas repetidas

**Don't Repeat Yourself**, o **DRY**, busca evitar representaciones independientes del mismo conocimiento que deban mantenerse sincronizadas. [Hunt y Thomas lo explican en el extracto publicado de The Pragmatic Programmer](https://media.pragprog.com/titles/tpp20/dry.pdf).

Si el mismo umbral comercial está escrito en tres rutas y debe cambiar a la vez, existe riesgo de corregir dos y olvidar la tercera. El problema no es que aparezca tres veces el número, sino que cada copia actúa como una definición independiente de la misma regla.

En cambio, dos políticas pueden tener hoy el mismo límite por razones diferentes. Si mañana cambia una y la otra no, compartir una constante podría introducir una dependencia que no existía en el negocio.

## Dos reglas ficticias, dos significados distintos

El laboratorio añade un ejercicio separado de la cotización de portes: decidir elegibilidad de devolución. No es una integración completa con el modelo DDD anterior ni interpreta normativa real.

La política de paquetes exige que conste la entrega y que hayan transcurrido como máximo 30 días. La de descargas exige que no se haya descargado el contenido y que hayan transcurrido como máximo 14 días. Los días ya llegan calculados como enteros no negativos.

Archivo: `packages/design-principles/src/eligibility.ts`, extracto. `validElapsedDays` se define en el mismo módulo.

```typescript
export function parcelReturnAllowed(elapsedDays: number, delivered: boolean): boolean {
  validElapsedDays(elapsedDays)
  if (typeof delivered !== 'boolean') throw new Error('invalid delivery flag')
  return delivered && elapsedDays <= 30
}

export function downloadRefundAllowed(elapsedDays: number, downloaded: boolean): boolean {
  validElapsedDays(elapsedDays)
  if (typeof downloaded !== 'boolean') throw new Error('invalid download flag')
  return !downloaded && elapsedDays <= 14
}
```

Hay una comparación temporal en ambas, pero los flags tienen significado contrario. `delivered` debe ser verdadero y `downloaded` debe ser falso. Llamar a ambos `condition` permitiría escribir menos código a costa de perder esa información.

También tienen responsables y motivos de cambio potencialmente distintos. Para este ejercicio decidimos que son políticas independientes. No necesitamos demostrarlo con una historia empresarial inventada: es parte explícita del escenario que queremos modelar.

## Qué sí compartimos: una condición de representación idéntica

Ambas funciones reciben días enteros no negativos y rechazan fracciones, infinitos, `NaN` o negativos. Esa condición significa lo mismo en las dos.

Archivo: `packages/design-principles/src/eligibility.ts`, extracto.

```typescript
function validElapsedDays(days: number): void {
  if (!Number.isSafeInteger(days) || days < 0) throw new Error('invalid elapsed days')
}
```

Compartir esta validación evita mantener dos definiciones distintas de qué representación admitimos. No reúne los plazos ni las precondiciones comerciales. El helper queda privado en el mismo módulo porque no existe todavía una necesidad de publicarlo como utilidad global.

Si en el futuro una política necesitase horas con fracciones y la otra siguiese usando días enteros, ya no compartirían esa representación. Habría que revisar el contrato, no forzar ambos datos a pasar por el mismo helper.

<img src="/assets/visuals/design-principles/DESIGN-DRY.svg" alt="Las políticas de paquetes y descargas comparten la validación de días enteros no negativos, pero mantienen separados el límite temporal y el significado de entrega o descarga." width="515" height="378" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/design-principles/DESIGN-DRY.svg).

## La función genérica puede trasladar la regla al lugar equivocado

Podríamos introducir `eligible(days, limit, condition)` y pasarle 30 con `delivered`, o 14 con `!downloaded`. La función haría una comparación y una conjunción; quien la usa seguiría teniendo que construir la política.

No es necesariamente incorrecto, pero aporta poco aquí. Si cada pantalla tuviese que repetir qué límite y qué flag enviar, habríamos movido la duplicación de conocimiento a los consumidores. Si conservamos wrappers con nombres de negocio, quizá el helper genérico ni siquiera reduzca complejidad relevante.

El peligro crece al añadir parámetros como `inclusive`, `invertCondition` o `ignoreWhenMissing`. Un único punto de código puede terminar representando varias políticas mediante combinaciones difíciles de revisar.

Antes de extraerlo preguntaría qué invariantes comparten de verdad y qué cambios deberían afectarlas a la vez. «Ambas tienen un `<=`» no responde ninguna de las dos preguntas.

## Contrasta con la tarifa y su recargo: ahí sí hay una regla reutilizada

La variante de portes se define como tarifa base más 200. Si cambia la tarifa base, la variante debe utilizar el nuevo cálculo. Esa dependencia es intencional.

Por eso `withSurcharge` llama a `base` en vez de copiar sus ramas. Si duplicásemos la condición de envío gratuito y los precios de las zonas dentro de otra función, tendríamos que sincronizar dos representaciones del mismo cálculo.

No obstante, el repositorio conserva una copia en `legacyPreview`. Tiene un propósito distinto: representar el antes en las pruebas de caracterización. No es una segunda política que debamos invocar desde nuevas funciones. Si cambiamos el requisito comercial, la comparación histórica deberá revisarse o retirarse con intención.

Esta es otra razón para no evaluar DRY con un detector de líneas repetidas. Una fixture histórica, una expectativa y el código de producción pueden contener números iguales por motivos diferentes.

## Los tests necesitan expectativas independientes

Si probamos el umbral usando la misma constante y fórmula que el código, un cambio accidental podría modificar ambas partes y dejar el test verde. El test debe expresar el comportamiento esperado, no volver a ejecutar la implementación bajo otro nombre.

Por eso las pruebas comprueban directamente que el día 30 permite devolver el paquete, el 31 no, el 14 permite el caso de descarga no usada y el 15 no. También comprueban que la entrega o el uso cambian la decisión aunque estemos dentro del plazo.

Repetir esos valores como expectativas no los convierte en una configuración alternativa de la aplicación. Sirve para detectar que la implementación ya no respeta el ejemplo acordado. Los nombres del test y el requisito deben explicar de dónde salen.

Las validaciones de días inválidos se ejecutan contra ambas políticas. Si en una se dejase de invocar el helper, la prueba podría detectar que una representación rechazada en la otra ya se está aceptando.

## Cómo introducir o retirar una abstracción sin mezclar cambios

Primero escribe los casos que definen cada política. Después extrae solo el comportamiento común cuya identidad puedas justificar. Ejecuta otra vez los casos, incluidos aquellos donde las políticas divergen.

Si una abstracción ya requiere muchos flags, puedes devolver temporalmente las decisiones a funciones independientes, mantener sus tests y observar qué parte sigue siendo realmente compartida. Duplicar unas líneas durante ese refactor puede facilitar descubrir el límite correcto.

No hay un número universal de repeticiones que obligue a extraer. Tres copias pueden representar tres decisiones distintas; dos pueden ser suficientes para producir una divergencia peligrosa. La pregunta sigue siendo qué conocimiento debe cambiar a la vez.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-dry/README.md), las [políticas completas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/src/eligibility.ts) y los casos de borde.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/design-principles test
pnpm --dir packages/design-principles typecheck
```

## Garantías y límites

Los ejemplos distinguen validación compartida, políticas independientes y reutilización intencional de una tarifa. No calculan días desde fechas, no contemplan zonas horarias y no establecen derechos de devolución. Los plazos son ficticios, no asesoramiento legal.

Las pruebas muestran decisiones y límites concretos. No miden cuánto mantenimiento ahorra una abstracción ni pueden decidir automáticamente qué conceptos pertenecen al mismo dominio.

## Ejercicio: cambiar una política y conservar la otra

Cambia únicamente el plazo del paquete de 30 a 45. Actualiza sus expectativas y añade casos para 45 y 46. Las pruebas de descargas deben conservar exactamente su comportamiento anterior sin modificar sus parámetros ni su código.

Después revisa si tu abstracción permite explicar ese cambio de forma local. Para continuar la ruta de arquitectura, vuelve a [contextos y modelos](/posts/bounded-context-limites-modelos): nombrar qué pertenece junto prepara la discusión de puertos, adaptadores y límites de módulos.

## Referencias

- [Dave Thomas y Andy Hunt: The Evils of Duplication, extracto de The Pragmatic Programmer](https://media.pragprog.com/titles/tpp20/dry.pdf).
- [Martin Fowler: Yagni](https://martinfowler.com/bliki/Yagni.html).

Fuentes consultadas el 21 de octubre de 2026. Los escenarios, código y elecciones de extracción pertenecen a este laboratorio educativo.
