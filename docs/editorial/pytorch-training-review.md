# Revisión P099: entrenamiento PyTorch y checkpoints

Siete drafts españoles de Luis Ramírez Calle, independientes de PaySafe. Ver
[ruta](ruta-entrenamiento-pytorch.md), [manifiesto](pytorch-training-series.json)
y [glosario](pytorch-training-glossary.md). P098 se conserva sin commit junto con
este bloque; no hay traducción, publicación o audio nuevos. Últimos commits
explícitos: blog `9412094`, ejemplos `b900c13`.

## División y cobertura

| Artículo | Contrato explicado | Evidencia |
| --- | --- | --- |
| P099 | Tensor, shape, dtype, device, broadcasting | Resta4×4/4×1, rechazo BCE, copia/alias NumPy |
| DL-DATALOADER | Muestra, sampler, collation y batch | Orden real, cobertura, cola16 y generador dedicado |
| DL-MODULE | Registro y forward de la MLP | Cuatro tensores,17escalares, contraste NumPy |
| DL-TORCH-LOOP | Autograd, loss y optimizer | Traza del primer update y540steps por run |
| DL-EVALUATION | Modos y registro de gradientes | Probes, hooks dentro de evaluate y media ponderada |
| DL-CHECKPOINT | Guardar/cargar para predecir | Archivo real, esquema, strict state_dict y128logits idénticos |
| DL-RESUME | Continuar el proceso con estado | Completa exacta y tres controles incompletos |

Se dividió antes de redactar, separando datos/modelo/loop/evaluación e inferencia
de reanudación. Extensión aproximada1044–1249palabras con código/metadatos; cada
pieza conserva una pregunta propia, tres capacidades y tres errores frecuentes.
Catorce extractos Python coinciden con fuentes ejecutadas. Siete D2/SVG, dos
gráficas y visor. Figuras con ancho natural o máximo380px. Broadcasting se
rediseñó en ramas354×596 para conservar lectura móvil; el loader empieza por
sampler, después Dataset y collation. No hace falta otra división de estas preguntas.

P100 conserva underfit/overfit,bias-variance,initialization,activation,batch/layer
norm,dropout,weight decay,early stopping yclipping. El probe Dropout de este bloque
solo demuestra modos; no equivale al experimento de regularización de P100.

## Pipeline y resultados

`packages/pytorch-training` importa el modelo/generador canónico de
`neural-foundations/neural.py` sin alterar fuentes o evidencia de P096–P098.
Train256/validation128,seeds101/102,cuatro grupos alrededor de(±1,±1),semiancho0,45.
MLP2→4→1,tanh,float64,CPU,BCE media desde logits. Inicializaciones NumPy7/19/31
copiadas a Linear con transposición; forward inicial contrastado sobre256puntos.

DataLoader map-style,shuffleTrue,generator420 dedicado,num_workers0,drop_lastFalse,
batch30: ocho grupos de30 yuno de16. Sesenta epochs,540updates,15360muestras por run.
Evaluación batch50,cola6 en train y28 en validation; generadores separados.
No se afirma identidad con el orden/budget de P098 ni un benchmark NumPy/PyTorch.
Sin test final,búsqueda de hiperparámetros o mediciones de tiempo/memoria.

SGDlr0,1,momentum0,9,decay0; StepLR por epoch completada,step_size20,gamma0,5.
Epoch20 usa0,1/prepara0,05; epoch60 usa0,025/prepara0,0125. Historia: métricas a pesos
fijos,loss online con pesos cambiantes,contadores,tasas,orden yestado. Se comprueba
cobertura de256índices sin duplicados yla traza distingue backward de step.

Validation BCE final: seed7,0,008309222327672137; seed19,0,004984868028258361;
seed31,0,00806297935233508. Accuracy1 en las tres. No demuestra calibración,
robustez o generalización en un proyecto real.

## Controles que distinguen errores

- Broadcasting: residuos4×4 y4×1,MSE2,625/1,875. BCE rechaza el target plano;
  no se le atribuye el broadcasting silencioso de la resta.
- From_numpy refleja una mutación9;tensor conserva la copia0. El test provoca
  incompatibilidad float32/float64 en el modelo de float64.
- Eval no elimina autograd,no_grad no activa eval. Dropout independiente:
  dos forwards train difieren,eval conserva la entrada. La MLP no lo usa.
- Un hook dentro de evaluate comprueba modo eval ygrad desactivado en cada
  forward. Comparar solo pesos no habría descubierto omitir esas llamadas.
  El helper restaura el modo general,no configuraciones mixtas arbitrarias.
- Validation inicial correcta0,7094226372354705;media de medias incorrecta
  0,713554108154547. Conteos yloss sumada incluyen la cola.
- State_dict superficial refleja cambios;deepcopy conserva snapshot. Serializar
  inmediatamente ya escribe valores: el archivo no cambia por mutar el modelo.

## Save/load y reanudación

Torch.save en .pending y os.replace en el mismo directorio temporal propio.
Archivos reales leídos con map_locationCPU yweights_onlyTrue; no se exportan .pt.
No se promete durabilidad distribuida ni confianza en archivos desconocidos.

Esquema1/inference:arquitectura,dtype ymodelo. StrictTrue,reconstrucción ymodo eval.
Máximo error de128logits recargados0. Se rechaza width3 o kind incompatible.
El flag weights_only de carga restringe deserialización,no implica que el
diccionario no pueda incluir metadatos compatibles.

Esquema1/epoch_boundary_resume:modelo,optimizador,scheduler,protocolo,seed,epoch,
updates,RNGloader/RNGCPU,history ytrace. Historial/traza son diagnóstico,no necesarios
para el próximo gradiente. Corte tras epoch30/270updates,scheduler avanzado.
Se rechaza guardar con epoch abierta; no se prueba reanudar a mitad de recorrido.

Se construyen objetos antes de restaurar. Completa: parámetros e historial exactos
localmente. Máximos errores finales frente al continuo:resetmomentum
0,014656894259553077;resetorden0,0031808286283903087;solo modelo0,34088931131596034.
Resetmomentum conserva tasa/reloj;resetorden conserva optimizador/scheduler.
Solo modelo omite varios estados,no aísla una causa.

Solo modelo termina con validation0,0059490575210175475,menor que0,008309222327672137
del continuo. Se publica para distinguir calidad de una cifra y fidelidad de
reanudación. Los tests exigen igualdad completa yrechazo de controles incompletos.

El forward principal no consume RNGglobal. Por eso un estado CPU idéntico puede
coincidir incluso sin restaurarlo. El informe usa cpuRngMatchesSaved, no un nombre
que deduzca una acción de esa coincidencia. El test perturba primero el RNG con11
draws,comprueba estado previo distinto yrestauración efectiva. El control del
loader sí demuestra una fuente aleatoria que cambia el entrenamiento.

Sin GPU,AMP,DDP,workers,prefetch,augmentations o RNGexternos. NumPy usa generadores
locales reconstruidos desde seeds; los loaders de evaluación no afectan updates
en este diseño. Cambiar esas condiciones obliga a revisar el checkpoint.

## Reproducción y verificación

Captura final2026-10-25T20:31:47.167940+00:00. Runtime CPU reutilizado e inspeccionado
por digest/linux-amd64:Python3.13.17,NumPy2.5.4,PyTorch2.14.1+cpu. Dos CPUs/2GiB,un
thread OMP/BLAS/MKL/Torch. Rednone,pullnever,rootfs/dosbindsreadonly,usuario1000:100,
capdropALL; limpieza solo del contenedor aleatorio propio precomprobado. Sin
paquetes Python en host o cloud. Ver README para comandos y límites.

Trece hashes incluyendo tests/runner/modelo anterior. Verify vuelve a entrenar,
guardar,cargar ycontrastar con rtol1e-10/atol1e-12; además exige igualdad local
completa ydesviación>1e-8 en controles. No promete igualdad entre equipos/versiones.

Pasan13tests Python y3JS. Contratos escritos antes de sus implementaciones:
pipeline/probes/model ausentes,después casos verdes. Se reforzaron después los
tests para observar restauración de RNG ymodo real de evaluate. No se atribuyen
errores de módulos ausentes a bugs numéricos que no se hubieran ejecutado.

Frozen pnpm install40proyectos pasa,sin nuevas dependencias o cambios de lockfile.
39labs,284índices,124exports. Pasan163checks editoriales/estructurales y19tests blog.
Build50rutas/75HTML;Pagefind10páginas/4280palabras/dosidiomas. Drafts excluidos.
Inventario74draft_exists/19related_only/82not_written no es aceptación global.

## Navegador y continuación

Chromium final16vistas,1440/360px:126checkpoints,96comparaciones de reanudación,
4selecciones de shapes y972filas de batches. Se cotejan tablas,curvas,cursores,
órdenes,nulls,teclado,scroll interno,enlaces,iframe,error404 ypeticiones locales.
Sin errores JS o overflow global. Informe final:
`/tmp/pytorch-training-layout.aY61GG/report.json`.

El primer intento PxXTCR detectó una frase técnica sin espacios que excedía16px
el viewport. Range de texto confirmó la causa; se corrigió la frase,sin ocultar
overflow o relajar el test. V3ocsl es previo a la última captura de evidencia.
Inspección visual de siete diagramas,dos gráficas,código yvisor. Navegación limpia
del código:scrollLeft0 yclass visible. Evidencia adicional:
`/tmp/pytorch-final-visuals/report.json`. Tablas anchas desplazan dentro de su región.

Siguiente P100: introducir overfitting deliberado ycomparar correcciones sobre un
protocolo declarado. Este XOR fácil no demuestra ese fenómeno. Separar diagnóstico,
initialization,activations,normalización,dropout,decay,early stopping yclipping.
Mantener P026,Stripe sandboxP045,soakP058 ySerie02solo estructuras/algoritmos.
El objetivo global sigue activo; no hay commit/push automáticos.
