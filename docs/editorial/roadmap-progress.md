# Estado del roadmap completo

Inventario generado desde el catálogo de 175 fichas y los artículos españoles reales. No es una certificación de completitud editorial ni de laboratorios.

IDs con borrador propio: **56**. Solo material relacionado: **30**. Sin artículo identificado: **89**.

Cada ficha requiere revisión contra su temario obligatorio, laboratorio y Definition of Done. Un artículo agrupado no completa automáticamente varias fichas.

## Orden de continuación

Redactadas las series 01 y 07–09. En Serie 02, P011 se desarrolla en 21 entregas exclusivamente de estructuras de datos y algoritmos; P010 y P012–P019 siguen fuera del encargo actual. Serie 03 tiene treinta y seis entregas: P020–P031; P030 desarrolla nueve partes y P031 cuatro. P031 compara polling/SSE con sockets reales, GraphQL N+1/batching y gRPC unary con cliente anterior y deadline. Callbacks y subscriptions remiten a mecanismos previos; no hay broker durable ni GraphQL subscription ejecutada. Los ejemplos viven en el monorepo separado. T05 SSRF, T06 admisión y T07 credenciales/secretos se prueban en fixtures de un proceso, sin infraestructura cloud. Las API keys identifican clientes, no personas. Refresh sigue separado del RP OIDC. P029 verifica XSS/CSRF/CSP/CORS en Chromium loopback. Valorar siempre posts pequeños y específicos. Revisar/ampliar 04–06 contrastando artículos existentes, después Deep Learning y series 11–16. Revisar límites declarados, especialmente P026. No hay publicación o traducción autorizada.

Reproducir inventario: `node scripts/audit-editorial-roadmap.mjs`. El detalle estructurado conserva candidatos y rutas en roadmap-progress.json. Estado del objetivo: activo; no se ha probado que esté completo.

Ampliación de Serie 05: diez drafts de modelado/documentación P044/P047, siete de principios P043 y cinco de fronteras P045/P046. Puertos/adaptadores, capas/Clean, ownership modular, CQRS y costes de despliegue tienen entregas propias. architecture-boundaries prueba HTTP loopback, módulos y proyección en memoria; sin Stripe sandbox, SQL o despliegues independientes. design-principles y domain-design conservan sus límites. Bases de datos mantiene quince entregas. Siguiente: gaps P048/P051 y Serie 06. Ver ruta-fronteras-arquitectura.md, ruta-principios-diseno.md y ruta-modelado-arquitectura.md. Ni IDs ni recuentos aceptan el roadmap.

## Serie 01. Computación, sistemas y redes (posts 001–009)

- P001. Cómo funciona un ordenador: CPU, memoria y almacenamiento: [borrador](../../src/content/posts/es/cpu-memoria-almacenamiento-localidad.md).
- P002. Cómo representan los ordenadores la información: [borrador](../../src/content/posts/es/bits-floats-unicode-fechas-representacion.md).
- P003. Sistemas operativos: procesos, hilos y memoria: [borrador](../../src/content/posts/es/procesos-hilos-memoria-virtual-bloqueos.md).
- P004. Linux para ingenieros de software: [borrador](../../src/content/posts/es/linux-diagnosticar-procesos-puertos-senales.md).
- P005. Cómo funciona Internet: IP, routing, NAT y DNS: [borrador](../../src/content/posts/es/internet-ip-routing-nat-dns.md).
- P006. TCP, UDP y QUIC: transporte, pérdidas y latencia: [borrador](../../src/content/posts/es/tcp-udp-quic-perdida-latencia.md).
- P007. HTTPS, TLS y certificados digitales: [borrador](../../src/content/posts/es/https-tls-certificados-identidad.md).
- P008. HTTP: semántica, versiones y caché: [borrador](../../src/content/posts/es/http-semantica-versiones-etag-cache.md).
- P009. Cómo funciona un navegador web por dentro: [borrador](../../src/content/posts/es/navegador-dom-cssom-event-loop-fetch.md).

## Serie 02. Programación y fundamentos del código (posts 010–019)

- P010. Git y control de versiones para desarrollo profesional: pendiente.
- P011. Algoritmos, estructuras de datos y complejidad: [borrador](../../src/content/posts/es/estructuras-datos-elegir-patron-acceso.md).
- P012. Paradigmas: imperativo, funcional y orientado a objetos: pendiente.
- P013. JavaScript por dentro: pendiente.
- P014. TypeScript y diseño de tipos seguros: relacionado, requiere revisión.
- P015. Asincronía en JavaScript y Node.js: relacionado, requiere revisión.
- P016. Python desde sus fundamentos: relacionado, requiere revisión.
- P017. Python profesional: tipado, paquetes y modularidad: pendiente.
- P018. Concurrencia en Python: pendiente.
- P019. Diseño y tratamiento de errores: pendiente.

## Serie 03. Diseño de APIs y seguridad web (posts 020–031)

- P020. Qué es una API y qué significa diseñar un contrato: [borrador](../../src/content/posts/es/api-contrato-esquema-clientes.md).
- P021. REST y diseño de recursos HTTP: [borrador](../../src/content/posts/es/recursos-http-metodos-idempotencia.md).
- P022. Validación de datos y contratos de entrada/salida: [borrador](../../src/content/posts/es/validacion-runtime-json-schema-zod-pydantic.md).
- P023. Cómo diseñar los errores de una API: [borrador](../../src/content/posts/es/errores-api-problem-details-stock-concurrencia.md).
- P024. Paginación, filtrado, ordenación y búsqueda: [borrador](../../src/content/posts/es/paginacion-offset-keyset-postgresql-concurrencia.md).
- P025. Versionado y evolución de APIs: [borrador](../../src/content/posts/es/evolucion-api-versiones-consumidores-contratos.md).
- P026. Autenticación: sesiones, cookies y tokens: [borrador](../../src/content/posts/es/sesiones-web-cookies-identidad.md).
- P027. OAuth 2.0 y OpenID Connect explicados: [borrador](../../src/content/posts/es/oauth-oidc-authorization-code-pkce.md).
- P028. Autorización: RBAC, ABAC y permisos sobre recursos: [borrador](../../src/content/posts/es/autorizacion-rbac-abac-permisos-recursos.md).
- P029. Seguridad del navegador y frontend: [borrador](../../src/content/posts/es/xss-dom-texto-html-contextos.md).
- P030. Seguridad avanzada de APIs: [borrador](../../src/content/posts/es/threat-model-api-multi-tenant-pruebas.md).
- P031. REST, GraphQL, gRPC, Webhooks y APIs por eventos: [borrador](../../src/content/posts/es/polling-eventos-estado-pedido.md).

## Serie 04. Bases de datos y persistencia (posts 032–041)

- P032. Bases de datos relacionales y modelado: relacionado, requiere revisión.
- P033. SQL básico y avanzado para análisis y backend: relacionado, requiere revisión.
- P034. Normalización y desnormalización de datos: relacionado, requiere revisión.
- P035. Índices y estructuras internas de PostgreSQL: relacionado, requiere revisión.
- P036. Cómo ejecuta PostgreSQL una consulta: relacionado, requiere revisión.
- P037. Transacciones, ACID y niveles de aislamiento: relacionado, requiere revisión.
- P038. Concurrencia y bloqueos en bases de datos: relacionado, requiere revisión.
- P039. Redis y patrones de caché: relacionado, requiere revisión.
- P040. SQL, NoSQL y motores especializados: relacionado, requiere revisión.
- P041. Migraciones, particionado y evolución del dato: relacionado, requiere revisión.

## Serie 05. Arquitectura y sistemas distribuidos (posts 042–054)

- P042. System Design: requisitos y estimación de capacidad: relacionado, requiere revisión.
- P043. Principios de diseño: cohesión, acoplamiento y SOLID: [borrador](../../src/content/posts/es/cohesion-srp-razones-cambio.md).
- P044. Domain-Driven Design: dominio y límites: [borrador](../../src/content/posts/es/ddd-lenguaje-bounded-contexts.md).
- P045. Arquitectura hexagonal y Clean Architecture: [borrador](../../src/content/posts/es/arquitectura-hexagonal-puertos-adaptadores.md).
- P046. Arquitectura en capas, monolito modular y microservicios: [borrador](../../src/content/posts/es/monolito-microservicios-despliegue-costes.md).
- P047. C4, ADR y documentación de decisiones: [borrador](../../src/content/posts/es/c4-contexto-contenedores-componentes.md).
- P048. Fundamentos de sistemas distribuidos: relacionado, requiere revisión.
- P049. Idempotencia y garantías de entrega: relacionado, requiere revisión.
- P050. Colas y procesamiento asíncrono: relacionado, requiere revisión.
- P051. Event Streaming con Kafka: pendiente.
- P052. Consistencia eventual, Outbox, Inbox y eventos: relacionado, requiere revisión.
- P053. Sagas, máquinas de estados y ejecución duradera: relacionado, requiere revisión.
- P054. Resiliencia: timeouts, breakers, bulkheads y backpressure: relacionado, requiere revisión.

## Serie 06. Calidad, cloud, DevOps y observabilidad (posts 055–066)

- P055. Estrategias de pruebas de software: relacionado, requiere revisión.
- P056. Integración y pruebas de contrato: relacionado, requiere revisión.
- P057. Property-based testing, fuzzing y fault injection: relacionado, requiere revisión.
- P058. Benchmarking, carga y profiling: relacionado, requiere revisión.
- P059. Observabilidad: logs, métricas y trazas: relacionado, requiere revisión.
- P060. SLI, SLO y error budgets: relacionado, requiere revisión.
- P061. Incidentes, runbooks y postmortems: relacionado, requiere revisión.
- P062. Docker y entornos reproducibles: relacionado, requiere revisión.
- P063. CI/CD, despliegues progresivos y rollback: relacionado, requiere revisión.
- P064. Cloud Computing con AWS: pendiente.
- P065. Terraform y Kubernetes: pendiente.
- P066. Ingeniería de capacidad y costes: relacionado, requiere revisión.

## Serie 07. Frontend y tiempo real (posts 067–075)

- P067. Fundamentos de frontend accesible: [borrador](../../src/content/posts/es/frontend-accesible-semantica-teclado-foco.md).
- P068. Renderizado de aplicaciones modernas: [borrador](../../src/content/posts/es/csr-ssr-ssg-hydration-renderizado.md).
- P069. Estado de cliente y sincronización de servidor: [borrador](../../src/content/posts/es/estado-cliente-servidor-optimismo-races.md).
- P070. Rendimiento de frontend y profiling: [borrador](../../src/content/posts/es/rendimiento-frontend-medir-antes-optimizar.md).
- P071. Interfaces para grandes volúmenes de datos: [borrador](../../src/content/posts/es/tablas-grandes-paginacion-virtualizacion-seleccion.md).
- P072. Componentes y design systems: [borrador](../../src/content/posts/es/componentes-design-system-contratos-estados.md).
- P073. SSE, WebSockets y tiempo real: [borrador](../../src/content/posts/es/sse-websockets-reconexion-eventos-perdidos.md).
- P074. CRDT, OT y offline-first: [borrador](../../src/content/posts/es/crdt-yjs-offline-convergencia.md).
- P075. WebRTC y multimedia de baja latencia: [borrador](../../src/content/posts/es/webrtc-audio-ice-stun-turn.md).

## Serie 08. Matemáticas y estadística (posts 076–085)

- P076. Álgebra lineal I: vectores, matrices y tensores: [borrador](../../src/content/posts/es/vectores-matrices-tensores-similitud.md).
- P077. Álgebra lineal II: transformaciones y PCA: [borrador](../../src/content/posts/es/transformaciones-lineales-pca-perdida-informacion.md).
- P078. Cálculo diferencial y regla de la cadena: [borrador](../../src/content/posts/es/derivadas-gradientes-regla-cadena.md).
- P079. Optimización matemática y gradiente descendente: [borrador](../../src/content/posts/es/gradiente-descendente-learning-rate-convergencia.md).
- P080. Probabilidad y teorema de Bayes: [borrador](../../src/content/posts/es/probabilidad-bayes-prior-alertas.md).
- P081. Distribuciones estadísticas y descriptivos: [borrador](../../src/content/posts/es/distribuciones-media-percentiles-latencia.md).
- P082. Inferencia estadística e incertidumbre: [borrador](../../src/content/posts/es/inferencia-bootstrap-intervalos-confianza.md).
- P083. Hipótesis y diseño experimental: [borrador](../../src/content/posts/es/experimentos-ab-p-value-efecto-potencia.md).
- P084. Teoría de la información y pérdidas: [borrador](../../src/content/posts/es/entropia-cross-entropy-kl-logits.md).
- P085. Fourier, convolución y cálculo numérico: [borrador](../../src/content/posts/es/fourier-fft-convolucion-errores-numericos.md).

## Serie 09. Machine Learning clásico (posts 086–095)

- P086. Qué es Machine Learning y tipos de problemas: [borrador](../../src/content/posts/es/machine-learning-problema-target-prediccion.md).
- P087. EDA con NumPy y pandas: [borrador](../../src/content/posts/es/eda-numpy-pandas-calidad-datos.md).
- P088. Preprocesamiento y feature engineering: [borrador](../../src/content/posts/es/preprocesamiento-pipelines-data-leakage.md).
- P089. Regresión lineal y logística: [borrador](../../src/content/posts/es/regresion-lineal-logistica-perdidas-regularizacion.md).
- P090. Árboles, Random Forest y Gradient Boosting: [borrador](../../src/content/posts/es/arboles-random-forest-gradient-boosting.md).
- P091. Aprendizaje no supervisado: [borrador](../../src/content/posts/es/clustering-kmeans-dbscan-estabilidad.md).
- P092. Entrenamiento, validación y selección: [borrador](../../src/content/posts/es/validacion-temporal-cross-validation-seleccion.md).
- P093. Métricas de Machine Learning: [borrador](../../src/content/posts/es/metricas-ml-precision-recall-auc-errores.md).
- P094. Calibración, interpretabilidad y equidad: [borrador](../../src/content/posts/es/calibracion-interpretabilidad-equidad-modelos.md).
- P095. Experimentos reproducibles de ML: [borrador](../../src/content/posts/es/experimentos-ml-reproducibles-baselines.md).

## Serie 10. Deep Learning (posts 096–105)

- P096. Perceptrón y redes neuronales multicapa: pendiente.
- P097. Forward, backpropagation y autodiff: pendiente.
- P098. Optimizadores y dinámica del entrenamiento: pendiente.
- P099. PyTorch desde cero: entrenamiento completo: pendiente.
- P100. Overfitting e inestabilidad de redes: pendiente.
- P101. Redes convolucionales CNN: pendiente.
- P102. Redes para secuencias: RNN, LSTM y GRU: pendiente.
- P103. Atención y Transformer: pendiente.
- P104. Pretraining, transfer learning y fine-tuning: pendiente.
- P105. Entrenamiento eficiente en GPU: pendiente.

## Serie 11. NLP, LLM, RAG y agentes (posts 106–121)

- P106. Fundamentos de NLP y búsqueda de texto: pendiente.
- P107. Named Entity Recognition y etiquetado de spans: pendiente.
- P108. Cómo funcionan los modelos de lenguaje: pendiente.
- P109. Inferencia y generación de texto con LLM: pendiente.
- P110. Prompt engineering y structured outputs: pendiente.
- P111. Embeddings y recuperación vectorial: pendiente.
- P112. Ingesta documental, OCR y chunking para RAG: pendiente.
- P113. Retrieval léxico, denso e híbrido: pendiente.
- P114. Reranking, grounding y trazabilidad de fuentes: pendiente.
- P115. Arquitecturas RAG y decisiones técnicas: pendiente.
- P116. Evaluación cuantitativa de sistemas RAG: pendiente.
- P117. Evaluación de LLM y LLM-as-judge: pendiente.
- P118. Agentes de IA, herramientas y workflows: pendiente.
- P119. MCP: hosts, clients, servers, tools y resources: pendiente.
- P120. Seguridad de agentes y prompt injection: pendiente.
- P121. LLMOps: trazabilidad, costes y latencia: pendiente.

## Serie 12. Healthcare AI e interoperabilidad (posts 122–134)

- P122. Cómo se estructura una historia clínica: pendiente.
- P123. Datasets sanitarios para ML: pendiente.
- P124. RGPD, HIPAA y protección de datos clínicos: pendiente.
- P125. Desidentificación, seudonimización y anonimización: pendiente.
- P126. Clinical NLP: entidades, negaciones, relaciones: pendiente.
- P127. Extracción clínica con esquemas estructurados: pendiente.
- P128. SNOMED CT, LOINC, RxNorm e ICD: pendiente.
- P129. HL7 FHIR desde cero: pendiente.
- P130. FHIR Bundle, validación, perfiles y procedencia: pendiente.
- P131. SMART on FHIR y acceso autorizado: pendiente.
- P132. OCR y documentos clínicos escaneados: pendiente.
- P133. FHIR y OMOP CDM: intercambio e investigación: pendiente.
- P134. Evaluación y revisión humana en Clinical AI: pendiente.

## Serie 13. Computer Vision y documentos (posts 135–145)

- P135. Cómo representa un ordenador una imagen: pendiente.
- P136. Computer Vision tradicional con OpenCV: pendiente.
- P137. Datasets visuales y anotaciones: pendiente.
- P138. Clasificación visual con Deep Learning: pendiente.
- P139. Detección de objetos: pendiente.
- P140. Segmentación semántica y por instancia: pendiente.
- P141. Detección de anomalías visuales: pendiente.
- P142. OCR y reconstrucción documental: pendiente.
- P143. Document Understanding y Vision-Language Models: pendiente.
- P144. DICOM e imágenes médicas 2D/3D: pendiente.
- P145. Evaluación y robustez de visión: pendiente.

## Serie 14. Audio, vídeo e IA multimodal (posts 146–156)

- P146. Fundamentos de audio digital: pendiente.
- P147. FFT, STFT, Mel y MFCC: pendiente.
- P148. DSP aplicado a voz e IA: pendiente.
- P149. Clasificación de eventos acústicos: pendiente.
- P150. ASR: reconocimiento automático de voz: pendiente.
- P151. Diarización y alineación temporal: pendiente.
- P152. Síntesis de voz y TTS: pendiente.
- P153. Aplicaciones de voz en tiempo real: pendiente.
- P154. Fundamentos de vídeo digital: pendiente.
- P155. Seguimiento de objetos en vídeo: pendiente.
- P156. IA multimodal y búsqueda audiovisual: pendiente.

## Serie 15. MLOps e inferencia (posts 157–167)

- P157. Data Engineering para ML: pendiente.
- P158. Versionado de datasets, features y artefactos: pendiente.
- P159. MLflow y registro de experimentos/modelos: pendiente.
- P160. Automatización de pipelines de entrenamiento: pendiente.
- P161. Inferencia y serving de modelos: pendiente.
- P162. Monitorización de modelos y drift: pendiente.
- P163. Optimización de modelos: ONNX, cuantización y destilación: pendiente.
- P164. Inferencia optimizada en GPU: pendiente.
- P165. Infraestructura y escalabilidad de ML: pendiente.
- P166. IA responsable, seguridad y riesgos: pendiente.
- P167. CI/CD/CT para modelos ML: pendiente.

## Serie 16. Producto, liderazgo y comunicación técnica (posts 168–175)

- P168. Del problema empresarial al requisito técnico: pendiente.
- P169. Métricas de producto e instrumentación: pendiente.
- P170. A/B testing y experimentación de producto: pendiente.
- P171. RFC, ADR y design reviews: pendiente.
- P172. Trade-offs, deuda técnica y evolución: pendiente.
- P173. Open Source y Developer Experience: pendiente.
- P174. Cómo redactar un estudio de caso de ingeniería: pendiente.
- P175. Cómo razona y comunica un Staff Engineer: pendiente.
