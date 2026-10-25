# Revisión P097: forward, backward y autodiff

Cinco drafts españoles de Luis Ramírez Calle, independientes de PaySafe. Ver
[ruta](ruta-forward-backward-autodiff.md), [manifiesto](autodiff-foundations-series.json)
y [glosario](autodiff-foundations-glossary.md). Sin publicación, traducción o audio.
P098–P105 y el resto del objetivo global conservan sus requisitos pendientes.

## Alcance y evidencia

| Tema | Artículo | Evidencia |
| --- | --- | --- |
| Computational graph / chain rule | P097 | Grafo q=w*x,r=q+q,L=r², dos contribuciones a q y cuatro casos cotejados con autograd |
| Loss y reducción | DL-LOSS-GRADIENT | BCE desde logits, derivación de(p-y)/n y error de sigmoid' contada dos veces |
| Backpropagation manual | DL-BACKPROP | dZ2,dW2,db2,dH,dZ1,dW1,db1 con shapes y orden de17parámetros |
| Gradient checking | DL-GRADCHECK | Siete epsilons, tres configuraciones, copias sin mutación y cuatro controles incorrectos |
| Reverse-mode / framework | DL-AUTODIFF | PyTorch CPU, VJP, gradcheck, hojas/intermedios, acumulación, detach y valores guardados |

Cada entrega tiene pregunta, tres capacidades y tres errores frecuentes, código
con ruta, mecanismo, alternativas, límites, ejercicio y referencias primarias.
Diez extractos Python coinciden con fuentes ejecutadas. Cinco D2/SVG de213–314px,
dos gráficas estáticas y visor interactivo. Figuras limitadas a380px en los posts
para evitar ampliación excesiva en escritorio; etiquetas gráficas aumentadas.

Se valoró dividir el último post: unas1237palabras con código/metadatos, sobre el
estado de autograd de un único forward ya conocido. Los temas de optimización y
entrenamiento completo quedan en sus siguientes bloques, sin mezclar sus garantías.

## Experimento y resultados

Cuatro puntos XOR(±1,±1), targets(4,1), MLP2→4→1,tanh,BCEmean,float64. Pesos iniciales
seeds7/31 y checkpoint3000seed7 de P096. No se entrena otra red ni se elige un modelo
por aproximarse más a los gradientes. El checkpoint se lee como fixture original.

Máximos errores manual/PyTorch:2,0816681711721685e-17;
5,551115123125783e-17;2,9680034471790684e-18. Losses sobre estos cuatro puntos:
0,702097392025335;0,7889803472897696;0,0055960939768086825. No equivalen a las losses
de train sobre256puntos de P096: los datos del contraste son distintos y declarados.

FDcentrales:1e-1,1e-3,1e-5,1e-7,1e-9,1e-11,1e-13. Criterio por componente
abs(diff)≤atol+rtol*abs(manual),atol1e-8/rtol1e-5. Pasan los tres valores intermedios
1e-3/1e-5/1e-7 y fallan los otros en las tres configuraciones. El principal1e-5 se
declaró antes del informe. Los extremos muestran truncamiento y redondeo, sin
convertir la elección del mejor epsilon observado en garantía general.

Missingmean,missingtanh,biasmean y extrasigmoid se rechazan en los tres casos frente
a FD1e-5. Gradcheck de la función PyTorch usa eps1e-6/atol1e-5/rtol1e-3; se distingue
de comprobar directamente nuestro backward NumPy. Este se compara aparte con
autograd y diferencias finitas. Las estadísticas de error relativo no sustituyen
el criterio por componente.

Los10tests Python comprueban también batch3 para no depender de que n=h=4.
Los3tests JS cotejan el grafo con Python/PyTorch y prueban selección de datos y null.
Se escribieron antes de implementar: manual ausente desde cwd correcto y framework
ausente en el runtime ya preparado; después pasan. No se atribuye a esos fallos
de módulo ausente un bug funcional que no se hubiera ejecutado.

## Autograd: controles observados

Dos forwards nuevos con backward sin reset producen2g; resetgradNone y otro paso
recuperan g. Los pesos permanecen iguales: backward no hace una actualización.
El forward con hidden.detach deja12None en hojas nuevas, mientras los5parámetros
de salida reciben gradientes. No se convierten None en ceros.

El caso non-leaf se comprueba después de backward, no simplemente antes de que
existan gradientes: hidden.grad permanece None sin retain_grad, mientras las hojas
sí reciben grad. Otro recorrido retiene hidden.grad(4,4). Son observaciones distintas
de cortar una trayectoria con detach.

Grafo consumido y lossno_grad se prueban con hojas independientes y producen los
errores esperados. No se afirma que todo grafo imaginable necesite saved tensors
para una segunda derivación. VJP con semilla(p-y)/n coincide con backward/manual;
no se comprueban derivadas de orden superior. Detach comparte almacenamiento,
como especifica la documentación, y el control no modifica esos datos.

## Runtime y fuentes

Captura2026-10-25T15:57:58.702433+00:00. Image CPU Jupyter PyTorch fijada por digest
amd64 en runtime.json; consultada y descargada mediante pnpm runtime:fetch.
Python3.13.17,NumPy2.5.4,PyTorch2.14.1+cpu,x86_64,Intel CoreUltra9 285H. Dos CPUs/2GiB,
un thread Torch/interop/OMP/OpenBLAS/MKL. No pip/conda/uv o paquetes Python en host.

Los ejercicios usan pullnever,rednone,usuario1000:100,capdropALL y dos bindsreadonly:
paquete propio y neural-foundations. Finally elimina solo su nombre aleatorio
comprobado, sin prune. No container luisrc-autodiff- restante tras las ejecuciones.
La image se conserva como runtime para los siguientes bloques.

Catorce hashes: doce fuentes propias y neural.py/training.json de P096. Verify
vuelve a ejecutar contrastes, FD, gradcheck y controles; rtol1e-10/atol1e-12 para
comparar el informe. Estadísticos FD sensibles al redondeo: no promesa bit a bit
entre BLAS/hardware. El entrenamiento P096 mantiene su runtime e informe originales.

## Integración y QA

Siete exports canónicos: HTML/controlador,model/charts,comparison.json y dosSVG.
El navegador solo recalcula el grafo escalar; los contrastes matriciales son datos
archivados, sin ejecutar framework o API de control. Código completo en el monorepo.

Sin dependencias declaradas nuevas ni cambios de lockfiles. Frozen install38proyectos
pasa;37laboratorios,270índices y109exports. Pasan149checks editoriales/estructurales,
19tests blog,10Python y3JS. Build/Pagefind correctos:73HTML,10páginas indexadas,
4280palabras/dosidiomas. Drafts excluidos de publicación. Auditor72draft_exists/
19related_only/84not_written: inventario, no aceptación global.

Chromium final12vistas a1440/360:56etapas escalares,294comparaciones y714selecciones
de parámetros. Se comparan tablas, curvas, cursores y barras con signo; los12None
no se dibujan como ceros. Teclado, scroll interno, enlaces/assets y error de carga.
Sin overflow global, errores JS o peticiones del visor fuera de su carpeta.
Informe `/tmp/autodiff-foundations-layout.17jyHx/report.json`. .WmF9fq es anterior
a la mejora de fuentes/formato. Prueba adicional de tamaño en diez vistas:
`/tmp/autodiff-visuals/final-figures.json`.

Inspección visual de cinco diagramas, dos gráficas, visor y código Python móvil.
La ampliación de etiquetas y el límite de figuras conservan ejes/valores. Los posts
siguen siendo piezas específicas, alrededor de1200palabras con código/metadatos.

## Continuación

P097 desarrollado como cinco drafts y experimento local. No prueba GPU, convergencia
del entrenamiento, funciones arbitrarias o todos los comportamientos de PyTorch.

Siguiente P098: epochs,batches,minibatches,SGD,momentum,Adam/AdamW,schedules y
gradient accumulation. Comparar curvas de entrenamientos reales con idénticas
muestras y un protocolo justo; no sustituirlas por una animación de la fórmula.
El runtime PyTorch CPU ya está disponible y debe inspeccionarse al reanudar.

P066 y P096 se preservan junto con este bloque sin commits automáticos. Mantener
P026,Stripe sandboxP045,soakP058 y Serie02solo estructuras/algoritmos. El objetivo
global sigue activo.
