# Revisión de la ruta posterior a bases de datos

Fecha: 2026-10-17. Encargo: escribir los conocimientos restantes necesarios para
el alcance de entrenamiento PS01–PS10 en series generalistas. No construir ni
publicar PaySafe. Las cuatro series reúnen 24 artículos españoles en borrador.

## Decisiones editoriales

- Se conserva la serie de bases de datos, sin alterar sus artículos o audios.
- Se adelantan contratos y fronteras de confianza; después diseño y pruebas;
  después fallos distribuidos; por último observación y operación.
- Una pregunta por entrega, con escenario, mecanismo, alternativa, límites,
  laboratorio y ejercicio. No se obliga a copiar la plantilla de 16 encabezados
  cuando introduciría repetición y dificultaría la lectura.
- Se mantiene inglés técnico con explicación y se destaca de forma selectiva.
- Se elige un monolito modular y contratos pequeños, no DDD completo ni servicios
  separados por anticipación. La guía de escritura favoreció aperturas concretas,
  trade-offs explícitos y eliminación de afirmaciones sin evidencia.
- Índice de lectura: `ruta-fundamentos-servicios-fiables.md`. Inventario, IDs,
  orden y dependencias: `reliable-services-series.json`.

## Qué significa la cobertura del roadmap

El inventario relaciona conceptos con fichas P, no certifica que cada ficha larga
esté completada con su laboratorio original. La ruta aporta el conocimiento para
empezar PS01–PS10, no todos los 175 artículos ni una plataforma terminada.

En particular NO se ejecutan: benchmark de paginación de un millón de filas,
servidor OIDC, explotación XSS en navegador, broker externo, CDC, Temporal,
fuzzing general, mutation testing, collector OpenTelemetry, infraestructura cloud,
canary remoto o restauración de backups. Esas fronteras se explicitan en los
artículos, no se rellenan con resultados inventados.

## Fuentes y garantías

Se consultaron fuentes primarias de HTTP/RFC, TypeScript/ECMAScript, Node.js 24,
PostgreSQL 18, OWASP, OpenAPI 3.1.1, OpenID Connect y OAuth BCP, AWS, RabbitMQ/SQS,
Kafka (solo comparación), Temporal (solo comparación), C4, Google SRE, Docker,
pnpm, k6 y bibliografía original de modularidad/CAP.

El PDF de CAP se verificó desde el sitio de los autores en MIT. El DOI de Parnas
se localizó mediante la ficha del editor. El PDF de Sagas en Princeton devolvió
403 al abrirlo: se retiró del artículo y se conservan las referencias accesibles
de AWS y Temporal, sin afirmar lectura completa de ese PDF.

Las garantías están separadas por frontera:

- TypeScript comprueba tipos; los parsers validan entradas en ejecución.
- HMAC verifica el protocolo ficticio firmado, no corrección comercial.
- La memoria coordina un proceso, no sobrevive a reinicios.
- Las leases no detienen por la fuerza a un worker antiguo.
- PostgreSQL protege dos transacciones locales separadas, no un commit externo.
- Inbox evita repetir la proyección SQL del test, no un email externo.
- Un timeout conserva incertidumbre; no se transforma automáticamente en fracaso.
- Retry no cancela por sí solo una promesa ni un efecto remoto.

## Evidencia ejecutada

- Se escribieron primero los tests del núcleo y se comprobó el fallo por módulos
  ausentes; después se implementaron y se observaron 16 pruebas correctas.
- TypeScript estricto con `tsc`, Node.js 24.19.0. La ejecución usa type stripping
  y la comprobación estática es un paso separado.
- Cuatro pruebas reales con PostgreSQL 18.4: atomicidad, reclamación con 20
  conexiones concurrentes, redelivery sin efecto SQL duplicado y rollback de Inbox.
- Medición HTTP local: cinco warm-ups, tres etapas de 120 solicitudes con
  concurrencia 1/4/12, cupo de cuatro y espera sintética de 20 ms. Se conservan
  todas las muestras. Última etapa: 12 éxitos, 108 rechazos. Medianas de etapas
  4 y 12: aproximadamente 23.17 y 3.58 ms incluyendo errores.
- Es una ejecución, cliente y servidor en el mismo proceso Linux; no un resultado
  estadístico ni capacidad atribuible a una API real.
- 24 diagramas D2 renderizados a SVG y una gráfica ECharts del JSON medido.
  Revisados en tres hojas PNG para detectar recortes y flechas ilegibles.
- Pruebas editoriales para metadatos, 24 borradores españoles, grafo acíclico,
  enlaces, dimensiones, fidelidad de extractos, ZIP byte a byte y fórmulas.
- Compilación Astro satisfactoria: 48 páginas públicas, 8 artículos indexados;
  los borradores no se publican. Advertencia previa de Satori de line-height en
  la social card de Python, ajena al cambio.

## Cierre de verificación

- 23 pruebas del repositorio correctas, incluidas cinco nuevas de coherencia
  editorial y reproducibilidad. 16 pruebas del núcleo y cuatro de PostgreSQL:
  43 casos distintos comprobados en total.
- ZIP de 20 archivos extraído fuera del monorepo: los 16 tests del núcleo, la
  instalación `pnpm install --frozen-lockfile`, `tsc` y los cuatro tests PostgreSQL
  pasaron con un proyecto Compose separado. No se reutilizaron dependencias del
  blog para esa comprobación.
- Revisión HTTP de los 24 borradores: títulos, `noindex`, numeración 1/N correcta
  en cada serie, anclas TOC y 26 recursos locales (25 SVG y un ZIP) correctos.
- Diagramas y gráfica inspeccionados como PNG. No se afirma QA interactiva en un
  navegador real ni pruebas responsive completas; no se cambió la interfaz del blog.
- Se corrigieron referencias al slug incompleto de webhooks y se sincronizaron
  extractos de métodos con el formato de los archivos realmente probados.

No hay commit, traducciones, narraciones nuevas ni publicación. El laboratorio no
es una implementación acabada del proyecto integrador.
