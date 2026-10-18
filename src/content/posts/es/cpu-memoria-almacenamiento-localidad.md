---
id: P001
title: 'CPU, memoria y almacenamiento: qué estás midiendo cuando un programa tarda'
published: 2026-10-18T02:00:00Z
locale: es
translationKey: computing-cpu-memory-storage
slug: cpu-memoria-almacenamiento-localidad
draft: true
status: draft
math: true
level: intermedio
prerequisites: []
description: 'Registros, cachés L1/L2/L3, RAM y almacenamiento: seguir instrucciones y datos, medir un fichero y reconocer lo que una prueba no aísla.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [computacion, cpu, memoria, rendimiento]
---

Leemos un fichero dos veces y la segunda lectura tarda menos. Sería tentador concluir que el disco se ha vuelto más rápido. Lo que probablemente ha cambiado es dónde estaban los datos y qué trabajo tuvo que repetir el programa.

Para investigar rendimiento necesitamos separar **ejecución, movimiento de datos y espera**. Esta serie conecta los fundamentos del ordenador con problemas de servicios y navegadores. Aquí aprenderás a seguir ese recorrido, distinguir sus cachés y diseñar una medición que no prometa más de lo que observa.

## La CPU ejecuta instrucciones; los datos tienen que llegar hasta ella

Un programa termina convertido en instrucciones que la **CPU** puede ejecutar. Como modelo inicial podemos pensar en buscar una instrucción, decodificarla y ejecutar su operación. Los procesadores modernos solapan etapas, predicen saltos y pueden ejecutar operaciones fuera de orden, respetando el comportamiento arquitectónico correspondiente.

Por eso «una instrucción por ciclo» no es una regla general. Los **clock cycles** marcan oportunidades de avance, pero una operación puede necesitar varios ciclos y distintas unidades pueden trabajar a la vez. Comparar únicamente GHz no revela cuántas instrucciones se ejecutan, sus dependencias ni cuánto tiempo esperan datos.

Los **registers** conservan operandos y estado inmediato dentro del procesador. Una suma opera sobre valores disponibles para sus unidades de ejecución; no procesa un fichero directamente desde un SSD. Antes hay instrucciones de acceso y varias capas de memoria que pueden satisfacerlas.

## L1, L2 y L3 no son tres nombres para la RAM

Las **CPU caches** guardan copias de bloques de memoria próximos al procesador. Un acceso que encuentra el bloque es un **hit**; si no, es un **miss** y debe buscarse en otro nivel o en memoria principal.

Es habitual distinguir L1, L2 y L3, con diferentes capacidades, proximidad y organización. La distribución entre núcleos y la separación de instrucciones y datos dependen de la arquitectura. No debemos asumir que cualquier portátil tiene el mismo tamaño de línea o una L3 compartida idéntica.

La **RAM** mantiene páginas de código y datos que utilizan los procesos. El almacenamiento persistente conserva información más allá de su ejecución y, bajo las condiciones de persistencia del sistema, del apagado. Acceder a datos residentes en memoria y solicitarlos al almacenamiento implica caminos distintos, aunque una llamada de alto nivel pueda ocultarlos.

<img src="/assets/visuals/computing-series/P001.svg" alt="Las instrucciones usan registros y cachés de CPU; la RAM contiene datos y page cache del sistema; una lectura de fichero puede resolverse desde page cache sin acceder al dispositivo persistente." width="751" height="1045" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P001.svg).

## La localidad explica por qué el orden de acceso importa

**Temporal locality** significa volver a utilizar pronto un dato. **Spatial locality** significa acceder a posiciones próximas. Si la caché trae un bloque y utilizamos varias posiciones de ese bloque antes de expulsarlo, aprovechamos mejor el movimiento realizado.

El [laboratorio descargable](/assets/examples/computacion-redes-lab.zip) incluye un modelo **fully-associative LRU**: cuatro líneas, cuatro posiciones por línea y 128 accesos. Recorrer 32 posiciones cuatro veces produce **32 misses**; agrupar cuatro usos de cada posición produce **ocho**. Ambos casos realizan el mismo número de lecturas.

No son contadores de una CPU real. Hemos elegido capacidad y reemplazo para hacer visible el mecanismo. Un procesador incorpora asociatividad, prefetching, coherencia y otras políticas que aquí no modelamos. Cambiar el orden tampoco conserva necesariamente cualquier algoritmo, especialmente si modifica dependencias o redondeos.

## Leer un fichero recién escrito no aísla el almacenamiento físico

La **page cache** pertenece al sistema operativo y conserva contenido de ficheros en RAM. No es la caché L1 del procesador. Un `readFile` puede copiar desde esas páginas, reservar un Buffer y pasar por el runtime sin esperar una lectura física del dispositivo.

Nuestro experimento crea un fichero de **2 MiB**, realiza tres calentamientos y alterna el orden de nueve comparaciones. Una variante suma los bytes de un Buffer existente; la otra lee el fichero y después suma sus bytes.

Archivo: `computacion-redes/concepts.mjs`, operación compartida por ambas variantes.

```javascript
export function checksum(bytes) {
  let sum = 0
  for (const value of bytes) sum += value
  return sum
}
```

Todas las muestras producen el mismo checksum, **262139206**. Esto comprueba que no hemos comparado operaciones que procesan contenidos distintos. No es un hash criptográfico ni detecta todos los cambios posibles.

En la ejecución archivada, las medianas fueron **8,36 ms** para procesar el Buffer y **11,85 ms** para leer y procesar. La máquina, Node 24.19.0, muestras y método están en `results/experiments.json`; no medimos latencia individual de RAM, L1 o SSD.

<img src="/assets/visuals/computing-series/memory-samples.svg" alt="Nueve muestras locales comparan procesar un Buffer existente con leer y procesar un fichero recién creado; la variante de fichero incluye costes adicionales y no representa una lectura física en frío aislada." width="900" height="480" loading="lazy" style="width:100%;height:auto" />

[Ampliar las muestras](/assets/visuals/computing-series/memory-samples.svg).

La diferencia incluye API, asignación, copia, scheduling y posible variación de JIT o del host. Vaciar cachés globales para «arreglar» la prueba afectaría a otros procesos: este laboratorio no cambia la configuración del equipo.

## Medir el recorrido completo o aislar una capa son decisiones distintas

Si investigamos la experiencia del usuario, interesa el recorrido completo. Si queremos atribuir un coste al dispositivo, necesitamos controlar cachés, tamaño, concurrencia, patrón de acceso y condiciones del almacenamiento. Una microprueba de JavaScript no sustituye ese diseño.

Procesar por bloques puede reducir memoria máxima frente a cargar el fichero entero, pero añade decisiones de streaming y estados parciales. Una estructura compacta puede favorecer localidad, aunque no conviene reescribir el programa antes de comprobar que este acceso domina el tiempo total.

## Garantías y límites

Las pruebas verifican contenido, muestras y el modelo de localidad. No certifican un speedup para otra máquina ni atribuyen misses reales a la CPU. La reproducción debe conservar el procedimiento y checksums; no esperamos tiempos idénticos.

## Ejercicio: qué conclusión soporta tu experimento

Repite con otro tamaño y conserva las nueve muestras, no solo la más rápida. Comprueba primero igualdad de checksum. Si cambia la diferencia entre variantes, enumera al menos dos explicaciones compatibles antes de atribuirla al disco. No modifiques cachés globales.

Seguimos con [cómo representan esos bytes números, texto y fechas](/posts/bits-floats-unicode-fechas-representacion).

## Referencias

- [Linux: conceptos de memoria y page cache](https://docs.kernel.org/admin-guide/mm/concepts.html).
- [Linux: información expuesta sobre cachés de CPU](https://www.kernel.org/doc/Documentation/ABI/testing/sysfs-devices-system-cpu).
- [Node 24.19.0: filesystem](https://nodejs.org/download/release/v24.19.0/docs/api/fs.html) y [medición de rendimiento](https://nodejs.org/download/release/v24.19.0/docs/api/perf_hooks.html).
