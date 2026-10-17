---
id: P070
title: 'Rendimiento frontend: medir antes de añadir memo y más herramientas'
published: 2026-10-17T05:03:00Z
locale: es
translationKey: frontend-performance-measurement
slug: rendimiento-frontend-medir-antes-optimizar
draft: true
status: draft
level: intermedio
prerequisites: [P069, OPS-LOAD]
description: 'Separa espera, cálculo, render y presentación. Usa profiling y una medición DOM reproducible sin confundirla con INP.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, rendimiento, react, profiling]
---

El filtro funciona, pero escribir en él congela la pantalla. Añadir `memo` a todos los componentes puede cambiar algunas cifras sin corregir la causa: quizá seguimos creando miles de nodos que nadie está viendo.

Después de [resolver las carreras de estado](/posts/estado-cliente-servidor-optimismo-races), toca observar el trabajo que queda. El objetivo no es minimizar renders como si fueran errores, sino reducir las esperas que afectan a una tarea real.

## Una interacción lenta puede atascarse en varias fases

Una pulsación puede esperar a que el hilo principal termine otra tarea. Después se ejecuta su handler, React calcula cambios y el navegador actualiza estilos, geometría y presentación. Medir únicamente la función del filtro deja fuera parte del recorrido.

**LCP** describe cuándo se presenta un elemento grande de contenido durante la carga. **CLS** recoge desplazamientos inesperados del layout. **INP** caracteriza la respuesta a interacciones durante la visita. No son nombres intercambiables para «velocidad». La [documentación de Web Vitals](https://web.dev/articles/vitals) explica su propósito.

Una prueba local ayuda a reproducir un problema. Para saber cómo lo viven los usuarios necesitas observaciones de campo, segmentadas con cuidado. Un portátil rápido con datos calientes no representa todas las visitas.

<img src="/assets/visuals/frontend-series/P070.svg" alt="Una interacción incluye espera del hilo principal, handler, actualización de React y DOM, layout y presentación; medir solo el handler deja fases fuera." width="547" height="886" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P070.svg).

## Usar el profiler para responder una pregunta concreta

Empezaría grabando la interacción lenta en las herramientas del navegador. ¿Hay una tarea larga? ¿Mucho layout? ¿Una descarga necesaria que se descubre demasiado tarde? Después usaría el profiler de React si el coste parece estar en los componentes.

El componente [Profiler](https://react.dev/reference/react/Profiler) permite observar trabajo de render en su árbol. No mide todo el tiempo de red, layout o pintura. Esa distinción evita atribuir al framework una espera que ocurre fuera de él.

**Memoization** reutiliza resultados bajo ciertas condiciones. Tiene costes de comparación, memoria y complejidad. Si el cálculo ya es pequeño o las props cambian siempre, puede no aportar nada. Tampoco hace desaparecer los nodos de una lista enorme que todavía estamos montando.

## Un experimento pequeño: montar menos DOM

El laboratorio compara crear 5.000 elementos de lista con crear una ventana representativa de 14. Mantiene el estilo de fila y fuerza layout leyendo la geometría. No ejecuta React ni simula una interacción de usuario.

Archivo: `frontend-tiempo-real/tools/measure-dom.mjs`, operación que fuerza la resolución del layout.

```javascript
root.getBoundingClientRect()
```

La versión completa registra el tiempo desde antes de construir la lista hasta después de esa lectura. Alterna los tamaños, descarta una ronda de calentamiento y conserva siete muestras por variante.

En la ejecución archivada, con Chromium 141.0.7390.37, Linux y un Intel Core Ultra 9 285H, las medianas fueron **41,5 ms** para 5.000 filas y aproximadamente **0,3 ms** para 14. La gráfica procede de esas muestras, no de una estimación.

<img src="/assets/visuals/frontend-series/dom-measurement.svg" alt="Medianas del microexperimento local: crear y resolver layout de 5.000 filas consumió 41,5 milisegundos; una ventana de 14 consumió aproximadamente 0,3 milisegundos." width="900" height="460" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/visuals/frontend-series/dom-measurement.svg).

Esto respalda una conclusión acotada: en este experimento, montar menos elementos redujo ese trabajo DOM. No demuestra una mejora equivalente de INP, ni que una aplicación completa vaya a responder en 0,3 ms. Tampoco mide el coste de mantener una ventana al hacer scroll.

[Descarga el laboratorio](/assets/examples/frontend-tiempo-real-lab.zip). Desde `frontend-tiempo-real/`, con dependencias y Chromium instalados:

```bash
pnpm exec node tools/measure-dom.mjs
```

El comando sustituye `results/dom.json` con tus muestras. Es normal obtener otros valores. Guarda el entorno y compara distribuciones, no una cifra aislada elegida porque resulta favorable.

## Elegir la optimización que corresponde al cuello de botella

Si el coste es calcular sobre muchos datos, reduce el trabajo o considera un **Web Worker**. Un worker ejecuta tareas fuera del hilo principal, pero no manipula el DOM de la página. También hay coste de comunicación y transferencia de datos, como explica su [API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Si el problema es descargar código que todavía no necesitas, considera **lazy loading** y code splitting. Si es renderizar miles de filas, evalúa **virtualization** o paginación. Si son actualizaciones repetidas de un árbol caro, estudia identidad de props y memoization después de medir.

No implementamos todas estas alternativas en la demo. El experimento aísla el DOM para no mezclar una comparación sencilla con cambios simultáneos de algoritmo, red y framework.

## Garantías y límites

Se conservan muestras y método del microexperimento; la prueba de navegador comprueba además que la lista virtual de 100.000 posiciones mantiene acotado el DOM. No se ha medido rendimiento en dispositivos móviles ni se ha realizado un estudio de campo de Core Web Vitals.

En una herramienta operativa, establecería primero una tarea y un presupuesto observables: por ejemplo, cambiar un filtro sin bloquear la edición. El presupuesto requiere contexto de producto y dispositivos; no sale automáticamente de este benchmark.

## Ejercicio: comprobar una hipótesis de rendimiento

Duplica la longitud de los textos del experimento y repite las siete muestras. Formula antes la hipótesis y registra después si los resultados la apoyan. No cambies a la vez tamaño del dataset, CSS y navegador: ya no sabrías qué produjo la diferencia.

Seguimos con [cómo combinar grandes datasets, navegación accesible y selección masiva](/posts/tablas-grandes-paginacion-virtualizacion-seleccion).

## Referencias

- [web.dev: Web Vitals](https://web.dev/articles/vitals).
- [web.dev: optimizar INP](https://web.dev/articles/optimize-inp).
- [React: Profiler](https://react.dev/reference/react/Profiler).
- [MDN: Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

Fuentes y medición revisadas el 17 de octubre de 2026. Los tiempos son del experimento local, no objetivos universales.
