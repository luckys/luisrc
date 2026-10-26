---
id: "DL-TEACHER-FORCING"
title: "Teacher forcing: entrenar con el pasado correcto y generar con el propio"
published: "2026-10-26T01:07:00Z"
locale: "es"
translationKey: "recurrent-sequences-dl-teacher-forcing"
slug: "teacher-forcing-generacion-autoregresiva-evaluacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-RECURRENT-GRADIENTS"]
description: "Cómo separar el contexto real de entrenamiento del contexto generado en un rollout. Código contrastado, estados reales y límites del experimento."
author: "Luis Ramírez Calle"
series: "Cómo aprende una red de una secuencia: estados, puertas y generación"
tags: ["deep-learning", "rnn", "pytorch", "sequences"]
---

Durante entrenamiento, un generador puede recibir siempre el símbolo anterior correcto. Al usarlo, ese símbolo suele ser una predicción suya. Si se equivoca, cambia también el contexto sobre el que predice después.

Tras [separar memoria y gradiente local](/posts/rnn-vanishing-exploding-gradients-dependencias-largas), vamos a ejecutar ambos recorridos. **Teacher forcing** facilita supervisar cada posición, pero evaluarlo con el pasado real no equivale a medir una generación libre.

## El target actual no debe aparecer como entrada para predecirse

Usamos ocho símbolos que recorren un ciclo de cuatro IDs, en una de sus dos direcciones. Por ejemplo:

```text
Símbolos: 1  4  3  2  1  4  3  2
Targets:  1  4  3  2  1  4  3  2  EOS
Inputs: BOS 1  4  3  2  1  4  3  2
```

En el primer paso la red recibe BOS y predice el primer símbolo. En el siguiente recibe el primer símbolo real y predice el segundo. La alineación se desplaza una posición; no copiamos el target actual al input de ese mismo paso.

`decoder_inputs` construye ese desplazamiento:

```python
    inputs=torch.full_like(targets,PAD)
    inputs[:,0]=BOS
    inputs[:,1:]=targets[:,:-1]
    return inputs
```

La GRU es unidireccional. Aunque entreguemos todos los inputs desplazados en una sola llamada, la salida de una posición depende solo del prefijo hasta ella. Un test altera el sufijo y exige que las salidas anteriores no cambien.

<img src="/assets/visuals/recurrent-sequences/DL-TEACHER-FORCING.svg" alt="Cómo separar el contexto real de entrenamiento del contexto generado en un rollout. Relación de entradas, estados y decisiones del cálculo contrastado." width="390" height="686" loading="lazy" style="width:100%;max-width:380px;height:auto" />

La loss incluye EOS, porque queremos predecir el final. Si hubiera targets PAD, `ignore_index=PAD` los excluiría y la normalización se haría por tokens válidos. El probe comprueba esa media con siete targets reales en dos secuencias de distintas longitudes.

## Teacher forcing proporciona el pasado correcto en cada paso

Entrenar así permite calcular pérdidas supervisadas sobre posiciones cuyos prefijos son los reales. Las llamadas recurrentes siguen teniendo dependencia temporal; teacher forcing no convierte por sí solo una GRU en un modelo con todos sus pasos independientes.

La loss de un paso puede propagar gradientes a estados y pesos anteriores. Lo que suministramos como input es un ID del dataset, no una decisión de argmax diferenciable producida por el paso anterior.

En evaluación teacher-forced, la red recibe esos mismos prefijos reales. Es una evaluación válida de ese contrato. Para conocer el comportamiento al consumir sus propios errores necesitamos además un **rollout autoregresivo**.

## El rollout solo recibe un prefijo y genera lo que sigue

Proporcionamos los dos primeros símbolos. Indican la posición inicial del ciclo y su dirección. Después generamos hasta siete tokens, incluidos los seis símbolos restantes y EOS esperado.

La función de rollout no recibe la continuación real como argumento. Elige un token por argmax, lo incorpora como input del siguiente paso y mantiene el estado. Se detiene lógicamente tras EOS; las posiciones restantes de una comparación fija se consideran ausentes o PAD.

El prefijo sí es contexto proporcionado, también durante el uso. No contamos esos dos símbolos como predicciones acertadas. Las métricas de continuación empiezan en el tercer símbolo y terminan en EOS.

No usamos sampling, beam search ni atención. **Greedy decoding** hace reproducible esta comprobación, pero no es una estrategia universal para toda tarea generativa.

## Un porcentaje por token y una secuencia exacta responden a preguntas distintas

Medimos accuracy teacher-forced de la continuación, accuracy del rollout por token y proporción de continuaciones completamente correctas. Un fallo temprano puede afectar a muchas posiciones posteriores, y una sola posición incorrecta basta para que una secuencia deje de contar como exacta.

El visor mantiene separadas esas métricas y los tres recorridos de cada ejemplo: pasado real, generación propia y generación con una perturbación forzada. No rellena una predicción ausente como si fuera el target.

La GRU tiene embedding 8, hidden size 16 y head de diez logits: **1 498 parámetros**. Entrena sesenta epochs con 128 muestras, batch 32, Adam 0,01 y clipping 1: 240 updates por seed. Conservamos el último estado, sin elegir el mínimo posterior de validation.

## Este control repite ocho patrones, y eso limita la evaluación

Solo existen cuatro posiciones iniciales por dos direcciones: ocho patrones de ocho símbolos. Los ocho aparecen tanto en train como en las 64 muestras de validation. Los generadores tienen seeds diferentes, pero sus conjuntos de patrones únicos coinciden.

Por tanto, aquí no probamos generalización a secuencias nuevas. Comprobamos que un modelo aprende ese conjunto finito y que las rutas de evaluación usan el contexto declarado. No se presenta como generación de lenguaje natural ni transferencia a patrones desconocidos.

Las tres seeds terminan con accuracy 1 en teacher forcing, accuracy 1 en rollout y exact match 1. Las losses de validation rondan 0,2366–0,2389. Al finalizar no observamos una brecha entre teacher forcing y rollout. Las curvas sí muestran diferencias mientras aprenden; por sí solas no aíslan su causa ni cuantifican un efecto general de **exposure bias**.

La loss supervisa también los dos primeros símbolos, que no quedan determinados por BOS: el primero varía y el segundo elige dirección. Que la continuación sea perfecta no obliga a que esa loss total sea cero.

## Una perturbación artificial demuestra un camino, no una frecuencia de fallo

En el primer ejemplo de seed 7, el prefijo es `[1, 4]` y la continuación correcta `[3, 2, 1, 4, 3, 2, 9]`. La generación limpia coincide. Al imponer 4 como primer token generado, el rollout continúa `[4, 3, 2, 1, 4, 3, 2]` dentro del límite de siete pasos.

El recorrido cambió porque el modelo consumió la entrada impuesta. No decimos que ese error aparezca espontáneamente con esa frecuencia ni que el ejemplo mida una probabilidad de fallo real. La perturbación está etiquetada como intervención deliberada.

## Garantías y límites

Los tests comprueban desplazamiento causal, masking de loss, límites del rollout y ejecución con un token impuesto. El informe registra también el solapamiento de los ocho patrones. `verify` vuelve a entrenar y reproduce métricas y ejemplos.

El [tutorial de PyTorch sobre seq2seq](https://docs.pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) usa teacher forcing en un contexto más amplio. Nuestro modelo no tiene encoder separado, atención, longitud generativa abierta o evaluación de lenguaje. P103 desarrollará atención; no se da por cubierta aquí.

## Ejercicio: diseña una evaluación que no repita el conjunto aprendido

Propón una tarea con más variación donde puedas reservar estructuras o longitudes no vistas. Define por separado la métrica con prefijos reales y la de generación libre. Explica qué evidencias necesitarías antes de hablar de acumulación natural de errores, además de mostrar una perturbación forzada.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/training.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/tests/test_training.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/recurrent-sequences test:container
pnpm --dir packages/recurrent-sequences verify
pnpm --dir packages/recurrent-sequences test
```

`verify` vuelve a entrenar doce modelos y recalcula estados, gradientes y rollouts. No compara solo hashes. `exercise` regenera las observaciones y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. No requiere instalar Python o descargar datasets en el host. El README concreta versiones, tolerancias y límites.

## Consultar estados y predicciones

<iframe src="/assets/interactive/recurrent-sequences/explorer.html" title="Explorar embeddings, celdas, memoria y generación con resultados reales" loading="lazy" style="width:100%;height:1200px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor de secuencias](/assets/interactive/recurrent-sequences/explorer.html).

## Referencias

- [Seq2seq y teacher forcing, PyTorch](https://docs.pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html).

## Continuar la serie

Anterior: [Gradientes a través del tiempo: perder sensibilidad no equivale a olvidar al predecir](/posts/rnn-vanishing-exploding-gradients-dependencias-largas). La siguiente serie empieza con [atención Q/K/V](/posts/attention-qkv-consultas-claves-valores) y reconstruye Transformer con matrices contrastadas.
