# Revisión de la serie de Machine Learning clásico

Fecha de consulta y ejecución: 18 de octubre de 2026. Autor: Luis Ramírez Calle.
Diez artículos P086–P095 en español y borrador, sin audio o traducciones. La serie
de Matemáticas y estadística se guardó en el commit `ffb1a33`. Esta entrega nueva
queda sin commit para revisión; no se ha hecho push.

## Alcance y resultado

Los artículos siguen una pregunta principal y explican mecanismo, decisiones,
alternativas, errores y límites. Aproximadamente diez mil palabras entre los diez
archivos, incluidos metadatos y código. Ejemplos independientes de una empresa.
Orden en ruta-machine-learning.md; objetivos y errores a evitar en ml-series-scope.md.

Recursos: diez diagramas D2/SVG, cinco gráficas ECharts derivadas de resultados
archivados y un explorador dinámico de thresholds/costes. El explorador utiliza
solo validation, ofrece teclado, valores en texto y matriz accesible, no ajusta
modelos ni selecciona políticas sobre test. Se enlaza desde el artículo de métricas.

Laboratorio descargable con quince archivos, incluyendo CSV, código Python con
anotaciones, tests, versiones, protocolo, resultados, explorador y sus datos.
No incluye la imagen Docker ni las bibliotecas científicas: el README lo declara.
No se ha ejecutado un type checker Python; las anotaciones no se presentan como
prueba estática completa. El código runtime sí está probado.

## Evidencia obtenida

- `node --test tests/*.test.mjs`: cuarenta y dos tests del blog aprobados. Seis nuevos
  cubren el explorador, metadatos/DAG, recursos, extractos, ZIP y reconstrucción de
  métricas desde predicciones. Otros dos verifican el inventario de 175 fichas; el
  resto es regresión de entregas anteriores.
- `node scripts/run-ml-lab.mjs tests`: diecisiete tests Python aprobados. Datos
  reproducibles, limpieza, corte temporal, imputación train-only, categoría nueva,
  OLS contra sklearn y caso singular, métricas conocidas, calibración, clustering,
  bootstrap pareado, huellas y reproducción de todos los cálculos archivados.
- **59 tests distintos**, sin sumar de nuevo las ejecuciones repetidas del ZIP.
- Los catorce tests numéricos iniciales se escribieron antes de la implementación;
  se observó fallo por módulo data ausente. Se corrigió después una comparación
  exacta entre dos representaciones float de 5/6, sustituyéndola por tolerancia.
  No se cambió el valor matemático esperado.
- `node scripts/check-ml-drafts.mjs`: diez páginas, 38 fórmulas KaTeX sin errores,
  CSS matemático, noindex, orden 1/10–10/10, anclas TOC y diecisiete recursos HTTP.
- `node scripts/check-ml-browser.mjs`: veinte vistas en Chromium, diez posts a
  1440 y 360 px, treinta cargas de imágenes, sin overflow global ni pageerror.
  Cinco comprobaciones del explorador: matriz inicial, threshold 0,2 con teclado,
  threshold 1, coste inválido y coste corregido; también responsive a 360 px.
- `pnpm build`: 48 rutas Astro; Pagefind detecta 49 HTML al incluir el explorador
  estático y sigue indexando solo ocho posts publicados, dos idiomas. El explorador
  tiene noindex y no lleva data-pagefind-body. No aparecen rutas de los diez drafts.
- Se inspeccionaron como imágenes los diez diagramas, cinco gráficas y capturas
  de post/escritorio/móvil. Evidencia temporal en `/tmp/ml-qa.fh8uXN`, gráfica de
  clustering corregida `/tmp/ml-clustering-final.png` y navegador final en
  `/tmp/ml-browser.T0u2v8` (incluye report.json y explorer-360.png).

El ZIP se extrajo y ejecutó en una carpeta aislada en /tmp. Las pruebas y la
reproducción independiente se repiten después de incorporar el explorador para
comprobar también su inventario final. Ver README para requisitos del entorno.

## Procedencia, protocolo y límites de resultados

Imagen científica ya disponible, fijada por digest en runtime.json: Python 3.13.15,
NumPy 2.5.3, pandas 3.0.6, SciPy 1.18.1, scikit-learn 1.9.1. Sin red ni instalación
de bibliotecas ML. Se reutilizó pnpm para herramientas existentes del blog y
Chromium/Playwright del laboratorio frontend; pnpm repuso diecisiete dependencias
ya fijadas de su caché, sin cambios en manifests o lockfiles.

CSV sintético: 909 filas, seis duplicados y tres inválidas; 900 tras limpieza.
Diez distancias y cinco cargas ausentes. Train/validation/test 540/180/180; la EDA
de relaciones solo usa train. La lluvia es una previsión disponible al salir y
delay_minutes es un resultado, nunca una feature. SHA-256 de CSV y protocolo en
results/experiments.json. Dataset semilla 20261018; bootstrap semilla 17.

Referencias finales predefinidas: constante, logística y bosque, sin elegir después
por test. AP de test 0,2611/0,7546/0,7161; el registro conserva las predicciones para
reconstruir AP, AUC, matriz y Brier. No es un ranking de bibliotecas o un benchmark.
XGBoost, LightGBM y SHAP se explican, pero no se ejecutan ni se les atribuyen cifras.

El bootstrap es de pérdidas fijas en validation y no incorpora reentrenamiento,
dependencia temporal o cobertura repetida. La comparación de calibración cambia
también estimadores base y no mejora Brier en esta realización. Dos semillas iguales
en clustering no son un estudio amplio de estabilidad; un ARI alto frente al
generador no demuestra categorías operativas reales.

## Incidencias corregidas y revisión editorial

La primera comprobación de capturas usó h1 sin delimitar el contenido y encontró
encabezados de la barra de desarrollo Astro. Se corrigió el selector al ID del
artículo y se mantuvo la comprobación. Después se detectaron tablas demasiado anchas
en P091 y P095 a 360 px; se acortaron encabezados y se trasladó Brier a texto en P095.
La comprobación completa posterior pasó sin relajar el criterio de overflow.

La gráfica inicial de clustering superponía el nombre del eje con la leyenda y
deformaba visualmente las distancias al usar diferente escala física por coordenada.
Se cambió a un área cuadrada y se movió la etiqueta lateral. Inspección posterior
sin solapamiento visible. No se cambiaron estilos globales del blog.

Se aplicó la guía de escritura: aperturas concretas, términos ingleses definidos,
denominadores/unidades explícitos, decisiones razonadas y límites cercanos a las
afirmaciones. Sin experiencias inventadas, guiones largos, hype o ventajas de
rendimiento sin medidas. Las capturas móviles muestran enlaces para ampliar gráficas.

Fuentes primarias consultadas: Google ML, documentación NumPy/pandas/scikit-learn/
SciPy, XGBoost, LightGBM, SHAP y Fairlearn. URLs comprobadas con navegación; una
página inicial de métricas Fairlearn falló y se usó su documento conceptual accesible.
No se copiaron tablas de benchmarks ni citas largas de terceros.

## Objetivo ampliado: no confundir esta entrega con el roadmap completo

El usuario ha activado después el objetivo de escribir todas las fichas pendientes.
roadmap-progress.md/json separa 29 IDs con borrador propio, 44 fichas con material
relacionado y 102 sin artículo identificado. Ni un ID ni un título prueban que se
hayan cumplido todos los requisitos del roadmap. Es necesario revisar sus temarios,
laboratorios y DoD, recuperar las series iniciales y continuar las avanzadas.

No se declara completo el objetivo global. Pendientes Deep Learning, NLP/RAG/agentes,
Healthcare, visión, audio/vídeo, MLOps, producto y los huecos de las series iniciales.
No se ha certificado accesibilidad con lectores de pantalla ni Safari/Firefox.
