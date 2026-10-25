# Revisión P100: generalización y estabilidad

Diez drafts españoles de Luis Ramírez Calle, independientes de PaySafe. Ver
[ruta](ruta-generalizacion-estabilidad.md),[manifiesto](generalization-stability-series.json)
y[glosario](generalization-stability-glossary.md). P098/P099 se preservan junto con
P100 sin commit; no hay traducción,publicación o audio nuevos. Últimos commits
explícitos blog9412094/ejemplosb900c13. El turno anterior fue progreso:P099 escrito,
ejecutado yverificado,con reanudación real ycontroles negativos.

## División y alcance

| Post | Pregunta propia | Evidencia |
| --- | --- | --- |
| P100 | Overfit,underfit o fallo numérico | Curvas reales yreferencia lineal resuelta |
| DL-BIAS-VARIANCE | Qué cambia entre muestras | 32datasets,identidad finita,error cuadrático |
| DL-INITIALIZATION | Cómo empieza la propagación | Fan-in,simetría,cuatro pares de controles |
| DL-ACTIVATION-STABILITY | Qué hace una derivada local | Cinco valores,cuatro funciones,cadenas yunidad inactiva |
| DL-BATCHNORM | Qué introduce el batch | Fórmula,ejes,running stats,train/eval |
| DL-LAYERNORM | Qué información normalizamos | Primer ejemplo independiente de compañeros,ejes yscalar |
| DL-DROPOUT | Qué conserva una máscara escalada | Probe p.2 yentrenamiento separado p.15 |
| DL-WEIGHT-DECAY | Qué contraer ycómo evaluarlo | Grupos de matrices/vectores ycomparaciones emparejadas |
| DL-EARLY-STOPPING | Cuándo parar yqué recuperar | Política,deepcopy,restauración yparada prematura |
| DL-GRADIENT-CLIPPING | Qué queda limitado | Norma global,contraejemplo Adam ycontrol inestable |

Se dividió P100 en diez preguntas específicas:953–1127palabras con código/metadatos,
diecisiete extractos Python coincidentes con fuentes ejecutadas,diez D2/SVG ycuatro
gráficas estáticas. No hace falta otra subdivisión para desarrollar estos focos.
Los posts conservan mecanismo,decisión,trade-off,prueba,ejercicio ylímites.
P101 conserva CNN/transfer learning;sus requisitos no se dan por cubiertos aquí.

## Protocolo neuronal y sobreajuste real

Laboratorio nuevo `packages/generalization-stability`;no modifica ni importa código
hash de P096–P099. Reutiliza el runtime CPU. Regresión sin(2πx),24posiciones train
equiespaciadas[-1,1],ruido normalσ.25/seed101 ydesplazamiento+1.25del target8 SOLO en
train. Validation256xUniform/seed102,ruidoσ.25,sin desplazamiento adicional. No son
dos datasets iid limpios;se declara contaminación deliberada. Grid101con señal
conocida para dibujar funciones,no para seleccionar checkpoints. Sin test final.

MLP1→64→64→1,ReLU,float64,4353parámetros;He uniforme en ocultas,Xavier en salida,
bias0. AdamWlr.01,un update full-batch por epoch,máximo2000. Seeds7/19/31 por seis
variantes:baseline,dropout.15,decay.01matrices,BatchNorm,LayerNorm yearly stopping.
Dieciocho runs. Inicializaciones lineales idénticas por seed;normalizaciones
añaden256parámetros yno se presentan como arquitectura inalterada.

Train/validation se monitorizan cada10epochs en eval/no_grad. onlineMseLast
corresponde al último update en modo train,con máscara/estadísticas cuando aplica.
No se intercambian métricas de modos distintos. Se guardan curvas ypredicciones
de initial/best/last/selected,sin inventar puntos después de detenerse.

Baseline seed7:mejor validation en430,.19604054604837695;final2000 train
.006491937377975408/validation.20470132301923102. Seed19:best310,.18318552006704159,
finalvalidation.2053928660573746. Seed31:best310,.17671782482354925,finalvalidation
.19526821685955617. Las tres terminan con menor train ypeor validation que su
mejor checkpoint monitorizado. La gráfica de función muestra la memorización
del punto contaminado. La referencia lineal por mínimos cuadrados obtiene train
.3650527625041952/validation.4953123923271635;no es un SGD detenido antes del óptimo.

## Correcciones y resultados que no mejoran

Early:min_delta0,patience10checks de frecuencia10. Seeds7/31 mejoran frente al final
continuo:paran530/410 yrestauran430/310. Seed19 para170/restaura70,validation
.2728629473859309,peor que el final continuo. Su prefijo es idéntico al continuo;
la política se detiene antes de la mejora posterior,no falla al copiar/restaurar.

La expectativa inicial del verificador de que early mejoraría las tres seeds
resultó falsa. Se registró su rechazo SIN cambiar datos,hiperparámetros oduración.
El verificador exige propiedades pertinentes y más específicas:prefijo idéntico,
mínimo monitorizado,patience exacta,restauración ylos dos éxitos/un fallo observados.
No confunde un resultado estadístico no garantizado con un bug del algoritmo.

Dropout empeora las tres comparaciones finales. Decay mejora una,BatchNorm una,
LayerNorm otra. Se publican todos los runs;no hay selección posterior de un ejemplo
favorable. Las tres seeds comparten train yvalidation,no son tres datasets ni
intervalos de confianza. Best de un continuo completo es retrospectivo;no se
atribuye información futura a la política que ya se había detenido.

## Controles independientes

- Bias/variance:32datasets aleatorios de24puntos SIN outlier extra,Legendre1/5/15,
  ridge1e-4. Identidad del conjunto finito,variance con divisor32. Grados1/5/15:
  bias² .42248754/.11052591/.26800421;variance .03529539/.22991333/22.08247480.
  La media finita no es bias poblacional exacto ni una ley monotónica de capacidad.
  Ruido esperadoσ²=.0625,no cota de toda medición finita.
- Initialization:8capas16→16,128inputs,seeds303/606. Ceros/ReLU,Xavier/tanh gain1,
  He/ReLU,normalstd3/tanh. Segundo momento no se confunde con varianza tras ReLU.
  Tanh grande:81,25%final |a|>.99,pero norma de gradiente de inputs196.364688.
  Saturación local no demuestra vanishing global. ReLU tiene saturationFractionnull,
  no una fracción falsa basada en |a|>.99.
- Activations:derivadas autograd sobre−5/−1/0/1/5,ReLU en0usa0. Unidad de bias−1 y
  target1:ReLUgradient0,Leaky no0. Cadenas tanh(3h)/ReLU(3h),esta última grad3^12.
- BN/LN:matrices4×3,primera fila fija ycompañeros cambiados. Fórmulas manuales,
  affineFalse para aislar estadísticas. BNforward varN/runningvarN−1,momentum.1,
  eval tracked/untracked,singleton2D rechazado en train. LNporfila conserva la
  primera salida. Las variantes entrenadas sí incluyen parámetros affine.
- Dropout:probe p.2 sobre60000unos:valores0/1.25,media.99760417,ceros.20191667,
  eval identidad. No se presenta como medición de la variante de entrenamientop.15.
- Decay:solo matrices en esta arquitectura,bias/vectores excluidos. Norma de pesos
  no se usa como certificado de generalización o comparación entre arquitecturas.
- Clipping:[3,4]norm5→≤2;valor devuelto previo,NaN rechazado. Adamconclip1e-4/lr.1
  se desplaza≈.09999,superior aητ. Parábola50θ²:lr.05sinclip guard enstep9,
  loss3.4359738368e12;conclip1 acota pasos pero sigue oscilando,loss.0711583530tras40.
  Lr.01resuelve el control. Clipping no se aplica a los18runs de generalización.

## Reproducción e integración

Captura final2026-10-25T20:51:40.314824+00:00. Runtime inspeccionado por digest,
linux/amd64,Python3.13.17,NumPy2.5.4,PyTorch2.14.1+cpu. Dos CPUs/2GiB,un thread
OMP/BLAS/MKL/Torch,rednone,pullnever,rootfs/bindreadonly,user1000:100,capdropALL.
Runner con timeout300s;crea/limpia solo su contenedor aleatorio precomprobado.
Sin pip/conda/uv,paquetes Python en host ocloud.

Once hashes de fuentes/tests/protocolo/runtime/runner. Dos copias JSON iguales.
Verify vuelve a ejecutar18runs ycontroles,rtol1e-9/atol1e-11 ypropiedades de
trayectorias. La captura no se cambia para hacer que todas las intervenciones
sean favorables. No se promete igualdad entre hardware/versiones.

Pasan10tests Python,3JS,170checks editoriales/estructurales y19tests blog.
Se escribieron contratos antes de training/probes/model:fallos de import ausente,
después casos verdes. Se conserva el fallo posterior de la expectativa universal
de early como hipótesis rechazada,con diagnóstico explícito ycontrato comprobado.
Frozen pnpm install41proyectos pasa,sin dependencias nuevas ocambio de lockfile.
40labs,294índices,133exports. Build50rutas/76HTML,Pagefind10páginas/4280palabras/
dosidiomas. Drafts excluidos. Inventario75draft_exists/19related_only/81not_written
es existencia,no aceptación global.

## Navegador y continuidad

Chromium comprueba10posts yvisor en1440/360px. Por ancho:54checkpoints,
72snapshots de función,96selecciones de capa/métrica,4matrices y9steps de clipping,
más cuatro activations,tres grados,teclado,scroll,links,iframe yerror404.
No se dibujan nulos como ceros ni se extienden curvas después de la parada.
Las escalas de clipping declaran log10(1+MSE),que incluye cero.
Informe final `/tmp/generalization-stability-layout.45nR1C/report.json`;
j1myqw es anterior a las mejoras de ticks yformato de tablas.

Inspección visual de diez diagramas,cuatro gráficas,código,controles,funciones
best/last yparada prematura19. `/tmp/generalization-visuals/report.json`.
Capas con ticks enteros;matrices redondeadas a cinco cifras en UI para caber
mejor en móvil,JSON con precisión completa. Código inicial scrollLeft0.
Figuras≤380px,font de gráfica14px,regiones de tablas enfocables con scroll interno.

Siguiente P101:convolution,kernels,padding,stride,pooling,receptive field,feature
maps,arquitecturas ytransfer learning. Requiere entrenar CNN pequeña einspeccionar
mapas reales,no solo dibujar una convolution. Dividir preguntas antes de escribir.
Preservar P026,Stripe sandboxP045,soakP058 ySerie02solo estructuras/algoritmos.
El objetivo global sigue activo;no hay commit/push automáticos.
