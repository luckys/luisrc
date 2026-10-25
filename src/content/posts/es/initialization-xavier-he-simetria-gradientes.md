---
id: "DL-INITIALIZATION"
title: "Initialization: cómo llegan activaciones y gradientes a la primera actualización"
published: "2026-10-25T22:02:00Z"
locale: "es"
translationKey: "generalization-stability-dl-initialization"
slug: "initialization-xavier-he-simetria-gradientes"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-BIAS-VARIANCE"]
description: "Por qué importan la simetría, fan-in y la escala inicial antes de optimizar. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

Dos redes con la misma arquitectura pueden empezar con activaciones y gradientes muy distintos. **Initialization** decide el punto desde el que se optimiza; aumentar el número de epochs no compensa necesariamente un arranque que bloquea el aprendizaje.

Después de [separar fuentes de error](/posts/bias-variance-descomposicion-error-muestras), miramos una causa de optimización antes de atribuir todo a capacidad o a generalización.

## Inicializar todas las unidades iguales conserva simetrías

Si dos unidades ocultas tienen los mismos pesos y reciben las mismas actualizaciones, pueden seguir comportándose como copias. Inicializar aleatoriamente ayuda a romper esa simetría.

El control extremo del laboratorio pone a cero ocho matrices ocultas con ReLU. Su salida es cero y la pérdida contra unos vale 1, pero todos los gradientes de esas matrices son cero. No se trata de haber resuelto el problema: la ruta de derivadas no produce una actualización útil.

Esto no prohíbe inicializar bias a cero. Podemos mantener bias cero y pesos distintos; es lo que hacemos en la red principal. La decisión relevante es qué simetrías y trayectorias de derivación conserva la combinación completa.

## Fan-in conecta la escala de pesos con la suma que recibe una unidad

**Fan-in** cuenta entradas y **fan-out**, salidas de una transformación. Bajo aproximaciones de independencia y centrado, sumar fan-in términos hace que la varianza de la preactivation dependa de `fan_in·var(W)` y de la escala de las entradas.

**Xavier/Glorot** propone una escala que considera entrada y salida: varianza `2/(fan_in+fan_out)` en su formulación habitual con gain 1. En la versión uniforme, el límite es `sqrt(6/(fan_in+fan_out))`.

**He/Kaiming** incorpora la rectificación. Con entradas simétricas, ReLU elimina la parte negativa y reduce el segundo momento; una escala `2/fan_in` busca compensarlo aproximadamente.

Después de ReLU, media y varianza no son intercambiables con el segundo momento. No es correcto prometer varianza exactamente uno en todas las capas solo por elegir He.

## El código declara qué aproximación utiliza

La red principal se inicializa en `packages/generalization-stability/training.py`:

```python
        for layer in [model.first,model.second]:
            nn.init.kaiming_uniform_(layer.weight, nonlinearity='relu', generator=generator)
            layer.bias.zero_()
        nn.init.xavier_uniform_(model.output.weight,generator=generator)
        model.output.bias.zero_()
```

Las capas ocultas usan ReLU y la salida es lineal. La seed del generador de pesos es independiente de la seed que usará dropout. Así las variantes parten de las mismas matrices lineales incluso si cambian otros módulos.

<img src="/assets/visuals/generalization-stability/DL-INITIALIZATION.svg" alt="Por qué importan la simetría, fan-in y la escala inicial antes de optimizar. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="291" height="508" loading="lazy" style="width:100%;max-width:291px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-INITIALIZATION.svg).

## Miramos activaciones y gradientes por separado

Otro probe recorre ocho capas 16→16 sobre las mismas 128 entradas: ceros/ReLU, Xavier/tanh con gain 1, He/ReLU y pesos normales de desviación 3 con tanh. Registra varianza, segundo momento, ceros y gradientes por capa.

No todas son comparaciones que cambien una única variable: algunos pares cambian también la activation. El propósito es inspeccionar combinaciones concretas, no clasificarlas como un benchmark universal.

En la última capa, Xavier/tanh tiene segundo momento 0,046840 y He/ReLU, 3,445275. Esos números muestran que las aproximaciones teóricas no fijan exactamente el comportamiento de una red finita de anchura 16.

## Saturación no permite deducir por sí sola el gradiente global

Con los pesos grandes y tanh, el 81,25 % de las activaciones finales supera 0,99 en valor absoluto. Aun así, la norma del gradiente respecto a las entradas es 196,364688, frente a 0,011848 en Xavier/tanh.

Las matrices grandes también multiplican sensibilidades. Un conjunto de unidades saturadas no implica que todas las trayectorias del Jacobiano se vuelvan pequeñas. Concluir «el gradiente desaparece» solo a partir de un histograma de activaciones habría sido incorrecto aquí.

La fracción de saturación se deja sin valor para ReLU: superar 0,99 no significa saturarse en una rama lineal positiva. Se evita presentar una misma etiqueta como si midiera lo mismo para todas las activations.

## Antes de cambiar initialization, decide qué observarás

Registraría escalas de entradas, activaciones y gradientes, y comprobaría si los pesos realmente cambian. Una mala escala de features o una loss mal reducida puede persistir aunque se cambie la distribución inicial.

Los esquemas anteriores aportan puntos de partida razonados, no una garantía de convergencia o generalización. Redes con conexiones residuales, normalizaciones u otras activations pueden necesitar decisiones distintas.

## Ejercicio: evita un diagnóstico basado en un solo indicador

En el visor compara segundo momento y norma del gradiente para Xavier/tanh y pesos grandes/tanh. Explica por qué una activation de magnitud acotada puede coexistir con una sensibilidad grande. Después identifica qué supuesto dejaría de cumplirse si todas las entradas estuvieran fuertemente correlacionadas.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [entrenamiento](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/generalization-stability/training.py), los [probes numéricos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/generalization-stability/probes.py), protocolo, tests y observaciones.

Desde su raíz, con Docker y la image CPU fijada por digest:

```bash
pnpm --dir packages/generalization-stability test:container
pnpm --dir packages/generalization-stability exercise
pnpm --dir packages/generalization-stability verify
pnpm --dir packages/generalization-stability test
```

Si falta el runtime, `pnpm --dir packages/generalization-stability runtime:fetch` lo descarga. No requiere paquetes Python instalados en el host. Verify vuelve a entrenar y recalcula controles; no se limita a comparar hashes.

## Explorar curvas y mecanismos

<iframe src="/assets/interactive/generalization-stability/explorer.html" title="Explorar generalización, normalización, initialization y clipping con observaciones reales" loading="lazy" style="width:100%;height:1150px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor completo](/assets/interactive/generalization-stability/explorer.html). Muestra datos archivados; el navegador no entrena ni ejecuta PyTorch. Distingue el último modelo, el mejor observado y el elegido por la política de parada.

## Garantías y límites

Los 18 entrenamientos usan un mismo dataset contaminado y tres inicializaciones emparejadas. El estudio de bias–variance usa otro diseño sin esa contaminación; los controles de capas y clipping son experimentos separados. No se presenta un único mecanismo como explicación de todos los resultados.

No hay test final, GPU, benchmark de tiempo o recomendación universal. Validation se reutiliza para observar y elegir checkpoints: sus mínimos no son una evaluación independiente del modelo seleccionado.

## Referencias

- [Glorot y Bengio: initialization](https://proceedings.mlr.press/v9/glorot10a.html).
- [He et al.: rectificadores e initialization](https://arxiv.org/abs/1502.01852).
- [Opciones de nn.init](https://docs.pytorch.org/docs/2.14/nn.init.html).

Continúa con [Activations y gradientes: saturación, ReLU inactiva y productos a través de capas](/posts/activations-saturacion-relu-gradientes-profundidad).
