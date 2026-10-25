---
id: P062
title: 'Docker: qué comparte una image y qué cambia al crear un container'
published: 2026-10-25T10:00:00Z
locale: es
translationKey: container-environments-images
slug: docker-images-containers-entorno-reproducible
draft: true
status: draft
level: intermedio
prerequisites: [P004, P005]
description: 'Distingue image, container y estado externo con una API real, Redis y PostgreSQL. Comprueba qué permanece al recrear un proceso y qué límites tiene la promesa de un entorno reproducible.'
author: 'Luis Ramírez Calle'
series: 'Docker: construir y comprobar un entorno reproducible'
tags: [docker, containers, reproducibilidad, backend]
---

Un compañero clona la API y no consigue arrancarla: tiene otra versión de Node.js, PostgreSQL escucha en un puerto distinto y falta Redis. El código coincide, pero el entorno necesario para ejecutarlo sigue repartido entre instrucciones y ajustes locales.

**Docker** permite declarar una parte importante de ese entorno y ejecutarla separada de las instalaciones del host. Para aprovecharlo hay que distinguir tres cosas: el paquete que construimos, el proceso que arrancamos y los datos que necesita conservar.

Empezamos una ruta para quien ya conoce [procesos y herramientas de Linux](/posts/linux-diagnosticar-procesos-puertos-senales) y [redes](/posts/internet-ip-routing-nat-dns). Construiremos una API de notas ficticias con **TypeScript**, **PostgreSQL** y **Redis**. Los siguientes artículos separan [layers y build cache](/posts/dockerfile-layers-build-cache-dependencias), [multi-stage builds](/posts/multi-stage-build-typescript-runtime), [Compose](/posts/docker-compose-redes-readiness-localhost), [volúmenes](/posts/docker-volumenes-recrear-containers-datos) y [seguridad](/posts/docker-seguridad-images-permisos-dependencias).

## Una image contiene archivos y configuración para arrancar

Una **image** empaqueta un filesystem y metadatos de ejecución. En nuestro caso incluye **Node.js**, el JavaScript compilado de la API y sus dependencias. También declara un directorio de trabajo, un usuario y el comando inicial.

La image no contiene un proceso de Node ejecutándose ni una copia automática de la base de datos a la que ese proceso se conectará. Tampoco decide por sí sola qué puerto del host se publica o qué volumen se monta. Esas opciones se aplican al crear el **container**.

Una image concreta es inmutable. Una etiqueta, como `mi-api:local`, puede apuntar después a otra image. Conviene separar la etiqueta legible de la identidad del contenido: repetir un nombre no demuestra que estés usando los mismos bytes.

El laboratorio fija las images base por **digest**. El digest identifica el contenido referenciado; el resultado del build de nuestra API tiene además su propio identificador local. No confundiremos ese identificador con una image publicada en un registry: aquí no hay ningún push.

## Un container es una instancia con su propio ciclo de vida

Al crear un container, Docker combina la image con la configuración de ejecución. El proceso tiene su entorno de red, sus montajes y sus límites de recursos. Si permitimos escribir en el filesystem del container, esas modificaciones pertenecen a esa instancia.

La separación utiliza mecanismos del kernel, como **namespaces** y **cgroups**. Los containers Linux comparten el kernel que los ejecuta; no arrancan cada uno un sistema operativo completo. En Docker Desktop ese kernel suele estar dentro de una máquina virtual Linux.

Esto tiene consecuencias prácticas. Una image para una arquitectura no sirve automáticamente en cualquier CPU, y un límite de memoria no desaparece porque el código esté empaquetado. La compatibilidad del host, los recursos disponibles y las dependencias externas siguen importando.

El experimento recrea la API manteniendo la image. Después comprueba dos condiciones distintas: el container ID cambia y el image ID coincide. La lectura posterior comprueba además que la nota sigue existiendo.

Este extracto de `scripts/exercise.mjs` aparece después de recrear el servicio. Los helpers consultan Docker y la API del proyecto que ha creado el harness:

```javascript
  const after = await apiId(); assert.notEqual(after, before)
  assert.equal((await json('inspect', after))[0].Image, firstImage.Id)
  assert.deepEqual((await request('/notes/first-note')).body.note, note)
```

Comparar solo IDs demostraría una sustitución de proceso. La última aserción comprueba la continuidad del dato que importa al usuario.

<img src="/assets/visuals/container-environments/P062.svg" alt="Una misma image permite crear la API original y su reemplazo. La recreación cambia el identificador del container; PostgreSQL conserva la nota en un volumen independiente al que la API accede por red." width="344" height="817" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/container-environments/P062.svg).

## Una API, una base de datos y una cache tienen estados diferentes

La API expone `POST /notes` y `GET /notes/:id`. Las notas son inmutables en este ejemplo: se crean y se leen; intentar repetir un identificador devuelve `409`. Esa restricción permite explicar Docker sin añadir todavía invalidación de cache para actualizaciones.

**PostgreSQL** es la fuente persistente. **Redis** guarda copias temporales de las lecturas durante sesenta segundos. Si Redis no está disponible, la API intenta consultar PostgreSQL. El diseño de cache no convierte Redis en una segunda fuente de verdad.

La API no necesita guardar archivos propios. Por eso su filesystem raíz puede ser de solo lectura. PostgreSQL recibe un volumen para los datos, mientras que Redis se configura sin persistencia. Las tres decisiones son intencionales; marcar todo como persistente solo ocultaría qué estado necesita realmente cada servicio.

## Qué significa reproducir el entorno en este laboratorio

Queremos que un checkout con las mismas entradas permita levantar los servicios y repetir el comportamiento del ejercicio. Fijamos versiones, digests, lockfile, esquema inicial y configuración de Compose. Después comprobamos la creación y lectura de una nota.

Eso es distinto de garantizar un build **bit reproducible**, donde cada ejecución produce un artefacto idéntico byte por byte. Los metadatos del build y otras entradas pueden cambiar. Tampoco prometemos latencias iguales en máquinas con capacidades distintas.

El setup limpio se prueba dos veces. El script crea un nombre de proyecto aleatorio, confirma que no hay recursos previos con ese nombre y arranca con cero filas. Más adelante elimina el volumen de ese mismo fixture y repite el arranque: la nota anterior devuelve `404`, se crea de nuevo y vuelve a leerse.

Conservar la cache de BuildKit durante ese ejercicio no contradice el setup vacío de datos. Son estados diferentes. Aquí se verifica la inicialización de PostgreSQL desde un volumen nuevo; no se mide una descarga completa desde una máquina sin images.

## Ejecutar y observar antes de interpretar

Desde la raíz del [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples):

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/container-environments test
pnpm --filter @luisrc-examples/container-environments typecheck
pnpm --filter @luisrc-examples/container-environments exercise
pnpm --filter @luisrc-examples/container-environments verify
```

Se necesita Docker Engine con Compose y acceso a las images y paquetes si todavía no están descargados. `exercise` construye y ejecuta servicios reales; al terminar elimina sus containers, redes y volúmenes. Conserva las images del ejercicio para poder inspeccionarlas.

`verify` comprueba el archivo guardado y sus hashes. No vuelve a ejecutar Docker. Esta diferencia importa al revisar evidencia: una captura consistente acredita aquel recorrido, mientras que una nueva ejecución comprueba que el entorno actual sigue funcionando.

El archivo `evidence/compose.json` conserva diez fases observadas, versiones y entradas del build. El identificador de proyecto y las notas pertenecen al laboratorio. No son registros de un servicio de producción.

## Código completo y pruebas

Clona el repositorio y consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/container-environments/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
```

Consulta el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p062/README.md) y el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/container-environments/README.md). Los comandos anteriores ejecutan las fuentes completas que enlazan los demás artículos; no hay una segunda implementación escondida en el blog.

## Garantías y límites

Se han ejecutado API, PostgreSQL y Redis en containers locales. Se ha observado la recreación de la API, la conservación de una nota y dos inicializaciones vacías. El fichero recoge Docker Engine 29.9.2, Compose 5.6.1 y Node.js 24.19.0 sobre Linux amd64.

El caso no prueba compatibilidad con cualquier arquitectura, alta disponibilidad, restauración de backups, seguridad de producción ni despliegues remotos. Las credenciales de PostgreSQL son públicas y exclusivamente didácticas.

## Ejercicio: localizar el estado antes de eliminarlo

Antes de ejecutar una limpieza, escribe dónde vive cada elemento: código de la API, proceso de Node, nota de PostgreSQL y copia en Redis. Predice qué cambia al reiniciar un servicio y qué cambia al recrearlo. Contrasta después la predicción con los eventos `api_recreated`, `volume_reused` y `second_fresh_setup`.

## Referencias

- [Docker: qué es una image](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/).
- [Docker: qué es un container](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/).
- [Docker Engine: namespaces, cgroups y seguridad](https://docs.docker.com/engine/security/).

Fuentes consultadas el 25 de octubre de 2026.
