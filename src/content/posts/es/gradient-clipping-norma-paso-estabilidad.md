---
id: "DL-GRADIENT-CLIPPING"
title: "Gradient clipping: limitar el gradiente no garantiza limitar cualquier optimizer step"
published: "2026-10-25T22:09:00Z"
locale: "es"
translationKey: "generalization-stability-dl-gradient-clipping"
slug: "gradient-clipping-norma-paso-estabilidad"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-EARLY-STOPPING", "DL-MOMENTUM"]
description: "Qué limita clip_grad_norm y cómo distinguir estabilidad, convergencia y generalización. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

Un gradiente recortado puede seguir produciendo un optimizer step grande. **Gradient clipping** limita una magnitud concreta; extender su garantía a cualquier optimizador puede ocultar justamente el problema que se intenta diagnosticar.

Después de [controlar cuándo detener el entrenamiento](/posts/early-stopping-patience-mejor-checkpoint), cerramos el bloque separando estabilidad del update, convergencia y generalización.

## Clip_grad_norm calcula una norma conjunta

Para un vector global de gradientes g y umbral τ, la idea es conservar g si su norma no supera τ y reescalarlo por `τ/‖g‖` si la supera. El factor común conserva la dirección del vector en el caso finito considerado.

La norma se construye como si concatenáramos los gradientes de todos los parámetros. Recortar cada tensor a τ por separado no limita a τ la norma de su concatenación.

En `packages/generalization-stability/probes.py` usamos el control `[3,4]`, cuya norma es 5:

```python
    p=nn.Parameter(torch.zeros(2,dtype=torch.float64));p.grad=torch.tensor([3.,4.],dtype=torch.float64)
    norm=nn.utils.clip_grad_norm_([p],2.,error_if_nonfinite=True)
    vector={'before':float(norm),'after':float(p.grad.norm()),'values':p.grad.tolist()}
```

El resultado se aproxima a `[1.2, 1.6]`, es decir, coordenadas 1,2 y 1,6, con norma ligeramente inferior a 2 por el estabilizador de la implementación. La función modifica los gradientes y devuelve la norma anterior, no la posterior.

## Se coloca entre backward y step

Primero calculamos las derivadas, después aplicamos el límite y finalmente el optimizador usa el gradiente resultante. Con gradient accumulation se recortaría el gradiente efectivo, tras completar y normalizar la acumulación, si esa es la operación que se quiere reproducir.

Con **AMP**, el escalado requiere coordinar también unscale y los pasos que realmente se ejecutan. Ese modo no se prueba aquí. Activar `error_if_nonfinite=True` hace visible una norma no finita; el test provoca NaN y comprueba el rechazo.

<img src="/assets/visuals/generalization-stability/DL-GRADIENT-CLIPPING.svg" alt="Qué limita clip_grad_norm y cómo distinguir estabilidad, convergencia y generalización. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="320" height="508" loading="lazy" style="width:100%;max-width:320px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-GRADIENT-CLIPPING.svg).

## La cota del paso de SGD simple no vale para cualquier update

En SGD sin momentum ni decay, `Δθ=−ηg_recortado`, así que `‖Δθ‖≤ητ`. Con momentum interviene un buffer anterior. Con Adam hay estadísticas adaptativas y con decay puede añadirse otra contribución.

El probe de Adam asigna gradiente 100 a un parámetro y lo recorta a 1e-4 antes del primer step:

```python
    nn.utils.clip_grad_norm_([q],.0001,error_if_nonfinite=True);optimizer.step()
```

Con tasa 0,1, el desplazamiento observado es aproximadamente 0,099990, muy superior a `0,1·1e-4=0,00001`. La adaptación de escala explica la diferencia. No se ha violado la cota del gradiente: era incorrecto atribuirle una cota general del desplazamiento.

## Clipping no arregla automáticamente un learning rate inestable

Otro control optimiza `L(θ)=50θ²`, derivada 100θ. SGD con tasa 0,05 multiplica θ por −4 en cada paso sin recorte. En step 9 la loss llega a 3,435974e12 y se detiene por un guard declarado; no se espera a producir infinitos.

Con la misma tasa y clipping de norma 1, los pasos quedan acotados, pero a los 40 updates la loss es 0,071158 y la trayectoria sigue oscilando. Con tasa 0,01 sin clipping, este problema cuadrático llega a cero.

<img src="/assets/interactive/generalization-stability/clipping-curves.svg" alt="Trayectorias reales de la parábola50theta². El eje vertical muestra log10(1+MSE),incluyendo cero. Clipping limita el gradiente,pero la tasa inestable sigue oscilando;el control sinrecorte termina por guard." width="380" height="440" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/generalization-stability/clipping-curves.svg).

Son tres trayectorias reales con un parámetro de PyTorch. Muestran que limitar episodios grandes no garantiza convergencia si el régimen local de pasos sigue siendo inestable. No se usa esa parábola para fijar una tasa universal en redes profundas.

## Estabilidad y generalización requieren evidencias distintas

La MLP que memoriza los datos contaminados del laboratorio produce losses y parámetros finitos. Recortar gradientes no elimina por sí mismo esa memorización ni convierte una etiqueta incorrecta en una observación fiable.

Antes de aplicar clipping registraría la norma previa, la frecuencia con que actúa y la escala de la loss. Un umbral demasiado pequeño puede modificar casi todos los updates; entonces forma parte central del algoritmo y merece una comparación declarada.

No hemos aplicado clipping a las variantes neuronales de generalización. Sus curvas y el control de estabilidad son experimentos separados, con preguntas distintas. Esa separación evita presentar un mecanismo de seguridad numérica como una mejora de validation que no se ha medido.

## Ejercicio: escribe la garantía con todas sus condiciones

Explica por qué dos tensores recortados cada uno a norma 1 pueden tener norma conjunta mayor que 1. Después formula la cota del desplazamiento para SGD simple y señala qué parte deja de describir el primer update de Adam del probe. Usa el visor para comprobar norma previa, posterior y paso.

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

- [Norma global y valor devuelto por clip_grad_norm_](https://docs.pytorch.org/docs/2.14/generated/torch.nn.utils.clip_grad_norm_.html).
- [Pascanu et al.: gradientes y clipping](https://arxiv.org/abs/1211.5063).

El siguiente bloque del roadmap construirá una CNN e inspeccionará mapas de activación. Estas herramientas permitirán separar un error de implementación, un problema de optimización y una evaluación que no generaliza.
