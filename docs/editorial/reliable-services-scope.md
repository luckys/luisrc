# Ruta posterior a bases de datos

Encargo: 2026-10-17. Solo español, borradores independientes de PaySafe. No
publicar, traducir, narrar, hacer commit ni modificar artículos anteriores.

## Orden y lector

La serie de bases de datos precede a cuatro series: APIs y seguridad (7), diseño
(4), sistemas distribuidos (8) y operación (5). El inventario ordenado y el grafo
de prerrequisitos están en `reliable-services-series.json`. Público: ingenieros
que conocen programación, SQL elemental y peticiones HTTP, no expertos en cada
tema. Los ejemplos usan pedidos y reservas ficticios, nunca tarjetas reales.

Esta es la ruta de fundamentos para el alcance PS01–PS10, no una implementación
de PaySafe ni una sustitución de los 175 artículos originales. Agrupa los temas
necesarios; no declara completadas las fichas generales cuando sus laboratorios
avanzados no se han realizado. DDD, Kafka, Temporal, Kubernetes, AWS y OAuth/OIDC
en producción son posibles ampliaciones, no dependencias para empezar el proyecto.

## Criterios

- Una pregunta por artículo, explicación del mecanismo y porqué de las decisiones.
- Términos ingleses definidos; conceptos importantes destacados sin negrita continua.
- Diagrama SVG con fuente D2, alt, dimensiones y enlace de ampliación.
- Ejemplo ejecutable con archivo identificado, pruebas y ejercicio comprobable.
- Laboratorio común descargable, Node.js 24, TypeScript sin dependencias runtime,
  PostgreSQL real para atomicidad, unicidad e Inbox/Outbox.
- Distinguir simulación en memoria, experimento SQL y despliegue real.
- Referencias primarias verificadas; cifras calculadas etiquetadas, sin benchmarks
  universales. Los ejemplos no constituyen una implementación de seguridad completa.
- Metadatos, enlaces, ZIP, tests y compilación comprobados antes de entregar.

## Límites de esta ruta

El laboratorio no es un PSP ni un producto de pagos. El proveedor es un fake.
No hay dinero real, infraestructura cloud, broker externo, proveedor OIDC ni
certificación. Los artículos de identidad y navegador aportan controles y modelos
de amenazas, no un servidor de autenticación casero. Las diferencias con las
fichas extensas del roadmap se registran en la revisión final.
