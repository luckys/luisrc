---
id: "DL-FEATURE-MAPS"
title: "Feature maps: inspeccionar una CNN sin inventar lo que ha aprendido"
published: "2026-10-26T00:06:00Z"
locale: "es"
translationKey: "convolutional-networks-dl-feature-maps"
slug: "cnn-feature-maps-activaciones-interpretacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-CNN-TRAIN"]
description: "Cómo leer activaciones reales conservando coordenadas, signos y escalas. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Dos mapas pueden verse igual de brillantes aunque sus activaciones tengan escalas muy diferentes. Si cada imagen ajusta sus colores al mínimo y al máximo propios, una respuesta pequeña puede parecer tan intensa como otra grande.

Tras [entrenar nuestra CNN](/posts/cnn-pequena-entrenamiento-protocolo-logits), inspeccionaremos sus **feature maps**. El objetivo es relacionar la imagen de entrada con transformaciones reales del modelo, conservando signos, coordenadas y escalas. El color será una representación de un número, no una explicación automática.

## Un feature map contiene respuestas en posiciones espaciales

En conv1 tenemos cuatro mapas 24 × 24 por imagen. Cada uno contiene las respuestas de un canal de salida después de combinar la entrada con sus pesos y bias.

Después de ReLU seguimos teniendo cuatro mapas del mismo tamaño, pero todos sus valores negativos pasan a cero. Pooling reduce esos mapas a 12 × 12. Conv2 los combina para producir ocho mapas, también 12 × 12 antes y después de su ReLU.

Cada coordenada se interpreta en la cuadrícula de su etapa. La posición (6, 6) de conv2 no corresponde al píxel (6, 6) de entrada. Su soporte viene de las ventanas anteriores, como calculamos al estudiar [receptive field](/posts/cnn-receptive-field-soporte-gradientes).

<img src="/assets/visuals/convolutional-networks/DL-FEATURE-MAPS.svg" alt="Cómo leer activaciones reales conservando coordenadas, signos y escalas. Flujo de cálculo del laboratorio." width="395" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Los canales tampoco son las clases. Hay ocho canales en conv2 y cuatro clases en la tarea. Cada logit combina las ocho medias espaciales con una fila de pesos de la head. Una activación puede participar en varias puntuaciones con pesos de signos diferentes.

## Capturamos estados del forward sin modificar el modelo

El método `Backbone.maps` conserva salidas en puntos explícitos:

```python
        c1=self.conv1(x)
        r1=torch.relu(c1)
        pooled=self.pool(r1)
        c2=self.conv2(pooled)
        r2=torch.relu(c2)
```

Ese método también se usa en el forward del backbone. Evitamos reimplementar una versión para dibujar que pueda separarse de la que se entrenó. Se archivan las activaciones como números, no como capturas de pantalla imposibles de recalcular.

Para visualizar usamos el último modelo source de seed 7 y la primera imagen de validation de cada orientación, índices 0, 32, 64 y 96. La regla de elección es fija. No buscamos después la imagen donde un canal parezca más interesante.

Las cuatro predicciones coinciden con sus etiquetas. Es una observación sobre cuatro ejemplos ya incluidos en validation, no un conjunto adicional de evaluación.

## Antes de ReLU necesitamos representar también el signo

El visor usa una escala simétrica alrededor de cero para las salidas de convolution previas a ReLU: azul para negativo, blanco para cero y naranja para positivo. Después de ReLU, cero se representa oscuro y los positivos con intensidad azul creciente.

La escala compartida se calcula entre las cuatro imágenes y todos los canales de la etapa elegida. Así el mismo color significa el mismo valor dentro de esa etapa. No igualamos automáticamente las escalas de conv1 y conv2: sus operaciones y distribuciones pueden ser distintas.

<img src="/assets/interactive/convolutional-networks/feature-maps.svg" alt="Canal 0 de conv1 tras ReLU para las cuatro imágenes seleccionadas, usando una escala numérica compartida entre todos los canales y ejemplos de esa etapa." width="380" height="496" loading="lazy" style="width:100%;max-width:380px;height:auto" />

El modo de contraste local usa solo el mapa seleccionado para fijar su amplitud. Ayuda a localizar variaciones pequeñas. A cambio, impide comparar magnitudes por el color entre dos mapas. El visor lo indica y muestra los límites numéricos; esa decisión no queda escondida en la función de dibujo.

## Comparar antes y después de ReLU permite comprobar una transformación

Selecciona la misma imagen y canal en `conv1_pre` y `conv1_relu`. Busca una coordenada negativa en el primero y consulta su valor en el segundo: debe ser cero. Una coordenada positiva debe conservarse.

Los tests comprueban esa relación sobre los arrays. También contrastan que aplicar la head al vector de medias archivado reproduce los logits. Es una forma de verificar que lo presentado corresponde al modelo y no a un tensor de otra etapa.

Un mapa con muchos ceros tras ReLU puede resultar esperable en esa entrada. No demuestra por sí solo que el canal nunca contribuya. Haría falta observar más datos y distinguir una activación escasa de una unidad inactiva para todas las entradas relevantes.

## Un canal que responde a un trazo no queda explicado por ese ejemplo

Puede resultar tentador llamar «detector de horizontales» a un canal después de verlo activarse sobre una línea horizontal. También podría responder a otro contraste, a un borde de ruido o a varias orientaciones.

Una interpretación más defendible exigiría variar entradas de forma controlada, medir respuestas y comprobar cómo afectan a las salidas de interés. El mapa aislado solo permite describir valores y posiciones. No le atribuimos una semántica que el experimento no identifica.

El gradiente del visor responde a otra pregunta: cómo cambia localmente una activación concreta de conv2 ante una perturbación infinitesimal de entrada. Está fijado en (6, 6) y puede mostrar un soporte escaso por las rutas elegidas por max pooling y ReLU.

Esa derivada no corresponde a la probabilidad de una clase. Tampoco es una intervención causal. Mantener separadas activación, sensibilidad y decisión evita que un gráfico vistoso prometa más de lo que calcula.

## Garantías y límites

Se archivan cuatro inputs, todos los canales de cinco etapas, vectores de medias, logits, probabilidades y 32 mapas de gradiente de entrada. `verify` vuelve a entrenar el modelo y recalcula esos valores; no reconstruye figuras inventadas a partir de etiquetas.

Los tests comprueban que los gradientes no salen de las filas y columnas 9…16. Un soporte interior parcial es compatible con el receptive field teórico. En móvil puedes consultar fila, columna y valor sin depender de acertar con el dedo en un rectángulo pequeño.

La selección de cuatro ejemplos facilita la inspección, pero no representa toda la distribución de activaciones. No hemos realizado un estudio completo de interpretabilidad ni de fallos ante otras distribuciones.

## Ejercicio: documenta una observación que no exceda tus datos

Elige un canal y compara dos imágenes con escala compartida. Escribe primero qué valores y regiones cambian. Después formula una hipótesis sobre su respuesta y diseña una entrada adicional que pudiera contradecirla. Distingue esa hipótesis de lo que ya has comprobado.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/training.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/convolutional-networks test:container
pnpm --dir packages/convolutional-networks verify
pnpm --dir packages/convolutional-networks test
```

`verify` vuelve a entrenar los quince runs y recalcula mapas y controles; comprueba sus valores con tolerancias declaradas. `exercise` regenera el informe y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread, sin instalar Python en el host. El README documenta versiones y límites.

## Explorar las observaciones

<iframe src="/assets/interactive/convolutional-networks/explorer.html" title="Explorar ventanas, pooling, mapas reales y transferencia de una CNN" loading="lazy" style="width:100%;height:1200px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el laboratorio interactivo](/assets/interactive/convolutional-networks/explorer.html).

## Referencias

- [Autograd](https://docs.pytorch.org/docs/2.14/autograd.html).

## Continuar la serie

Anterior: [Entrenar una CNN pequeña: datos, logits y un protocolo que se puede repetir](/posts/cnn-pequena-entrenamiento-protocolo-logits). Siguiente: [Arquitecturas CNN: qué cambia al apilar kernels o añadir un residual block](/posts/cnn-arquitecturas-vgg-resnet-residual-blocks).
