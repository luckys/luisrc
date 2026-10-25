---
id: DOCKER-LAYERS
title: 'Dockerfile y build cache: cambiar código sin reinstalar dependencias'
published: 2026-10-25T10:01:00Z
locale: es
translationKey: container-environments-layers
slug: dockerfile-layers-build-cache-dependencias
draft: true
status: draft
level: intermedio
prerequisites: [P062]
description: 'Explica layers, build context, Dockerfile y cache con un experimento real. Aprende a separar manifiestos y source, limitar el contexto y distinguir reutilización de cache de reproducibilidad.'
author: 'Luis Ramírez Calle'
series: 'Docker: construir y comprobar un entorno reproducible'
tags: [docker, dockerfile, build-cache, pnpm]
---

Cambias un mensaje de la API y el build vuelve a instalar todas las dependencias. El programa necesita recompilarse; la lista de paquetes sigue siendo la misma. El Dockerfile ha mezclado dos entradas que cambian a ritmos diferentes.

Después de distinguir [images y containers](/posts/docker-images-containers-entorno-reproducible), vamos a ordenar el build. La idea es que Docker pueda reutilizar trabajo cuando sus entradas relevantes no han cambiado, sin saltarse la instalación necesaria cuando cambia el lockfile.

## Qué guarda una layer y qué decide la build cache

Una **layer** representa cambios en el filesystem de la image. Las layers se apilan para ofrecer una vista conjunta. Un archivo añadido en una layer anterior no desaparece de ella porque otra posterior deje de mostrarlo.

El **Dockerfile** describe cómo construir la image. No todas sus instrucciones añaden contenido de archivos: algunas, como `CMD` o `USER`, establecen metadatos. Pensar que cada línea equivale a una copia completa del filesystem lleva a interpretar mal tanto el tamaño como la cache.

La **build cache** permite reutilizar resultados de instrucciones cuyas entradas siguen siendo válidas. Cuando cambian los archivos utilizados por un `COPY`, ese paso necesita un resultado nuevo y los pasos que dependen de él pueden volver a ejecutarse.

Por eso copiar todo el repositorio antes de instalar paquetes hace que un cambio de source afecte a la instalación. El problema es el orden de las dependencias del build, no que Docker tenga que reinstalar siempre.

## Copiar primero manifiestos y después source

Este extracto pertenece al [Dockerfile completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/container-environments/Dockerfile), dentro del stage `build`:

```dockerfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/container-environments/package.json packages/container-environments/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @luisrc-examples/container-environments
COPY packages/container-environments/tsconfig.json packages/container-environments/tsconfig.json
COPY packages/container-environments/src packages/container-environments/src
```

La instalación ve el manifiesto raíz, la configuración de **pnpm**, el lockfile compartido y el manifiesto del paquete. Después llega el código de **TypeScript**. Un cambio en `src/notes.ts` deja intactas las entradas del paso de instalación.

`--frozen-lockfile` exige que los manifiestos sean compatibles con el lockfile. Evita resolver silenciosamente otra combinación de dependencias durante el build. `--ignore-scripts` bloquea scripts de instalación; aquí los clientes usados no necesitan compilar módulos nativos. Copiar esta opción a un paquete que sí los necesite podría romperlo.

El filtro selecciona el laboratorio. Seguimos utilizando el lockfile común del monorepo; crear otro dentro del paquete daría dos fuentes que mantener.

Hay un coste deliberado: cambiar una dependencia de otro laboratorio puede modificar el lockfile compartido y hacer que este paso pierda cache. Para un repositorio didáctico preferimos una configuración sencilla. Una estrategia de pruning más compleja tendría que justificar el trabajo adicional que introduce.

<img src="/assets/visuals/container-environments/DOCKER-LAYERS.svg" alt="El build parte de Node fijado, copia manifiestos y ejecuta pnpm install antes del source. Cambiar un comentario de TypeScript conserva la instalación en cache y hace que el trabajo posterior de compilación se evalúe de nuevo." width="261" height="676" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/container-environments/DOCKER-LAYERS.svg).

## El build context determina qué archivos están disponibles

La ruta del Dockerfile y el **build context** cumplen funciones distintas. Compose usa la raíz del monorepo como contexto porque el lockfile está allí. Los orígenes de `COPY` se resuelven desde ese contexto.

Sin un filtro, el builder podría recibir dependencias instaladas, documentos o archivos locales que no necesita. `Dockerfile.dockerignore`, junto al Dockerfile del paquete, contiene una allowlist. Primero excluye todo y después permite únicamente los manifiestos, la configuración TypeScript y el source necesarios.

No copiamos `node_modules` del host. Podría contener rutas o binarios preparados para otra plataforma. El build instala sus propias dependencias dentro de la image base seleccionada.

Tampoco enviamos archivos `.env`. Un fichero secreto que no entra en el contexto no puede colarse por un `COPY` demasiado amplio. Es una precaución útil, aunque no sustituye revisar qué fuentes se permiten ni impedir que alguien escriba un secreto directamente en ellas.

## El experimento cambia source sin tocar el checkout

`scripts/exercise.mjs` construye primero la API real. Después crea un contexto temporal con la misma allowlist y añade un comentario a `src/notes.ts`. El segundo build llega hasta el stage `build`.

La comprobación busca el paso `RUN pnpm install` en la salida de BuildKit y exige que aparezca como `CACHED`. No deduce reutilización a partir de una duración corta. El archivo final conserva `sourceChangeInstallCached: true`; la salida detallada queda en `.artifacts/cache-source-change.log`, ignorada por Git.

La copia temporal se elimina al terminar. El experimento no cambia el código que ejecuta el lector ni deja un comentario de prueba en el repositorio.

No hemos medido cuánto ahorra esa cache. La conexión, el estado previo del builder y el hardware modificarían el resultado. La evidencia demuestra reutilización para esta modificación concreta, no un porcentaje universal de mejora.

## Cache válida no significa dependencias actualizadas

Un paso cacheado reutiliza un resultado. No comprueba por sí solo si han aparecido nuevas vulnerabilidades o revisiones de la base. Del mismo modo, una dependencia fijada puede seguir siendo antigua aunque el build sea reproducible.

Actualizar exige cambiar intencionalmente las entradas, reconstruir y probar. Desactivar toda la cache de manera permanente no sustituye esa política: podrías reconstruir la misma combinación vulnerable más lentamente.

Los **cache mounts** de BuildKit ofrecen otra optimización: mantener descargas de paquetes entre ejecuciones que sí necesitan reinstalar. Este Dockerfile no los utiliza. Aquí interesa comprobar primero el orden de las capas; añadir un store compartido requeriría decidir también qué builds pueden escribir en él.

## Código completo y pruebas

Clona el repositorio y consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/container-environments/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
```

El [índice de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/docker-layers/README.md) enlaza Dockerfile, allowlist y ejercicio. Desde la raíz del monorepo:

```bash
pnpm --filter @luisrc-examples/container-environments exercise
pnpm --filter @luisrc-examples/container-environments verify
```

Instala primero las dependencias con los comandos del [inicio de la serie](/posts/docker-images-containers-entorno-reproducible). La ejecución utiliza Docker y puede descargar paquetes o images si faltan.

## Garantías y límites

Se observó cache de instalación al cambiar un comentario de source en una copia temporal. También se compiló la API y se ejecutó en el recorrido HTTP. No se verificó cache remota, un runner vacío de CI ni repetibilidad byte por byte.

El build necesita acceso al registry de paquetes cuando no puede reutilizar descargas o resultados. El lockfile fija resoluciones; no garantiza disponibilidad permanente de ese servicio.

## Ejercicio: cambiar la entrada que corresponde

En una copia del laboratorio, cambia primero un comentario de TypeScript y después una dependencia junto a su lockfile. Observa el paso de instalación en ambos builds. Explica por qué `CACHED` sería correcto en el primer caso y sospechoso si el segundo cambio no afectara a sus entradas.

## Referencias

- [Docker: image layers](https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/).
- [Docker: optimizar la build cache](https://docs.docker.com/build/cache/optimize/).
- [Docker: build context y archivos dockerignore](https://docs.docker.com/build/concepts/context/).
- [pnpm: opciones de instalación](https://pnpm.io/cli/install).

Fuentes consultadas el 25 de octubre de 2026.
