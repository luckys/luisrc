---
id: OPS-DELIVERY
title: 'Del laboratorio a un servicio operable: Docker, CI, rollback y runbooks'
published: 2026-10-17T04:04:00Z
locale: es
translationKey: reliable-delivery-runbooks
slug: docker-ci-despliegues-runbooks
draft: true
status: draft
level: intermedio
prerequisites: [OPS-SLO, DB-MIGRATIONS]
description: 'Conecta entorno reproducible, comprobaciones de CI y recuperación. Un contenedor saludable no garantiza corrección comercial ni un rollback seguro de los datos.'
author: 'Luis Ramírez Calle'
series: 'Probar y operar servicios fiables'
tags: [docker, ci-cd, runbooks, operaciones]
---

El rollback devuelve la aplicación a su versión anterior, pero esa versión ya no entiende la columna que eliminó la migración. El despliegue de código se revirtió; el sistema no volvió a ser compatible.

Operar un servicio exige conectar cambios de aplicación, datos y procedimientos. Cerramos esta ruta después de [definir SLO](/posts/sli-slo-error-budget-servicios) y retomamos las [migraciones compatibles](/posts/migraciones-base-datos-sin-romper-aplicacion).

## Reproducir el entorno antes de reproducir el incidente

Una **image** empaqueta un sistema de archivos y metadatos; un **container** es una instancia en ejecución. Los volúmenes, la red y los secretos pertenecen a decisiones adicionales. Contenerizar no significa que todo el estado viaje dentro de la imagen.

El laboratorio fija PostgreSQL por digest, monta SQL en modo lectura y no publica puertos. Las credenciales son didácticas. Esto reduce variaciones y exposición local, pero no configura backups, HA ni acceso de producción.

**Docker Compose** puede esperar a un healthcheck. Eso evita ejecutar el test cuando PostgreSQL todavía está arrancando, pero no garantiza que siga disponible durante todo el trabajo. La aplicación aún necesita manejar caídas posteriores.

<img src="/assets/visuals/reliable-services/OPS-DELIVERY.svg" alt="La entrega conecta revisión de cambios, tests y artefacto identificable con despliegue compatible; señales y runbook permiten mitigar y verificar recuperación sin borrar incertidumbre." width="597" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/OPS-DELIVERY.svg).

## Un pipeline debe poder distinguir un resultado incorrecto

El recorrido mínimo ejecuta comprobación estática, pruebas de reglas, integración SQL y build. No sustituye los tests por un build exitoso ni acepta un mock como evidencia de un rollback real.

Archivo: terminal, desde `servicios-fiables/` tras [descargar el laboratorio](/assets/examples/servicios-fiables-lab.zip).

```bash
node --test tests/core.test.mjs
pnpm install --frozen-lockfile
pnpm exec tsc -p tsconfig.json
docker compose up -d --wait
node --test tests/postgres.test.mjs
```

La instalación usa **pnpm**. Los tests del núcleo no la necesitan; `tsc` sí utiliza dependencias de desarrollo. En CI el entorno debe contar con Node.js y Docker compatibles. El ZIP incluye un lockfile independiente para reproducir la comprobación fuera del monorepo.

Los artefactos deben poder identificarse por versión o digest. Reconstruir «el mismo código» con dependencias diferentes puede producir otro resultado. Actualizar imágenes fijadas también es parte del mantenimiento: fijar no elimina vulnerabilidades futuras.

## Deploy no es lo mismo que release

Un **deploy** instala una versión; un **release** expone un comportamiento. Una feature flag puede separarlos, pero añade estados que también deben probarse y retirarse cuando dejen de servir.

**Rolling**, **blue-green** y **canary** ofrecen diferentes formas de convivir o limitar exposición. Ninguna arregla una migración destructiva compartida por las dos versiones. El patrón expand–migrate–contract permite introducir compatibilidad antes de retirar lo antiguo.

Define qué observación detiene el avance: errores, latencia de usuario, backlog o operaciones inciertas. Un canary que solo mira `200` puede ignorar workers atascados.

## Un runbook es una secuencia de decisiones seguras

Para «crecen las operaciones desconocidas», el procedimiento puede empezar comprobando antigüedad, proveedor afectado y tasa de reconciliación. Después distinguir caída externa, error de credenciales y worker detenido.

La mitigación podría limitar nuevas operaciones, recuperar un worker o esperar al proveedor. No debería empezar cambiando todos los estados a `failed` ni borrando Inbox para «desatascar»: esas acciones destruyen evidencia y pueden repetir efectos.

Cada paso necesita salida esperada, condición para continuar y forma de verificar recuperación. Un runbook no debe contener secretos ni consultas destructivas sin scope y aprobación apropiados.

## Garantías y límites

El entorno y los comandos se han probado localmente. No se ha creado un pipeline remoto, desplegado un canary ni verificado una restauración de backup. Son pasos del integrador, no éxitos que podamos atribuir a estos ejemplos.

Un **postmortem** de un incidente sintético debe decir que es sintético. Separa cronología observada, causas respaldadas y acciones con responsable y criterio de cierre. Buscar condiciones que permitieron el fallo resulta más útil que buscar a quién culpar.

## Ejercicio: recuperación sin borrar historia

Escribe un runbook para un worker detenido después de publicar y antes de marcar Outbox. Debe recuperar trabajo, tolerar entrega repetida y conservar un contador lógico de uno. Añade una comprobación posterior de pendientes y el límite que obligaría a escalar manualmente.

Con esto termina la ruta de fundamentos. El siguiente paso es integrar estas piezas en un proyecto pequeño y repetir su matriz de fallos con persistencia, HTTP y workers completos. Los artículos no sustituyen esa validación final.

## Referencias

- [Docker: startup order y healthchecks en Compose](https://docs.docker.com/compose/how-tos/startup-order/).
- [Docker: buenas prácticas de construcción](https://docs.docker.com/build/building/best-practices/).
- [Google SRE: gestión de incidentes](https://sre.google/sre-book/managing-incidents/).
- [pnpm: instalación con lockfile](https://pnpm.io/cli/install).

Fuentes consultadas el 17 de octubre de 2026.
