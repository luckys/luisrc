---
id: P003
title: 'Procesos, hilos y memoria virtual: por qué async no evita un bloqueo de CPU'
published: 2026-10-18T02:02:00Z
locale: es
translationKey: computing-processes-threads-memory
slug: procesos-hilos-memoria-virtual-bloqueos
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P001]
description: 'User space, kernel, scheduling, memoria virtual y métricas de proceso: observar un bloqueo acotado sin confundir async con paralelismo.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [computacion, sistemas-operativos, concurrencia, memoria]
---

Una función marcada como `async` calcula durante varios segundos y las demás peticiones dejan de avanzar. No hace falta que el sistema operativo se haya bloqueado: puede seguir ejecutando otros procesos mientras nuestro código impide atender callbacks en el hilo principal.

Para diagnosticarlo necesitamos separar **proceso, hilo, memoria y scheduling**. Partimos de [CPU y jerarquía de memoria](/posts/cpu-memoria-almacenamiento-localidad); ahora veremos qué aislamiento ofrece el sistema y qué significa realmente «estar esperando».

## El kernel administra recursos que el programa no controla directamente

En **user space** ejecutamos la mayor parte del código de aplicación. El **kernel** gestiona operaciones privilegiadas, protección de memoria y acceso a dispositivos. Las **system calls** permiten solicitar servicios como abrir un fichero o trabajar con un socket.

Cambiar de modo para una syscall no equivale necesariamente a ejecutar otro proceso. Un **context switch** cambia el contexto de ejecución de una tarea a otra; una transición user/kernel puede volver a la misma tarea. Confundir ambos costes dificulta interpretar un perfil.

Una operación puede consumir CPU, esperar un resultado o estar lista para ejecutarse pero todavía no haber sido seleccionada. Tiempo transcurrido y tiempo de CPU miden cosas diferentes. En un proceso con varios hilos, la suma de CPU utilizada puede incluso superar el tiempo de reloj observado.

## Un proceso ofrece un espacio de direcciones; sus hilos ejecutan dentro de él

Un **process** agrupa recursos y un espacio de direcciones virtual. Un **thread** tiene su estado de ejecución, registros y stack; los hilos de un proceso pueden compartir memoria y recursos.

El **scheduler** decide qué tareas listas utilizan los procesadores disponibles. En un solo núcleo puede alternar tareas; con varios núcleos puede ejecutar varias a la vez. Esa distinción separa concurrencia de paralelismo. Si compartimos datos mutables, también necesitamos sincronización: alternar ejecución no hace atómicas nuestras operaciones de negocio.

Un runtime añade sus propias abstracciones. Los workers JavaScript de Node tienen isolates separados; compartir un proceso no significa que compartan automáticamente todos los objetos JavaScript. Los mecanismos de mensajes o memoria compartida deben elegirse explícitamente.

<img src="/assets/visuals/computing-series/P003.svg" alt="El kernel planifica hilos de procesos con espacios virtuales separados; cada hilo tiene stack y estado; el proceso conserva memoria dinámica y recursos, mientras una tarea de CPU puede bloquear el event loop de su propio hilo." width="627" height="982" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P003.svg).

## Memoria virtual no significa que toda la RAM esté ocupada

Una dirección virtual es parte de la vista del proceso. Las tablas de páginas relacionan esa vista con memoria física y otros estados gestionados por el sistema. Reservar un rango virtual y tocar efectivamente sus páginas no son el mismo hecho.

Un **page fault** permite resolver ciertos accesos a páginas no presentes o situaciones de protección. No todos implican leer del disco: el sistema puede asignar una página o establecer una relación con datos ya disponibles en memoria.

**Stack** y **heap** describen usos distintos. El stack conserva el contexto de llamadas, según ABI y runtime; el heap alberga asignaciones dinámicas. No debemos inferir el layout físico exacto de un objeto por dónde aparece una variable en el código fuente.

En Node, `heapUsed` se refiere al heap de JavaScript gestionado por V8. **RSS**, resident set size, cuenta memoria residente del proceso e incluye otras regiones. Buffers, código nativo, stacks y bibliotecas no desaparecen de la contabilidad porque no sean objetos del heap JS.

## Un bloqueo pequeño permite observar el problema sin colgar el equipo

El [laboratorio](/assets/examples/computacion-redes-lab.zip) crea un proceso hijo, programa un timer para unos diez milisegundos y ejecuta un bucle síncrono acotado a ochenta. No bloquea procesos ajenos ni intenta agotar memoria.

Archivo: `computacion-redes/process-probe.mjs`, bloqueo deliberado del experimento.

```javascript
events.push('busy:start')
while (performance.now() - start < 80) {} // Bloqueo deliberado y acotado en un proceso propio.
events.push('busy:end')
```

La traza observada es `busy:start`, `busy:end`, `timer`. El timer se ejecutó aproximadamente a los **80,27 ms**, no a los diez solicitados. El tiempo configurado no interrumpe el cálculo para ejecutar un callback: este necesita que el hilo pueda atenderlo.

La prueba verifica el orden de eventos, no una duración idéntica. Carga del equipo, runtime y scheduling pueden añadir variación. No usamos «tardó exactamente ochenta» como contrato.

## Las métricas de memoria necesitan un denominador y una unidad

El mismo hijo crea y toca un Buffer de **8 MiB**. En la ejecución archivada, `arrayBuffers` aumentó en 8.388.608 bytes y RSS aproximadamente en esa cantidad; `heapUsed` cambió mucho menos. El registro conserva antes/después y CPU en microsegundos.

Esto explica por qué observar solo heap puede ocultar crecimiento relevante. No demuestra que RSS tenga que aumentar en la misma cantidad en todas las ejecuciones: asignadores, páginas compartidas y reutilización de memoria influyen en lo observado.

Liberar una referencia tampoco obliga al runtime a devolver inmediatamente esas páginas al sistema. Para investigar una fuga necesitamos varias observaciones y entender retención de objetos y comportamiento del asignador, no una única fotografía.

## Esperar I/O y repartir cálculo requieren soluciones distintas

Una API asíncrona puede permitir que el hilo atienda otras tareas mientras el sistema o un worker resuelve I/O. Declarar una función `async` no desplaza automáticamente un bucle de CPU a otro hilo.

Para cálculo intensivo podemos considerar workers, procesos o un servicio especializado. A cambio aparecen comunicación, copia o compartición de datos, cancelación y límites de capacidad. Dividir trabajo en fragmentos puede mejorar respuesta sin hacerlo más rápido; crear más hilos que núcleos tampoco garantiza mejor throughput.

## Garantías y límites

Observamos CPU y memoria de un hijo propio y reproducimos un bloqueo del event loop. No medimos cambios de contexto del kernel ni demostramos límites de aislamiento frente a una vulnerabilidad del sistema. Tampoco implementamos un pool de workers de producción.

## Ejercicio: explica dos tiempos distintos

Sustituye el cálculo por una espera asíncrona de duración parecida y conserva eventos, tiempo transcurrido y CPU. El criterio no es que tarde menos: debes explicar por qué puede consumir menos CPU aunque siga terminando después, y qué callbacks pudieron ejecutarse durante la espera.

Seguimos con [cómo diagnosticar procesos y puertos en Linux](/posts/linux-diagnosticar-procesos-puertos-senales).

## Referencias

- [OSTEP: address spaces](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf), [scheduling](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) y [threads](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf).
- [Linux: conceptos de memoria](https://docs.kernel.org/admin-guide/mm/concepts.html).
- [Node 24.19.0: métricas de proceso y memoria](https://nodejs.org/download/release/v24.19.0/docs/api/process.html).
