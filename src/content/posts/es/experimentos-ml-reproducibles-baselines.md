---
id: P095
title: 'Experimentos reproducibles de ML: cómo saber qué cambio mejoró el modelo'
published: 2026-10-18T01:09:00Z
locale: es
translationKey: ml-reproducible-experiments
slug: experimentos-ml-reproducibles-baselines
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P087, P092, P093, P094]
description: 'Protocolo, baselines, versiones, semillas, ablations e incertidumbre: comparar tres modelos sin convertir test en una herramienta de selección.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, reproducibilidad, experimentos, ingenieria]
---

Un experimento mejora la métrica y no sabemos si se debe al algoritmo, a una limpieza nueva o a haber cambiado el reparto de datos. Podemos repetir el comando, pero todavía no podemos explicar qué produjo la diferencia.

Un experimento reproducible necesita conservar **qué se comparó, sobre qué datos, con qué decisiones y bajo qué entorno**. Fijar una semilla es útil, aunque solo cubre una parte de esa información.

## El protocolo se escribe antes de mirar el resultado final

El laboratorio logístico fija el instante de predicción antes de salir, cuatro features permitidas, target `delay_minutes > 30` y splits temporales de 540/180/180 registros. La métrica principal es **average precision** para retraso como clase positiva.

`protocol.json` también fija tres referencias finales: probabilidad constante, regresión logística y Random Forest. Threshold es 0,5 para las métricas de clasificación. No lo cambiamos después de ver test.

Esta comparación es educativa: no afirmamos que todos los modelos hayan recibido un presupuesto de optimización equivalente. Los análisis de árboles, calibración y ablation anteriores pertenecen a train/validation. El conjunto final mantiene configuraciones predefinidas; no incorporamos sus resultados exploratorios para escoger el que mejor quede en test.

<img src="/assets/visuals/ml-series/P095.svg" alt="Datos y protocolo versionados alimentan experimentos de entrenamiento y validación; se congelan configuraciones antes de evaluar tres referencias en test; el registro conserva resultados y límites sin devolver decisiones desde test." width="618" height="982" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P095.svg).

## Una comparación necesita una hipótesis y una referencia

Un **baseline** constante estima la frecuencia de positivos en train. No usa las features, por lo que permite comprobar cuánto aporta ordenarlas mediante un modelo. No sustituye a todos los baselines posibles: un sistema real quizá deba superar también una regla operativa ya existente.

Una hipótesis concreta sería: «la previsión de lluvia aporta información predictiva adicional a distancia, carga y centro». Para investigarla hacemos una **ablation**, retirando esa feature y manteniendo modelo, datos y evaluación.

En validation, AP de logística pasa de **0,8457 con todas las features a 0,6049 sin lluvia**. El experimento muestra una diferencia para esta representación y muestra sintética. No demuestra causalidad ni que la lluvia sea imprescindible si tuviéramos otras señales que la sustituyeran.

Cambiar al mismo tiempo features, algoritmo y ventana de datos puede ser útil para explorar, pero no permite atribuir la mejora a un único cambio. Conviene separar experimentación exploratoria de comparaciones controladas.

## Una semilla no versiona los datos ni el entorno

El [laboratorio descargable](/assets/examples/machine-learning-lab.zip) incluye el CSV, el generador, tests, protocolo y resultados JSON. Conserva **SHA-256 del dataset y del protocolo**, versiones de Python y bibliotecas, y semillas explícitas.

Usamos una imagen científica ya disponible y fijada por **digest**, no por una etiqueta mutable como `latest`. La ejecución no necesita red y monta el código en solo lectura. El ZIP contiene el laboratorio, no la imagen ni sus dependencias; el README explica ese requisito antes de ejecutar nada.

Archivo: `machine-learning/experiments.py`, registro del entorno y huellas de entrada.

```python
        'environment': {'python': platform.python_version(), 'numpy': np.__version__,
            'pandas': pd.__version__, 'scipy': scipy.__version__, 'sklearn': sklearn.__version__},
        'seed': SEED, 'dataset_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'protocol_sha256': hashlib.sha256(Path('protocol.json').read_bytes()).hexdigest(),
```

El registro permite detectar que hemos cambiado un fichero, pero no sustituye a revisar su procedencia, permisos o calidad. Tampoco promete resultados bit a bit idénticos en cualquier arquitectura numérica. Las pruebas comparan predicciones y cálculos con tolerancias explícitas.

## La incertidumbre depende de qué volvemos a muestrear

Repetimos el bosque con tres semillas en validation. AP queda entre **0,8246 y 0,8342**. Es una comprobación pequeña de sensibilidad al ajuste aleatorio, no un intervalo de confianza ni permiso para elegir la semilla con mejor score.

También calculamos un **paired bootstrap** de la diferencia de pérdidas Brier entre baseline y logística. Remuestreamos los mismos índices para ambas predicciones, conservando la comparación caso a caso. El intervalo percentile de la diferencia baseline menos logística es aproximadamente **[0,0659, 0,1282]**: positivo significa menor pérdida para logística.

Ese bootstrap condiciona en predicciones ya ajustadas. No incorpora variación por reentrenar ni demuestra cobertura sobre otra temporada. Además, asumir intercambiabilidad de filas puede ser inadecuado en datos temporales; con dependencia habría que justificar bloques, varias ventanas u otro diseño. Aquí lo presentamos como diagnóstico exploratorio, no como prueba de superioridad futura.

## Test se utiliza para describir el procedimiento congelado

Sobre los mismos **180 envíos de test**, con 47 retrasos, obtenemos:

AP significa average precision y recall utiliza threshold 0,5.

| Modelo | AP | Recall |
| --- | ---: | ---: |
| Constante | 0,2611 | 0 |
| Logística | 0,7546 | 0,4681 |
| Bosque | 0,7161 | 0,3830 |

Brier, donde menor es mejor, queda en **0,1958 para la referencia constante, 0,1206 para logística y 0,1332 para el bosque**.

La logística tiene AP menor que en validation y omite **25 de 47 retrasos** a ese threshold. Publicar solo AP ocultaría una limitación importante si quisiéramos alertar de la mayoría de retrasos.

El archivo de resultados conserva IDs, targets y probabilidades para reconstruir cada métrica. Volver a ejecutar el mismo cálculo verifica reproducibilidad; no proporciona un nuevo test independiente. Si usamos lo observado para rediseñar el modelo, necesitaremos otra evaluación final pertinente.

## Error analysis empieza por casos, no por otra búsqueda automática

Podemos revisar falsos negativos, distribuciones de scores y grupos operativos. Cada observación puede sugerir una hipótesis nueva, no justificar retrospectivamente el experimento anterior.

En este fixture conocemos la regla generadora y sabemos que incluye ruido. En producción habría que comprobar además etiquetas tardías, errores de captura y cambios operativos. Una herramienta de **experiment tracking** puede guardar todo esto; un JSON local versionado basta para aprender el flujo, sin añadir un servicio remoto que todavía no necesitamos.

## Garantías y límites

La entrega prueba código, contratos, hashes y métricas con datos sintéticos. No valida utilidad económica, robustez ante drift real, equidad o despliegue. No hay un modelo listo para automatizar decisiones por haber completado la tabla.

## Ejercicio: preparar el siguiente experimento sin tocar test

Escribe una hipótesis a partir de los errores en validation, fija un cambio y su métrica antes de ejecutarlo. Registra qué resultado la contradiría. Mantén el test actual como evidencia de esta versión y explica qué nueva ventana reservarías para evaluar la siguiente.

La serie puede recorrerse desde [la definición del problema](/posts/machine-learning-problema-target-prediccion). El siguiente bloque del roadmap es Deep Learning; sus modelos también necesitarán esta disciplina de datos y evaluación.

## Referencias

- [scikit-learn: controlar aleatoriedad y comparar estimadores](https://scikit-learn.org/stable/common_pitfalls.html#controlling-randomness).
- [scikit-learn: evaluación mediante cross validation](https://scikit-learn.org/stable/modules/cross_validation.html).
- [SciPy: bootstrap y métodos de intervalos](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html).
