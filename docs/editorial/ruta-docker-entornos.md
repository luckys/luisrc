# Docker: construir y comprobar un entorno reproducible

Ampliación de P062 en seis artículos españoles, independientes de cualquier producto.
Todos permanecen en draft. Se conserva OPS-DELIVERY como visión de conjunto.
El código de laboratorio vive en `packages/container-environments` del monorepo.

## Orden de lectura

1. **Images y containers**: límites del empaquetado, identidad y recreación.
2. **Dockerfile, layers y cache**: entradas del build, orden y contexto.
3. **Multi-stage builds**: TypeScript, dependencias y artefacto de ejecución.
4. **Compose, redes y readiness**: DNS, puertos, arranque y caídas posteriores.
5. **Volúmenes e inicialización**: recreación, conservación y setup vacío.
6. **Seguridad**: usuario, filesystem, privilegios, recursos y mantenimiento.

Cada entrega responde a una decisión distinta. Juntarlas obligaría a explicar
el filesystem, la red, los datos y los permisos mientras el lector intenta
comprender por primera vez qué está ejecutando Docker.

## Evidencia exigida al laboratorio

- Build multi-stage real con dependencias instaladas mediante pnpm y lock compartido.
- Cambiar source en copia temporal y observar instalación reutilizada por BuildKit.
- API, Redis y PostgreSQL reales con Compose y puertos de datos sin publicar.
- Recrear API conserva image y cambia container ID.
- Redis caído: fallback SQL; PostgreSQL caído: liveness 200, readiness 503.
- Reutilizar volumen conserva la nota; eliminar solo el volumen del fixture permite
  un segundo setup vacío y volver a crearla.
- Inspeccionar controles de la API y cerrar los recursos propios del ejercicio.
- Diagramas, gráfica derivada y visor de datos archivados, con QA móvil y escritorio.

El siguiente bloque P063 separará CI, deployment y release. Un build local no se
presentará como pipeline remoto, rollback desplegado o garantía de producción.
