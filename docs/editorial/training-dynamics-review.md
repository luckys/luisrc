# Revisión P098: optimizadores y dinámica del entrenamiento

Siete drafts españoles de Luis Ramírez Calle, independientes de PaySafe. Ver
[ruta](ruta-optimizadores-entrenamiento.md),
[manifiesto](training-dynamics-series.json) y
[glosario](training-dynamics-glossary.md). Se parte de los commits blog `9412094`
y ejemplos `b900c13`. Este bloque queda sin commit, traducción, publicación o audio.
El turno anterior fue progreso: guardó los tres bloques anteriores y confirmó
ambos repositorios sin cambios pendientes.

## Cobertura y división editorial

| Artículo | Pregunta propia | Evidencia |
| --- | --- | --- |
| P098 | Qué presupuesto compara una curva | Epoch, batch, minibatch, step, cobertura y cola desigual; tres tamaños de batch |
| DL-SGD | Qué hace el tamaño del paso | Aproximación local, parábola analítica y tres tasas en la MLP |
| DL-MOMENTUM | Qué recuerda el optimizador | Recurrencia, convención, persistencia, signos y varios steps |
| DL-ADAM | Cómo se adapta cada coordenada | m/v, segundo momento, bias correction, epsilon y contraste PyTorch |
| DL-ADAMW | Por qué L2 y decay se separan | Álgebra SGD y control con gradiente de datos cero |
| DL-SCHEDULES | Qué mueve el reloj de la tasa | Warmup/cosine, índices y extremos declarados, curva real |
| DL-ACCUMULATION | Cómo conservar el batch efectivo | Media ponderada, parámetros fijos y control incorrecto |

Se eligieron siete piezas para no mezclar el mecanismo de Adam con el de decay,
o batches con acumulación. Cada una ronda 1100–1320 palabras con metadatos y código,
incluye mecanismo, por qué, trade-offs, ejercicio, reproducción y límites.
No hace falta otra subdivisión para desarrollar estas preguntas. P099 conserva
Dataset/DataLoader, nn.Module, train/eval y save/load; P100 conserva diagnóstico
de overfitting, normalización, dropout, early stopping y clipping.

Nueve extractos Python coinciden con las fuentes ejecutadas. Siete D2/SVG y tres
gráficas numéricas. Figuras limitadas a su ancho natural o 380px, sin ampliar los
diagramas estrechos. Las etiquetas distinguen loss media de forward, ponderaciones
de parámetros y multiplicación por learning rate. AdamW muestra las dos ramas
de update, y schedules conserva las alternativas de sus dos tramos.

## Protocolo y observaciones

El laboratorio `packages/training-dynamics` reutiliza `neural-foundations/neural.py`
sin cambiarlo. MLP 2→4→1, tanh, 17 parámetros, BCE media, float64. Train256 y
validation128, generados independientemente con seeds101/102 y semiancho0,45
alrededor de (±1,±1). Sin test evaluado. Los hiperparámetros se declararon en
protocol.json antes de obtener resultados; no se ajustaron tras observar las curvas.

Doce runs principales: cuatro optimizadores por cada seed7/19/31. Batch32,
80epochs,640updates,20480muestras procesadas por run. Pesos iniciales y secuencia
de muestras idénticos dentro de cada seed. Se conservan hashes de datos y orden.
SGD/momentum lr0,1; momentum μ0,9. Adam/AdamW lr0,01,betas0,9/0,999,epsilon1e-8.
Solo AdamW añade decay0,01 en todos los parámetros, bias incluidos. No es una
búsqueda justa de los mejores hiperparámetros ni se iguala la regularización.

Cinco ablations, seed7: SGD lr0,001 y1; batch16 y256; momentum con warmup40updates
y cosine hasta0,1de la base. Batch16/32/256 conserva epochs y muestras, pero da
1280/640/80updates. La interfaz y el artículo lo declaran: cambiar el eje no crea
un experimento con presupuesto de updates igualado.

Validation BCE final, seed7: SGD0,05437991040610826; momentum0,004122913922461134;
Adam0,020753760886615878; AdamW0,02301017092672304. Momentum-cosine0,00741004589654176,
peor que la tasa constante en este protocolo. SGD lr1 termina0,0042120851080006535,
mejor que lr0,1; no se inventa una divergencia de la red para explicar tasas grandes.
La inestabilidad se demuestra por separado en L=5θ² con η0,21 y factor−1,1.
Las otras dos inicializaciones se publican completas, sin elegir solo una curva.

Cada checkpoint evalúa splits completos a pesos fijos. Tasa y normas corresponden
al último update de la epoch, no a medias. Antes del primer update son null.
La traza conserva los primeros tres updates, sus gradientes y los buffers m/v.

## Acumulación y controles que pueden fallar

Trece muestras en grupos5/5/3: ponderaciones5/13,5/13,3/13. Error máximo de gradiente
ponderado1,3877787807814457e-17. Promedio de medias incorrecto0,045714236857601565;
el test exige distinguirlo. Ocho recorridos adicionales de cinco epochs comparan
batch32 completo con micro10 para los cuatro métodos. Ambos lados tienen40steps;
máximo error final de parámetros5,551115123125783e-16. No se cuentan como los17runs
principales del visor. Un test añade batch efectivo7 sobre16muestras para conservar
un último batch efectivo desigual además de microbatches desiguales.

Adam/AdamW con parámetro2,gradiente de datos presente y cero,lr0,01,decay0,1:
1,9900000005 y1,998. El caso no cubre grad=None. Se explican las restricciones de
la equivalencia: forward separable, sin BatchNorm/dropout, pesos fijos hasta el
step; no se ejecutan AMP,DDP o clipping. No se miden memoria ni tiempo.

## Reproducción y verificación

Captura final2026-10-25T19:42:00.042775+00:00. Runtime PyTorch CPU ya disponible,
reutilizado por digest desde P097: Python3.13.17,NumPy2.5.4,PyTorch2.14.1+cpu,
linux/amd64. Dos CPUs/2GiB y un thread OMP/BLAS/MKL. Rednone,rootfs/bindsreadonly,
usuario1000:100,capdropALL,pullnever. Cada ejecución borra solo su propio nombre
aleatorio precomprobado; se comprobó que no quedan containers luisrc-dynamics-.
Sin paquetes Python instalados en el host ni nuevas dependencias declaradas.

Doce hashes de entradas, incluyendo modelo canónico, fuentes, tests, protocolo,
runtime y runner. Verify vuelve a ejecutar17trainings y todos los controles,
incluidos los ocho recorridos cortos, con rtol1e-10/atol1e-12. Compara las dos copias
JSON y las versiones reales. No se promete igualdad bit a bit entre BLAS/hardware.

Siete tests Python y tres JS pasan. Se escribieron antes de las implementaciones:
fallos iniciales de módulos optimizers/training y model ausentes, observados en sus
contextos correctos. Una llamada incorrecta al inicializador de P096 se corrigió
tras el fallo de tests; no se alteró el modelo anterior. Las reglas de actualización
se contrastan con torch.optim mediante cuatro steps de gradientes controlados,
tasas cambiantes, signos/cero y variantes con/sin decay. Las curvas se entrenan
con NumPy; no se presentan como entrenamientos PyTorch completos.

Frozen pnpm install39proyectos pasa, sin cambio de lockfile:38labs,277índices,
117exports. Pasan156checks editoriales/estructurales y19tests blog. Build50rutas,
74HTML; Pagefind10páginas,4280palabras,dosidiomas. Drafts excluidos del contenido
publicado. Auditor73draft_exists/19related_only/83not_written es inventario y no
demuestra aceptación global del roadmap.

Chromium final:16vistas,360/1440px,540estados y1800filas numéricas comprobadas.
Se cotejan puntos de todas las curvas y cursores, valores nulos, seeds, teclado,
scroll interno, enlaces/assets, iframe y error de informe404. No overflow global,
errores JS o peticiones del visor fuera de su carpeta.
Informe `/tmp/training-dynamics-layout.YvOFp7/report.json`.

La inspección visual detectó una seed desactivada que conservaba31 al mostrar
ablations reales de seed7. Se corrigió para mostrar7 y se añadió la aserción de
valor; no bastaba comprobar solo que el control estuviera disabled. Se ampliaron
las etiquetas numéricas a14px. Ajustes finales de tres diagramas y aclaración SGD
se comprobaron también en ocho vistas: `/tmp/training-visuals/report.json`, con
capturas de controles/curvas y revisión visual. El primer informe kxGgld es previo
a esas correcciones de presentación y no debe usarse como evidencia final.

## Continuación

Siguiente P099: loop completo PyTorch con Dataset/DataLoader, módulos, loss,
optimizer, train/eval y checkpoints verificables. Reutilizar la image fijada ya
disponible, inspeccionarla y mantener instalaciones mediante pnpm. Evitar cambiar
fuentes hash de P096/P097/P098 sin regenerar observaciones dependientes.

Mantener P026, Stripe sandboxP045, soakP058 y el alcance de Serie02 limitado a
estructuras/algoritmos. Los requisitos de P099–P175 y otros gaps siguen activos.
No hay aceptación global ni commit/push automáticos por esta entrega.
