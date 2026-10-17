# Serie: Frontend y tiempo real

## Encargo y decisión de continuidad

Tras las series de bases de datos y servicios fiables, continuar con la serie 07
del roadmap: P067–P075. La ruta general permite abordar ahora las interfaces de
los servicios estudiados sin exigir AWS, Kubernetes o las especializaciones de IA.
Es una ordenación de aprendizaje, no una afirmación de haber completado los 175 temas.

Nueve borradores, solo español, autor Luis Ramírez Calle. No implementar PaySafe,
traducir, generar audio ni publicar. El commit solicitado guarda el trabajo anterior;
esta continuación se deja para revisión en el working tree.

## Público y aceptación

Ingenieros con programación, HTML básico y HTTP que necesitan comprender decisiones
de interfaz, no un tutorial de sintaxis React. Conservar inglés técnico y explicar
el porqué de las decisiones, alternativas y límites. Un problema dominante por post.

Cada artículo incluye escenario, mecanismo, código con ruta, diagrama propio,
ejercicio con criterio verificable, garantías/no-garantías y referencias primarias.
Metadatos draft/status draft, orden temporal ascendente y referencias sin ciclos.
Un laboratorio compartido evita nueve instalaciones diferentes.

## Objetivos y errores que la revisión debe detectar

| ID   | Tres objetivos verificables                                                 | Tres errores conceptuales a evitar                                                    |
| ---- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| P067 | Completar tarea con teclado; asociar etiqueta; conservar foco               | ARIA como sustituto de HTML; placeholder como label; test como certificación          |
| P068 | Comparar HTML inicial; hidratar mismo seed; elegir estrategia por contenido | SSR igual a interacción; SSG igual a datos actuales; benchmark no medido              |
| P069 | Ignorar respuestas viejas; revertir rechazo; preservar revisión posterior   | Abort equivale a rollback; store global soluciona caché; optimismo confirma negocio   |
| P070 | Separar fases; repetir muestras; elegir optimización por evidencia          | Tiempo DOM igual a INP; memo siempre mejora; portátil igual a campo                   |
| P071 | Acotar DOM; paginar 20; vincular selección a filtro                         | Virtualizar reduce red; ordenar página ordena todo; filtro equivale a snapshot        |
| P072 | Conservar semántica; separar datos/API; mostrar variantes                   | Reutilización sin contrato; desactivar autoriza; screenshot demuestra accesibilidad   |
| P073 | Detectar hueco; reanudar; recuperar snapshot                                | Reconectar recupera historia; SSE persiste; heartbeat demuestra consistencia          |
| P074 | Editar aislado; converger; recargar tras sync                               | CRDT autentica; convergencia valida negocio; snapshot local garantiza offline durable |
| P075 | Negociar loopback; observar paquetes; liberar tracks                        | Captura es llamada; STUN garantiza ruta; RTT es latencia completa                     |

## Límites respecto al catálogo original

P068 compara funcionalmente CSR/SSR, no mide primera carga de un despliegue ni
implementa SSG/streaming. P070 mide DOM aislado, no una tabla React antes/después.
P071 separa selección/modelo, paginación y ventana, no implementa bulk actions.
P072 ofrece catálogo local, no Storybook ni visual regression automatizada.
P074 usa dos pestañas y un adaptador local, no un proveedor remoto duradero.
P075 transporta audio local con dos peers, no entre equipos ni mide latencia acústica.
Son fundamentos con evidencia acotada, no se marcan como terminados esos laboratorios
integradores más amplios del roadmap.

## Validación prevista

Pruebas deterministas, TypeScript strict, Chromium con Playwright, inspección de
diagramas y vistas, ZIP reproducible sin dependencias instaladas, nueve páginas
de desarrollo noindex y build sin publicación de borradores. Registrar evidencia
real en frontend-series-review.md, no convertir esta lista en resultados anticipados.
