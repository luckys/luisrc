---
id: DOCKER-STAGES
title: 'Multi-stage builds: compilar TypeScript y entregar solo lo necesario'
published: 2026-10-25T10:02:00Z
locale: es
translationKey: container-environments-stages
slug: multi-stage-build-typescript-runtime
draft: true
status: draft
level: intermedio
prerequisites: [DOCKER-LAYERS]
description: 'Construye una API TypeScript con stages separados y dependencias portables de pnpm. Comprueba qué contiene el runtime y cómo interpretar el tamaño de las images sin confundirlo con un benchmark.'
author: 'Luis Ramírez Calle'
series: 'Docker: construir y comprobar un entorno reproducible'
tags: [docker, typescript, multi-stage, pnpm]
---

La API ya está compilada, pero la image que entregamos sigue incluyendo el compilador, el source y herramientas que solo hicieron falta durante el build. Funcionará, aunque estamos distribuyendo un entorno más amplio que el necesario para ejecutar ese programa.

Un **multi-stage build** permite separar esas necesidades en el mismo Dockerfile. Después de [ordenar las entradas para aprovechar la cache](/posts/dockerfile-layers-build-cache-dependencias), decidiremos qué pasa del entorno de construcción al de ejecución.

## Cada FROM inicia un stage

Un **stage** tiene su propio filesystem y sus instrucciones. En el laboratorio, `build` utiliza Node.js, activa el ejecutable de **pnpm** mediante **Corepack**, instala dependencias y compila. `runtime` parte de la misma base de Node y recibe el resultado seleccionado.

Usar la misma base evita introducir aquí una diferencia adicional de sistema o arquitectura entre compilación y ejecución. No hace falta que todos los proyectos lo hagan así. Si una dependencia incluye extensiones nativas, cambiar de familia de Linux o de biblioteca C exige comprobar su compatibilidad.

Ambos stages usan Node 24.19.0 fijado por digest. Eso identifica una entrada del build; actualizarla seguirá siendo una tarea explícita de mantenimiento.

## Compilar y comprobar tipos antes de copiar el resultado

El paquete tiene dos comandos distintos: `typecheck` ejecuta `tsc --noEmit` y `build` ejecuta `tsc`. La configuración strict rechaza errores de tipos y el build genera JavaScript en `dist`.

El código fuente importa `./notes.ts`. La opción `rewriteRelativeImportExtensions` reescribe esa extensión al emitir JavaScript, de modo que el runtime importa el archivo `.js` que sí está presente. Copiar solo `dist` sin revisar las rutas podría generar una image que compila y falla al arrancar.

Este es el paso completo de compilación y empaquetado del Dockerfile:

```dockerfile
RUN pnpm --filter @luisrc-examples/container-environments build \
    && pnpm --filter @luisrc-examples/container-environments deploy --prod /output
```

La instalación anterior incluye las dependencias de desarrollo porque necesitamos **TypeScript** y sus tipos. `deploy --prod` prepara otro directorio con los archivos del paquete y sus dependencias de ejecución. `files: ["dist"]`, en `package.json`, delimita el código que se entrega.

El comando utiliza el comportamiento actual de pnpm 12.8.1. No añadimos `--legacy`: este paquete no necesita la implementación anterior de deploy.

## Por qué no copiamos node_modules de cualquier manera

**pnpm** organiza paquetes mediante su store y enlaces. Copiar únicamente un directorio parcial puede dejar enlaces que apunten a archivos ausentes. Que una importación funcione dentro del monorepo no demuestra que el directorio copiado sea autónomo.

`pnpm deploy` prepara un paquete portable con su `node_modules` local. Elegimos esa operación para hacer explícita la frontera del artefacto. Los clientes **pg** y **@redis/client** se necesitan al ejecutar; el compilador y los tipos no.

Otra opción sería generar un bundle. Tendríamos que comprobar qué dependencias se integran, cuáles quedan externas y qué módulos cargan archivos dinámicamente. Para esta API pequeña, mantener las dependencias runtime como paquetes evita añadir una configuración de bundling que no necesitamos.

<img src="/assets/visuals/container-environments/DOCKER-STAGES.svg" alt="El stage build instala herramientas y compila TypeScript. pnpm deploy prepara dist y dependencias runtime; el stage final recibe ese directorio y se comprueba ejecutándolo como UID 1000 sin compilador TypeScript." width="279" height="829" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/container-environments/DOCKER-STAGES.svg).

## El runtime parte de una base nueva

Este segundo stage pertenece al mismo Dockerfile:

```dockerfile
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /output ./
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

`COPY --from=build` trae `/output`; no hereda todo el filesystem del stage anterior. `USER node` selecciona el usuario sin privilegios de root que ofrece esta base. `CMD` usa la forma de lista para ejecutar Node directamente, sin añadir un shell alrededor.

`EXPOSE` documenta el puerto del proceso. No publica el puerto en el host; esa decisión está en Compose y la veremos en el [siguiente artículo](/posts/docker-compose-redes-readiness-localhost).

`NODE_ENV=production` puede influir en bibliotecas que lean esa variable. Por sí solo no elimina dependencias de desarrollo, no comprueba permisos ni transforma una aplicación en un servicio preparado para producción. La selección de archivos y paquetes se hizo en los pasos anteriores.

## El tamaño observado tiene una unidad y un alcance

En la captura, `docker image inspect` devuelve **797.659.553 bytes** para el stage build del experimento y **344.513.982 bytes** para el runtime. Son aproximadamente **760,7 MiB** y **328,6 MiB**, usando un MiB igual a 1.048.576 bytes.

<img src="/assets/interactive/container-environments/image-sizes.svg" alt="Tamaño local informado por docker image inspect: stage build de aproximadamente 761 MiB y runtime de aproximadamente 329 MiB. Las barras comparten escala y no representan descarga comprimida, memoria ni velocidad de ejecución." width="380" height="330" loading="lazy" style="width:100%;height:auto" />

La comparación describe estas images locales. El stage build incluye un comentario de source añadido en el experimento de cache, además del entorno de construcción. No es una medición del tamaño transferido por un registry, ni del espacio adicional exclusivo: las images pueden compartir layers.

Tampoco demuestra que la API responda más rápido. Reducir lo que distribuimos y mejorar la velocidad de una operación son preguntas distintas.

## Una image que arranca aún necesita ejecutar su comportamiento

El ejercicio no se queda en un build correcto. Arranca la API, crea una nota, la lee desde PostgreSQL y después desde Redis. También consulta desde dentro del container si puede resolver el paquete `typescript`: la respuesta debe ser negativa.

Esa comprobación confirma que el compilador no está en el runtime. La base de Node sigue incluyendo otras herramientas; no la presentamos como una image distroless ni como un filesystem sin shell.

## Código completo y pruebas

Clona el repositorio y consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/container-environments/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
```

El [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/docker-stages/README.md) enlaza Dockerfile, configuración de TypeScript y pruebas. Desde la raíz del monorepo:

```bash
pnpm --filter @luisrc-examples/container-environments typecheck
pnpm --filter @luisrc-examples/container-environments exercise
pnpm --filter @luisrc-examples/container-environments verify
```

La instalación previa se hace con pnpm y el lockfile compartido, como indica el README. El gráfico se deriva de la captura guardada; no ejecuta builds desde el navegador.

## Garantías y límites

El runtime probado ejecuta el JavaScript compilado con las dependencias que necesita, sin resolver TypeScript y como UID 1000. Se probó en Linux amd64 con una base Debian bookworm.

No se ha verificado un build multi-arch, firmado la image, analizado vulnerabilidades ni demostrado reproducibilidad byte por byte. El tamaño del runtime podría reducirse con otras bases, pero habría que volver a comprobar compatibilidad y operación.

## Ejercicio: detectar una dependencia runtime omitida

En una copia del paquete, mueve `pg` a `devDependencies` y reconstruye. Explica por qué compilar podría seguir funcionando y arrancar desde el artefacto preparado por `deploy --prod` fallaría. Restaura después el manifiesto: la clasificación depende de cuándo se necesita el paquete, no de que esté escrito en TypeScript.

## Referencias

- [Docker: multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
- [pnpm: deploy de paquetes de un workspace](https://pnpm.io/cli/deploy).
- [TypeScript: extensiones de imports en el código emitido](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html).
- [Dockerfile: COPY, USER, EXPOSE y CMD](https://docs.docker.com/reference/dockerfile/).

Fuentes consultadas el 25 de octubre de 2026.
