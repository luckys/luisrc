# Revisión de fundamentos distribuidos

21 de octubre de 2026. Serie previa de fronteras confirmada: blog `fbeba30`,
ejemplos `92dba16`, sin push. Antes del commit se repitieron 22 tests, typecheck y
ocho comprobaciones estructurales/editoriales. La primera ejecución cruzada falló
por omitir BLOG_ROOT; con la variable requerida pasó sin cambiar criterios.

## Alcance y división

Seis drafts españoles, autor Luis Ramírez Calle: replicación/consistencia (P048),
quorum, consenso/voto, Lamport, CAP/PACELC y sharding. Manifest y orden en
distributed-foundations-series.json y ruta-fundamentos-distribuidos.md.
Cada archivo ronda 1350–1580 palabras incluyendo código y metadatos. La guía de
escritura motivó separar preguntas, explicar supuestos y aportar contraejemplos.
Se reutilizan, sin recrearlos, los ocho posts anteriores de servicios fiables.

Fuentes primarias enlazadas: Gilbert/Lynch, Lamport, Raft, PACELC de Abadi, Dynamo,
PostgreSQL 18, etcd 3.6 y sharding de Microsoft. También Jepsen y Peter Bailis.
Sin anécdotas, benchmarks o capacidades de producción inventadas.

## Evidencia de código y contenido

Solo packages/distributed-foundations en el monorepo de ejemplos. Node 24.19.0,
TypeScript 5.9.2 estricto y pnpm 12.8.1. Instalación offline/congelada comprobadas.
Tests primero: imports ausentes fallaron; implementación inicial llevó 22 casos a
verde. Un caso posterior detectó restauración de voto inválido en term 0, corregida.
Otro comprueba recordar term superior aunque se niegue el voto. Final: 24 tests y
typecheck pasan. No afirmar red/green individual para cada caso.

Observaciones: A 1/shipped y B 0/pending antes de entrega, ambos 1 después;
token de frescura rechaza lectura antigua; nueve intersecciones de quorum;
720 órdenes de seis solicitudes sin dos mayorías en un term; Lamport 1/9/10;
ruta anterior rechazada tras cambiar owner/revisión. Demo remapea 679/1000 claves
al pasar de modulo 2 a 3; expectativa exacta probada, no porcentaje universal.

Cuatro tests estructurales y 62 editoriales cruzados pasan: 164 índices por post,
21 paquetes y mismos 48 exports allowlisted. Once snippets coinciden con código
probado. Seis D2/SVG con dimensiones y alt comprobados. Enlaces GitHub contrastados
con checkout local, sin afirmar que el remoto de ejemplos exista o esté publicado.

Build: cincuenta rutas, 61 HTML, diez páginas publicadas y 4280 palabras indexadas.
Diecinueve tests del blog pasan. Inventario regenerado tras detectar P048 aún como
related_only: 57 exactos, 29 relacionados, 89 sin artículo. No es aceptación.

## Renderizado y límites

Chromium 1440/360: doce vistas pasan, H1/noindex, links 200, imágenes, sin overflow,
foco de código y KaTeX con stylesheet. Se corrigieron delimitadores y math: true.
Se usó Chromium existente en /tmp/luisrc-blog-playwright, sin instalar navegador.
CAP se estrechó de 512 a 386 píxeles. Capturas de seis diagramas inspeccionadas.
Reporte final: /tmp/distributed-foundations-layout.pBKMAl/report.json. Repetición
del recorrido inicial K5VbFB, no casos adicionales. Servidor pid 2750518 detenido;
puerto 4322 sin listener. Sin traducción, audio, publicación o push.

Build y 19 tests repetidos tras los últimos ajustes. Se restauró exclusivamente
el pruning/cambio automático de acorn del lockfile del blog introducido por pnpm;
sin diff de dependencias del sitio. El lockfile de ejemplos sí añade el importer
del nuevo paquete. Una escritura larga de esta nota expiró en revisión automática
sin aplicarse; se comprobó el estado y se reintentó con esta nota más breve.

Son modelos de un proceso, sin red, disco, Raft completo, clúster CP/AP o migración
de registros. Voto usa candidaturas abstractas sin roles/self-vote. Convergencia
requiere entrega manual; quorum no demuestra linearizability; frescura no prueba
CAP; Lamport no mide duración. move cambia solo metadatos. No se reejecutaron todos
los labs históricos. La nueva serie queda sin commit. Próximo bloque P051 Kafka,
dividido en log/retención, particiones/claves, groups/offsets y replay. Verificar
infraestructura antes de afirmar broker real. Después lagunas de Serie 06.
