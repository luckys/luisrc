# Revisión P096: fundamentos neuronales

Actualización: P097 ya se desarrolla como cinco drafts en la [serie de autodiff](ruta-forward-backward-autodiff.md). Las cifras y verificaciones siguientes describen el cierre del bloque P096.

Cinco drafts españoles de Luis Ramírez Calle. Ver [ruta](ruta-fundamentos-redes-neuronales.md),
[manifiesto](neural-foundations-series.json) y [glosario](neural-foundations-glossary.md).
No se publica, traduce o genera audio. P097–P105 siguen pendientes; el objetivo
editorial global conserva todo su alcance.

## Cobertura y evidencia

| Tema P096 | Entrega | Comprobación |
| --- | --- | --- |
| Neuron, weights, bias, perceptrón | P096 | Score, umbral, contradicción de XOR afín y construcción ReLU manual |
| Dense layers | DL-DENSE | Shapes por batch, parámetros17, broadcasting inválido y colapso de capas afines |
| Activations / non-linearity | DL-ACTIVATIONS | Funciones y derivadas, sigmoid/BCEestables, separación de logits y probabilidad |
| XOR / MLP NumPy | DL-XOR | Cinco entrenamientos reales con protocolo declarado, baseline y control negativo |
| Representaciones / universal approximation | DL-REPRESENTATIONS | Features ocultas inspeccionables y límites de representación/optimización/generalización |

Cada entrega tiene pregunta, tres objetivos, tres errores frecuentes, código con
ruta, mecanismo, pruebas, alternativas, garantías/límites, ejercicio y fuentes.
Nueve extractos Python corresponden a neural.py/experiments.py. Cinco D2/SVG,
ancho277–309px tras ajustar dos diagramas; tres gráficas con fuentes calculables.
El artículo de training es el más largo porque muestra código y resultados;
activation, matrices e interpretación se explican en entregas separadas.

## Protocolo declarado y resultado observado

Datos ficticios: cuatro cuadrados alrededor de(±1,±1), uniforme por coordenada±0,45.
Train256/validation128/test256; seeds101/102/103. Balanceados, independientes, sin
filas idénticas compartidas. Equivale a recodificar bits0/1como−1/+1 y añadir variación.
No muestras junto a ejes o hueco central. Grid25×25entre−1,6y1,6 incluye regiones
sin evaluación; las cajas del soporte permanecen visibles.

Cinco recorridos prefijados: logística, MLPconceros y MLPseeds7/19/31. Arquitectura
MLP2→4→1,tanh,17parámetros. BCEdesde logits, float64, full-batch, learning rate0,1,
3000actualizaciones. Snapshot0antes de entrenar y cada150epochs:21por caso.
Validation solo se observa; test solo se evalúa al final y no elige epochs/seed.
La vista inicial seed7 no se selecciona por ganar en test.

Loss train final: logística0,6929339255113011;ceros0,6931471805599453;
MLP7/19/31:0,008297599661168335/0,008070296061384707/0,008628460580700954.
Logística y ceros50%test, tres MLP256/256correctas. La tabla redondea a seis decimales,
los datos conservan precisión. Se explica ln(2) como loss de proponer0,5 y el solape
visual de las dos curvas cerca de ese valor.

Este experimento no acredita calibración, extrapolación fuera de soporte, rendimiento
por segundo, superioridad sobre otros modelos o éxito de todas las inicializaciones.
El caso ceros se explica mediante hidden/weights/gradientes cero y batch balanceado;
no se afirma que cualquier bias inicializado a cero impida aprender.

## Runtime, código y reproducción

Captura `2026-10-25T14:19:41.698402+00:00`, Python3.13.15/NumPy2.5.3, x86_64,
Intel Core Ultra9 285H. Image SciPy notebook ya disponible por digest en runtime.json,
dos CPUs/2GiB asignados y OMP/OpenBLAS/MKL1thread. Networknone, rootfs/bindreadonly,
user1000:100,capdropALL. No pip/conda/uv ni paquetes Python instalados en host.
El wrapper usa pullnever y elimina solo su nombre aleatorio propio, sin prune.
No container luisrc-neural- restante tras las ejecuciones.

Ocho hashes de entradas: package/runtime/protocol, neural.py, experiments.py,
verify.py, run.mjs y tests/test_neural.py. Verify vuelve a entrenar los cinco casos
y compara números con rtol1e-10/atol1e-12; no solo comprueba un archivo JSON.
No promesa bit a bit entre arquitecturas o BLAS. No se informa un tiempo de entrenamiento.

Los seis tests Python se escribieron primero. La primera invocación desde raíz
halló cero tests; se corrigió el cwd y falló por módulo ausente. Después pasan en
hostPython3.12.3/NumPy1.26.4 y runtime fijado. El informe solo acepta el runtime fijado.
Se comprueban los17gradientes con diferencias finitas antes de interpretar la loss.

Tres tests JS se definieron antes de inference.mjs y primero fallaron por módulo
inexistente. Después contrastan ocho probes de105checkpoints,625puntos finales por
caso, activaciones ocultas y101valores por activation con NumPy, tolerancia2e-12.
El navegador hace inferencia sobre pesos reales archivados; no reentrena con JS.

## Integración y verificación

Código en `luisrc-blog-examples/packages/neural-foundations`, cinco índices ingleses
por post. Ocho exports: HTML/controlador, inference/charts, training.json y tresSVG.
Fuentes, tests, runner y protocolo solo se enlazan al monorepo, no se copian a public.

Sin dependencias nuevas o cambios de lockfiles. Frozen install37proyectos pasa;
36laboratorios,265índices y102exports sincronizados con hashes de procedencia.
Pasan143checks editoriales/estructurales,19tests del blog,6tests Python y3tests JS.
Los seis checks editoriales nuevos cubren alcance, dependencias, extractos, imágenes,
fuentes/resultados, inferencia de validation y exports.

Build50rutas/72HTML y Pagefind10páginas/4280palabras/dos idiomas. Los drafts siguen
fuera de la publicación. Auditor71draft_exists/19related_only/85not_written, un
inventario que no constituye aceptación de cada ficha ni del objetivo global.

Chromium:12vistas(5posts+visor a1440/360),210checkpoints,32mapas de unidades ocultas,
80probes seleccionados y606selecciones de activation. Métricas y625colores por grid
comparados con pesos/NumPy; curvas, controles, testsoloalfinal, error explícito,
teclado y scroll interno. Sin overflow global, errores JS o peticiones del visor
fuera de su carpeta. Informe `/tmp/neural-foundations-layout.nX2TwI/report.json`.

Se inspeccionaron visualmente cinco diagramas, tres gráficas y visor móvil. Tres
artículos se revisan de nuevo tras aclarar nats/recodificación y reducir diagramas;
`/tmp/neural-visuals/final-article-check.json`. Código Python visible con scroll
interno, sin reducir el tamaño para hacer caber líneas largas.

## Continuación

P096 desarrollado como cinco drafts y entrenamiento verificable. P097 debe deducir
computational graph, loss, chain rule, backward, reverse-mode autodiff y contrastar
con framework/diferencias finitas. Los tests existentes no sustituyen esa enseñanza.
Si se modifican fuentes hash del laboratorio, regenerar informes, visores y referencias;
no editar hashes para aceptar observaciones antiguas.

Servidor QA propio1372791 detenido; puerto4322 sin listener al cierre.
Capacidad/costes P066 del turno anterior se conserva sin commit, junto con este bloque.
Últimos commits:blog1c2e9d1/ejemplos57b4890. No commit/push/publicación automáticos.
Mantener P026,Stripe sandboxP045,soakP058 y Serie02solo estructuras/algoritmos.
