# Revisión P066: capacidad y costes

Siete drafts españoles, autor Luis Ramírez Calle, ordenados en el
[manifiesto](capacity-costs-series.json) y la [ruta](ruta-capacidad-costes.md).
Independientes de un producto concreto. Sin traducción, publicación ni audio.
La ficha queda desarrollada como material editorial y laboratorio de cálculo;
no se acredita capacidad cloud, SLO o factura de un servicio real.

## Cobertura y evidencia

| Temario | Entrega | Comprobación |
| --- | --- | --- |
| RPS / concurrency | P066 | Little con unidades, medias compatibles, límites y closed/open-loop; resultados 20/80 calculados |
| Utilization | CAP-UTILIZATION | Target, réplicas de margen, utilización tras pérdida, mínimo y máximo; inviabilidad visible |
| Bottlenecks | CAP-BOTTLENECKS | Techos API/DB, slots, demanda por visita y efecto del número de visitas |
| Autoscaling | CAP-AUTOSCALING | Simulación fluida separada del HPA real; preparación, cola limitada y conservación |
| Cost estimates | CAP-ESTIMATES | Tres perfiles, cinco partidas, microUSD exactos, ideal por franjas vs pico permanente |
| Reservations | CAP-COMMITMENTS | Descuento separado de capacidad; contrato ficticio, exceso y ociosidad; matices AWS con fuentes primarias |
| Cost/req / FinOps | CAP-FINOPS | Ofrecidas/buenas, cero denominador, reparto reconciliado y decisión revisable con SLO |

Cada entrega tiene pregunta, tres capacidades y tres errores frecuentes definidos
en el manifiesto; desarrollo, mecanismo, alternativas, límites, ejercicio y fuentes.
Siete extractos TypeScript coinciden con el modelo probado; un JSON reproduce las
tarifas. Siete diagramas D2/SVG verticales de 240–292px, gráfico estático 380×425 y
comparador interactivo. El glosario complementa el de servicios fiables.

## Tres escenarios declarados

Treinta días, perfiles diarios: 8RPS24h;10RPS16h+120RPS8h;20RPS23h+300RPS1h.
CPU10ms,1core/réplica,target60%,margen1,mínimo2/máximo8. Son entradas hipotéticas,
no parámetros medidos del host o de AWS. Las tarifas son ficticias en USD:
0,06/h-réplica,30/mes fijo,1/millón requests,0,10/GiB-mes,0,09/GiB salida.
Stock50GiB,10000bytes por petición ofrecida y99,9% buenas supuesto.

Subtotales exactos:159,516715;358,147501;279,478662USD. Horas-réplica por ajuste
ideal:1440/1680/1560. El pico permanente cambia solo la partida compute. Ninguno
incluye DB, balanceador, logs, backups, impuestos, ingeniería, tráfico entre zonas,
arranque/rollout o condiciones comerciales reales. No se presenta como TCO.

Sensibilidades: CPU×2,payload×10,DB5/20ms y compromisos2/6unidades. Payload×10 en
campaña produce898,666613USD. CPU×2 necesita once réplicas para su pico: máximo8,
por tanto inviable para la política aunque se pueda calcular el coste parcial de
los recursos limitados. La advertencia aparece en el post y en el comparador.

El presupuesto supone réplicas listas al inicio de cada franja. La simulación de
cinco minutos se mantiene separada: no se integra ni extrapola como gasto mensual.
Los rechazos simulados no se transforman en facturación o peticiones buenas del
presupuesto. Ese último porcentaje es un supuesto independiente y visible.

## Código, cálculos y garantías limitadas

Código en `luisrc-blog-examples/packages/capacity-costs`. Dinero BigInt en microUSD,
redondeo por partida hacia arriba, strings JSON y denominadores enteros. Reparto
por mayores restos con desempate estable por índice; reconcilia, sin atribuir
causalidad real a pesos ficticios. Cero denominador devuelve null.

Simulación60pasos de5s: demanda20/300/20RPS, muestreo15s, preparación30s, hold60s,
cola1000. El controlador conoce demanda, no emula HPA ni sus métricas. Conserva
llegadas=servidas+rechazadas+cola. Resultados reactivo/preparado/DBlimitada:
2000/0/11000rechazos calculados. No clientes HTTP, latencias individuales, timeouts,
reintentos o distribución real de servicio. La traza distingue estado final del
intervalo y tasa/réplicas aplicadas durante él.

Cálculo final `2026-10-25T14:04:05.173Z`, Node24.19.0, nueve hashes de entradas.
`verify` recalcula casos/sensibilidades/trazas y exige model.mjs idéntico al resultado
de eliminar tipos de model.ts. La transformación usa API experimental de Node,
por eso se fija la versión de reproducción; no sustituye el chequeo estático.

Tests escritos primero: fallo inicial por módulo ausente, luego siete contratos
pasan. No se presenta como fallo de comportamiento observado en un proveedor.
TypeScript strict pasa con5.9.2 mediante pnpm dlx y tsconfig propio. Un chequeo
inicial usó5.9.3 instalado en el blog; se añadió después el comando con compiler
fijado. El workspace ejecuta pnpm12.8.1; el subcomando dlx observado utiliza12.15.0.
No nuevas dependencias declaradas o cambios en ninguno de los lockfiles.

Seis exports permitidos: HTML, controlador del visor, modelo sin tipos, chart,
comparison.json y SVG. No fuentes de laboratorio bajo public ni ZIPs. Sin API de
control. Modelo del navegador y del laboratorio compartido, no dos fórmulas.

## Validación editorial y visual

Pasan siete tests del paquete,137checks editoriales/estructurales y19tests del blog.
Los cinco checks nuevos verifican metadatos, dependencias, fragmentos, medidas SVG,
importes, hashes, conservation, exclusiones y exports. Build y Pagefind pasan:
50rutas,71HTML,10páginas indexadas/4280palabras/dos idiomas; los drafts no se publican.
Índices260,laboratorios35,exports94. Frozen install36proyectos pasa sin cambiarlock.
Auditor70draft_exists/19related_only/86not_written: inventario, no aceptación global.

Chromium final16vistas(7posts+visor a1440/360px),48combinaciones mensuales,360intervalos
recorridos con teclado, controles anterior/siguiente, cambios de preparación, Little,
inviabilidad, cero buenas y error de informe. Tablas, valores, curvas y cursor se
comparan con los cálculos. Sin overflow global, errores JS o requests del visor
fuera de su carpeta de assets. Informe `/tmp/capacity-costs-layout.MqoIWu/report.json`.
La captura .JIhjQE es anterior al formato final de las fuentes.

Inspección visual de los siete diagramas, gráfica monetaria, presupuesto, tabla y
traza en móvil; captura adicional del bloque de código. Se usa scroll interno en
código/JSON y regiones focusables; no se hace caber código largo reduciendo la fuente.

## Continuación y límites de aceptación

P066 cubierto como drafts y cálculo verificable. Antes de aplicar una decisión a
producción hacen falta demanda observada, servicio medido, tarifas y factura del
alcance, pruebas ante fallos y criterios SLO. No existe ahorro realizado acreditado.

Servidor QA propio1145405 detenido al cierre y puerto4322 sin listener. No se han
creado recursos cloud o contenedores para este bloque. Cambios sin commit/push.

Siguiente bloque: P096, Deep Learning. Revisar prerrequisitos P076/P078/P079 y
separar perceptrón/activaciones/MLP antes de backpropagation. El laboratorio NumPy
no puede sustituirse por una mera animación; necesita entrenamiento y contraste
sobre datos no lineales reproducibles. Mantener gapsP026,Stripe sandboxP045,soakP058
y Serie02limitada a estructuras/algoritmos. Objetivo global todavía abierto.
