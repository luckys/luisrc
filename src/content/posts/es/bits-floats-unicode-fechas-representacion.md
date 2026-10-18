---
id: P002
title: 'Bits, decimales, texto y fechas: el valor no es lo mismo que sus bytes'
published: 2026-10-18T02:01:00Z
locale: es
translationKey: computing-data-representation
slug: bits-floats-unicode-fechas-representacion
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P001]
description: 'Enteros con signo, IEEE 754, UTF-8 y timestamps: corregir errores que aparecen al confundir un valor con su representación.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [computacion, unicode, javascript, datos]
---

Un nombre llega como `EspaÃ±a`, una suma devuelve `0.30000000000000004` y una fecha cambia de hora al abrirla en otro equipo. Son fallos diferentes, pero comparten una pregunta que conviene hacer explícita: **¿qué significan estos bytes y qué reglas usamos para interpretarlos?**

Después de [seguir el recorrido de los datos por el ordenador](/posts/cpu-memoria-almacenamiento-localidad), veremos cómo distinguir bits, valores numéricos, texto e instantes. El objetivo no es memorizar codificaciones, sino localizar dónde se perdió un contrato de representación.

## Un patrón de bits no dice por sí solo qué representa

Un **bit** toma dos valores y un byte contiene ocho bits. El patrón `11111111` puede escribirse en hexadecimal como `FF`: es una forma más compacta de mostrar el mismo patrón, no otra cantidad almacenada.

Interpretado como entero de ocho bits sin signo, representa 255. Con **two's complement** y ocho bits con signo, representa −1. El rango con signo va de $-2^7$ a $2^7-1$; no hay espacio adicional para representar también 255.

Para un número de varios bytes necesitamos además acordar su orden, **endianness**. Un lector que interpreta bytes little-endian como big-endian puede obtener un número válido pero incorrecto. No lo arregla cambiar la etiqueta del tipo en TypeScript: el contrato binario y la operación de decodificación deben coincidir.

La serialización convierte valores a una representación transportable. JSON ofrece texto estructurado, pero no conserva automáticamente todos los tipos del lenguaje. Una fecha queda como string por convención; un BigInt de JavaScript necesita una representación acordada y no puede pasarse sin más a `JSON.stringify`.

## Un float binario aproxima muchos decimales cotidianos

**Number** de JavaScript utiliza, para sus valores numéricos ordinarios, el formato binario de doble precisión de **IEEE 754**. Combina signo, exponente y significando. Tiene precisión finita: muchos decimales no poseen una expansión binaria finita, igual que un tercio no termina al escribirlo en base diez.

El laboratorio reproduce `.1 + .2` y obtiene **0.30000000000000004**. No significa que el ordenador sume al azar. Hemos redondeado representaciones binarias y después formateado el resultado en decimal.

Usar una tolerancia puede ser razonable para ciertos cálculos científicos, siempre que corresponda a sus escalas y errores. No convierte una representación aproximada en un importe exacto ni justifica comparar cualquier diferencia con una constante universal.

## Las unidades menores evitan introducir floats en un importe exacto

En el [laboratorio](/assets/examples/computacion-redes-lab.zip) definimos un contrato didáctico: importes no negativos, punto decimal y exactamente dos posiciones. Convertimos el texto directamente a **BigInt**, sin pasar por Number.

Archivo: `computacion-redes/concepts.mjs`, conversión del contrato de ejemplo.

```javascript
export function minorUnits(text) {
  const parts = /^(0|[1-9]\d*)\.(\d{2})$/.exec(text)
  if (!parts) throw new Error('Se necesita un decimal no negativo con dos posiciones')
  return BigInt(parts[1]) * 100n + BigInt(parts[2])
}
```

`0.10` y `0.20` se convierten en 10 y 20 unidades menores; la suma exacta es **30**. El test también utiliza un valor mayor que el rango entero seguro de Number para comprobar que no hay una conversión numérica intermedia.

No todas las monedas usan dos posiciones ni toda operación permite descartar fracciones. Un sistema real debe definir moneda, escala, redondeo y límites. Aquí rechazamos `1.001` en lugar de inventar una política de redondeo. En JSON podríamos enviar las unidades como string decimal junto a moneda y escala acordadas.

## Unicode define caracteres; UTF-8 define cómo codificarlos

**Unicode** asigna code points. **UTF-8** los representa mediante secuencias de uno a cuatro bytes. El texto `España` ocupa **siete bytes UTF-8**: la `ñ` necesita dos, aunque se vea como una letra.

Decodificar esos bytes como Latin-1 produce `EspaÃ±a`, un caso de **mojibake**. Los bytes pueden haber viajado intactos: el error está en el decodificador elegido. Acordar y declarar UTF-8 evita esa interpretación equivocada; no conviene encadenar conversiones hasta que «parezca arreglado».

<img src="/assets/visuals/computing-series/P002.svg" alt="El texto España se codifica en siete bytes UTF-8; los bytes C3 B1 forman ñ, pero interpretarlos como Latin-1 produce los caracteres incorrectos del mojibake." width="1134" height="798" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P002.svg).

Un chunk de red no respeta necesariamente límites de caracteres. El laboratorio separa `C3` de `B1`: un decoder estricto rechaza el primero aislado; un **streaming decoder** conserva el prefijo y reconstruye `ñ` cuando recibe el segundo.

Tampoco debemos equiparar bytes, code points, unidades UTF-16 de un string JavaScript y caracteres percibidos. Emojis y combinaciones de acentos pueden ocupar varias unidades. Normalizar a una forma Unicode acordada puede ayudar al comparar texto, pero no sustituye reglas de identidad específicas del producto.

## Una fecha de calendario no es necesariamente un instante

`2026-10-18` puede representar una fecha civil, sin hora ni zona. `2026-10-18T12:00:00+02:00` y `2026-10-18T10:00:00Z` representan el mismo instante. El test comprueba esa igualdad con `getTime()`.

Un **timestamp** numérico necesita unidad y origen: segundos y milisegundos desde Unix epoch no son intercambiables. JavaScript Date trabaja con milisegundos para su valor numérico. En texto, un formato con offset explícito evita que el receptor tenga que adivinarlo.

Un offset no sustituye siempre a una zona como `Europe/Madrid`. Para «la reunión de las nueve cada lunes» interesan reglas de calendario y cambios de horario, no solo sumar un número fijo de segundos al instante anterior.

## Garantías y límites

Los tests reproducen y corrigen float decimal y UTF-8 fragmentado. No implementan todas las monedas, un parser general de fechas, normalización de identidades o soporte completo de grafemas. Un fichero que se decodifica bien todavía puede contener un dato semánticamente incorrecto.

## Ejercicio: escribe el contrato antes del parser

Define cómo enviarías una fecha de nacimiento, una hora de auditoría y un importe. Indica tipo, unidad, zona o moneda cuando corresponda. El criterio de éxito es que dos implementaciones puedan reconstruir el mismo significado sin depender de su locale por defecto.

Seguimos con [procesos, hilos y memoria virtual](/posts/procesos-hilos-memoria-virtual-bloqueos).

## Referencias

- [ECMAScript: Number y tipos de valores](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types-number-type).
- [Unicode 17: conformidad y codificaciones](https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-3/).
- [Node 24.19.0: TextDecoder y streaming](https://nodejs.org/download/release/v24.19.0/docs/api/util.html#class-utiltextdecoder).
- [RFC 3339: representación de timestamps](https://www.rfc-editor.org/rfc/rfc3339).
