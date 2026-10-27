---
id: "DL-LORA"
title: "LoRA: adaptar una matriz con dos factores y comprobar su merge"
published: "2026-10-26T03:06:00Z"
locale: "es"
translationKey: "model-adaptation-dl-lora"
slug: "lora-rango-bajo-inicializacion-merge"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-PEFT"]
description: "Cómo una actualización de rango limitado cambia la función sin entrenar la matriz base. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Una matriz 16→8 tiene 128 pesos. Si la actualización que necesitamos puede expresarse con dos factores de rank 2, podemos aprender 48 números nuevos mientras mantenemos fija esa matriz original. Esa es la restricción central de **LoRA**.

En [PEFT y sus costes](/posts/peft-parametros-entrenables-memoria-coste-real) distinguimos entrenables de memoria total. Ahora seguiremos los dos factores, su inicialización y la equivalencia que permite fusionarlos con la matriz base al servir.

## La actualización tiene rango limitado; el modelo completo, no

Para una capa lineal escribimos `W_adaptada = W_base + s × B × A`. Si la entrada tiene 16 features y la salida 8, A es 2×16 y B es 8×2. Su producto vuelve a ser 8×16, compatible con la matriz base.

El rank de `B × A` es como máximo 2. Eso limita una actualización concreta de pesos; no convierte todos los estados del modelo en vectores de dimensión 2 ni garantiza un rank total 2 de `W_adaptada`.

La escala `s = alpha / rank` permite controlar la magnitud de la rama. En el laboratorio alpha 2 y rank 2 dan escala 1. Cambiar rank sin pensar cómo escalar puede cambiar también la magnitud de la actualización, complicando la comparación.

<img src="/assets/visuals/model-adaptation/DL-LORA.svg" alt="Cómo una actualización de rango limitado cambia la función sin entrenar la matriz base. El diagrama sigue los datos y las operaciones específicas del experimento." width="589" height="832" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La implementación conserva una rama base y otra entrenable

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
class LoRALinear(nn.Module):
    def __init__(self, base, rank=2, alpha=2):
        super().__init__()
        if rank < 1:
            raise ValueError('rank must be positive')
        self.base = copy.deepcopy(base).requires_grad_(False)
        self.a = nn.Parameter(torch.empty(rank, base.in_features))
        self.b = nn.Parameter(torch.zeros(base.out_features, rank))
        nn.init.kaiming_uniform_(self.a, a=math.sqrt(5))
        self.scale = alpha / rank

    def forward(self, features):
        update = F.linear(F.linear(features, self.a), self.b)
        return self.base(features) + self.scale * update

    def merged(self):
        result = copy.deepcopy(self.base)
        with torch.no_grad():
            result.weight.add_(self.scale * (self.b @ self.a))
        return result
```

La rama base mantiene su bias. La rama de actualización tiene dos proyecciones sin bias: primero A, después B. Ambas reciben el mismo input original a través de su camino; no aplicamos A a la salida de la matriz base.

En nuestro encoder solo adaptamos la última matriz lineal 16→8. No añadimos LoRA a Q/K/V porque este laboratorio no es un Transformer. El [paper original de LoRA](https://arxiv.org/abs/2106.09685) estudia otras ubicaciones y modelos; elegir dónde insertar la adaptación sigue siendo parte del diseño.

## Por qué B empieza en cero y A no

Con B cero, la rama nueva devuelve cero. La función inicial coincide exactamente con la capa base. Un head idéntico recibe por tanto la misma representación inicial en full y LoRA dentro de una seed.

A empieza aleatoria. En el primer backward, su gradiente es cero porque está multiplicada por B, mientras B puede recibir gradiente gracias a la activación producida por A. Después de que B cambie, A también podrá aprender.

Si ambos factores empezaran en cero, cada uno bloquearía el gradiente que necesita el otro. La multiplicación no puede crear una señal inicial a partir de dos factores nulos. La prueba del laboratorio exige gradiente inicial cero en A y no cero en B para su input de control.

La identidad inicial tampoco significa que el entrenamiento se comporte como full. Un método tiene 128 grados de libertad de pesos en esa matriz, además de bias entrenable en full; el otro actualiza una factorización restringida y deja fija la base.

## Merge: cuándo sumar la actualización produce la misma operación

Mientras la rama sea lineal y use la misma entrada, podemos construir `W_merged = W_base + s × (B @ A)` y conservar el bias base. La prueba compara salida separada y salida fusionada después de actualizar B.

En aritmética real son la misma expresión. FP32 puede producir pequeñas diferencias por el orden de operaciones; la prueba usa tolerancias explícitas. No exigimos igualdad bit a bit después del merge.

Fusionar modifica una copia de la base. Si se añade la misma actualización dos veces sobre una matriz ya fusionada, se duplica el efecto. Conviene conservar una base inmutable y distinguir estados fused/unfused. La función del laboratorio devuelve una copia nueva cada vez.

## Qué consiguió este rank 2

LoRA entrena 66 parámetros contando el head. Obtiene 95,703%, 94,141% y 94,141% de accuracy en test. No iguala siempre a full ni a scratch. No buscamos otro rank después de observar test para corregir esa diferencia.

Además, la reconstrucción source empeora con LoRA activo aunque la base permanezca intacta. Podemos retirar la rama y recuperar la operación base; mientras la rama está activa, la función es otra. Esa distinción evita prometer conservación de capacidades basándonos solo en el archivo de pesos.

## Garantías y límites

Se comprueban identidad inicial, gradientes, conteo 48 de A/B, preservación de la base y merge tras una actualización. No se mide latencia de serving ni se demuestra que rank 2 sea suficiente para otras tareas. El ahorro de entrenables es verificable; la calidad sigue necesitando evaluación.

## Ejercicio: contar antes de elegir un rank

Calcula A/B para una matriz 64→32 con rank 4. Obtendrás 384 parámetros nuevos frente a 2048 pesos base, sin contar bias ni head. Después explica por qué ese porcentaje no predice por sí solo la accuracy ni la memoria total del entrenamiento.

## Explorar las observaciones

El [visor interactivo](/assets/interactive/model-adaptation/explorer.html) muestra las 21 ejecuciones, curvas de validation, predicciones de test, conteos y un probe contrastivo. Cambia estrategia y seed para comparar; la calculadora LoRA es algebraica y no mide memoria.

<iframe src="/assets/interactive/model-adaptation/explorer.html" title="Laboratorio interactivo de pretraining y adaptación de modelos" loading="lazy" width="100%" height="760" style="border:1px solid #475569;border-radius:8px;max-width:100%"></iframe>

## Código completo y pruebas

El código explicado arriba forma parte de un laboratorio ejecutable. Las fuentes completas y los tests viven en [model-adaptation](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation), fuera del blog.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --filter @luisrc-examples/model-adaptation runtime:fetch
pnpm --filter @luisrc-examples/model-adaptation test:container
pnpm --filter @luisrc-examples/model-adaptation verify
```

Se necesita Docker y el runtime PyTorch fijado por digest. El experimento CPU usa un thread numérico, 2 CPUs y 2 GiB, sin red durante entrenamiento. `verify` repite tres pretrainings y 21 adaptaciones; compara curvas, deltas y predicciones con tolerancias declaradas. Las comprobaciones de hash fijan el código, no sustituyen repetirlo.

- [data.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/data.py)
- [models.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/models.py)
- [objectives.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/objectives.py)
- [training.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/training.py)
- [protocol.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/protocol.json)
- [tests/test_models.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/tests/test_models.py)
- [results/observations.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/results/observations.json)

## Referencias

- [LoRA, Hu et al.](https://arxiv.org/abs/2106.09685).
- [Implementación de referencia de LoRA](https://github.com/microsoft/LoRA).

Siguiente: [Adapters: añadir una corrección no lineal a una representación congelada](/posts/adapters-bottleneck-residual-peft).
