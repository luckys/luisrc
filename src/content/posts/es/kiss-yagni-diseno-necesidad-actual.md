---
id: DESIGN-SIMPLICITY
title: 'KISS y YAGNI: resolver la necesidad actual sin cerrar el siguiente cambio'
published: 2026-10-21T09:05:00Z
locale: es
translationKey: design-kiss-yagni
slug: kiss-yagni-diseno-necesidad-actual
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-DIP]
description: 'Decide cuándo basta una condición y cuándo extraer una variación. Aplica KISS y YAGNI sin confundir simplicidad con omitir validación, pruebas o requisitos reales.'
author: 'Luis Ramírez Calle'
series: 'Principios de diseño sin sobreingeniería'
tags: [diseno-software, kiss, yagni, refactoring, typescript, testing]
---

Para calcular portes en dos zonas podríamos construir un motor de reglas configurable, un registro de estrategias y un sistema de prioridades. Resolvería el caso actual, pero también nos obligaría a entender capacidades que nadie necesita todavía.

Podemos empezar con dos decisiones legibles y tests de sus límites. Si aparece una variación real, la añadimos donde corresponda. La dificultad está en distinguir esa prudencia de dejar problemas conocidos para después.

Después de [DIP e inyección](/posts/dip-inyeccion-dependencias-sin-contenedor), esta entrega pone un límite al entusiasmo por las abstracciones. Tener una herramienta no convierte su uso en un requisito.

## KISS: sencillo de entender, no necesariamente corto

**KISS** se utiliza como criterio para mantener el diseño sencillo. Aquí significa que una persona pueda seguir la regla, reconocer sus condiciones y comprobar sus resultados sin reconstruir un framework propio.

No lo medimos por el mínimo número de líneas. Una expresión con cuatro ternarios puede ocupar menos espacio que varias condiciones y exigir más esfuerzo para revisarla.

Tampoco significa juntar todo en una función. Si el cálculo obliga a iniciar una base de datos para probar un umbral, esa aparente sencillez está trasladando complejidad al entorno de ejecución y a las pruebas.

La pregunta útil es qué necesita entender quien mantiene este comportamiento. Consideramos el código, su configuración, el recorrido de datos y cómo detectar un error. Ahorrar una línea no compensa esconder una decisión comercial.

## La regla actual cabe en dos decisiones

Archivo: `packages/design-principles/src/rates.ts`, extracto. `Shipment` representa una entrada previamente validada.

```typescript
export function standardRate(shipment: Shipment): number {
  if (shipment.subtotalMinor >= 5000) return 0
  return shipment.zone === 'local' ? 500 : 900
}
```

La primera condición aplica el envío gratuito a ambas zonas. Si no se cumple, la segunda elige entre 500 y 900 céntimos. La regla se puede leer en el mismo orden en que toma sus decisiones.

La rama final supone que la zona ya es válida. `parseShipment` rechaza cualquier otra, y `quoteWith` lo invoca antes de ejecutar la tarifa. Usar `standardRate` directamente con un objeto arbitrario desde JavaScript incumpliría esa precondición. No se trata de confiar en que una anotación TypeScript valide JSON.

El peso forma parte del envío aceptado y permite estudiar contratos en el laboratorio, pero esta tarifa no cambia con él dentro del rango admitido. No inventamos un cálculo por kilos solo porque el dato esté disponible.

Para dos zonas no necesitamos una tabla cargada de red ni una jerarquía de clases. Si apareciesen muchas zonas con precios administrables, el problema sería distinto: entonces una tabla, su validación y su forma de actualizarse podrían aportar algo.

## YAGNI: no construir capacidades por una necesidad supuesta

**You Aren't Gonna Need It**, o **YAGNI**, cuestiona desarrollar ahora una capacidad cuya necesidad solo suponemos. [Martin Fowler explica el criterio y sus costes](https://martinfowler.com/bliki/Yagni.html): una función futura también añade trabajo de construcción, mantenimiento y comprensión mientras no se utiliza.

En este ejemplo no añadimos tarifas por país, reglas versionadas ni conversión de divisas «por si crecemos». Carecemos de requisitos para decidir cómo deberían funcionar, así que probablemente estaríamos fijando supuestos que después habría que deshacer.

Eso no impide pensar en el siguiente cambio. Podemos mantener la regla localizada, nombres que expresen unidades y tests claros. Esas decisiones ayudan a cambiar código presente sin implementar capacidades futuras.

## Entonces, ¿por qué sí creamos withSurcharge?

Porque la serie plantea una necesidad concreta: conservar la tarifa normal y ofrecer otra opción con 200 céntimos adicionales. Hay dos comportamientos que queremos utilizar y comparar ahora.

La función compositora tiene un coste pequeño y reconocible. A cambio evita duplicar el cálculo base en la variante. No se creó un motor de plugins para justificarla: la configuración sigue siendo una llamada visible en `demo.ts`.

<img src="/assets/visuals/design-principles/DESIGN-SIMPLICITY.svg" alt="La necesidad de dos zonas se resuelve con standardRate; cuando aparece un recargo confirmado se añade withSurcharge reutilizando la base, sin anticipar un registro de plugins." width="473" height="582" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/design-principles/DESIGN-SIMPLICITY.svg).

También podríamos haber usado una función específica que calculase esa opción. No afirmamos que toda variación deba ser un wrapper. Elegimos esta composición porque la regla ficticia dice exactamente «base más recargo» y queremos conservar ambas funciones.

El punto no es acertar la arquitectura definitiva a la primera. Es poder explicar qué necesidad actual paga el coste de cada pieza.

## YAGNI no permite ignorar requisitos de seguridad o corrección

Rechazar entradas inválidas no es una capacidad especulativa si ya recibimos datos externos. Los tests del umbral tampoco son una apuesta sobre futuras funciones: protegen el comportamiento que estamos implementando.

Si un servicio real guarda datos personales, necesita protegerlos aunque aún tenga pocos usuarios. Si un proceso de cobro debe resistir duplicados, no puede posponerlo con el argumento de que primero hará una versión sencilla. Son condiciones del problema, no adornos arquitectónicos.

Nuestro laboratorio no tiene pagos ni identidades. Por eso puede prescindir de esos mecanismos, declarándolo. Esa decisión no sería trasladable sin más a una aplicación que sí los tuviese.

También conviene distinguir decisiones reversibles de compromisos costosos. Extraer una función local suele poder hacerse después. Diseñar un contrato público, migrar datos o exponer información confidencial exige pensar antes en compatibilidad y riesgos. YAGNI no convierte todas las decisiones en igual de reversibles.

## Un registro pequeño de decisiones resulta más útil que «ya escalaremos»

Para este laboratorio podemos anotar cuatro hechos: hoy solo hay EUR; los precios son constantes del ejercicio; las cotizaciones se guardan en memoria; no hay comunicación con proveedores.

Y podemos definir señales para revisar esas elecciones: una segunda moneda confirmada, precios que deban cambiar sin desplegar, persistencia entre reinicios o una integración externa real. La señal describe un cambio de necesidad, no una fecha arbitraria.

No hace falta implementar la respuesta a cada señal ahora. Registrar el límite impide que una simplificación educativa termine interpretándose como una garantía de producción.

## Refactorizar y añadir una función no son el mismo paso

El refactor del primer artículo conserva la salida de `legacyPreview` en una matriz de casos. El recargo de OCP introduce un comportamiento nuevo. Conviene mantener esa distinción al escribir los tests y revisar el cambio.

Si cambiamos estructura y tarifa al mismo tiempo, un fallo puede deberse a cualquiera de las dos cosas. Si primero preservamos el comportamiento y después añadimos el recargo con expectativas nuevas, podemos localizar mejor el desacuerdo.

Las pruebas no resuelven por nosotros qué diseño será más mantenible. Sí reducen la incertidumbre sobre lo que el programa hace mientras tomamos esa decisión.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-simplicity/README.md), la [tarifa completa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/src/rates.ts) y las comprobaciones del umbral exacto.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/design-principles test
pnpm --dir packages/design-principles typecheck
```

## Garantías y límites

El código cubre las necesidades ficticias descritas. No hay mediciones de tiempo de desarrollo ni datos que permitan afirmar que este diseño sea más rápido para cualquier equipo.

Se ha elegido simplicidad local, no una solución universal de logística. Si cambian zonas, moneda, caducidad o persistencia, habrá que revisar contratos y pruebas. Declarar ese límite forma parte del diseño, no lo invalida.

## Ejercicio: justificar una pieza que no vas a construir

Imagina una petición de «preparar soporte para diez transportistas» sin ninguno confirmado. Escribe qué capacidad pospondrías, qué límite conservarías limpio y qué requisito observable te haría empezar la integración. Después contrástalo con un transportista ya contratado cuya documentación y casos de uso estén disponibles: ¿sigue siendo especulación?

La última entrega trata [DRY y duplicación de conocimiento](/posts/dry-duplicacion-conocimiento-abstracciones). Evitar un framework anticipado no implica copiar cada regla en todos sus consumidores.

## Referencias

- [Martin Fowler: Yagni](https://martinfowler.com/bliki/Yagni.html).
- [Martin Fowler: definición de refactoring](https://refactoring.com/).

Fuentes consultadas el 21 de octubre de 2026. Los criterios de estructura son decisiones razonadas para este ejercicio, no métricas universales de simplicidad.
