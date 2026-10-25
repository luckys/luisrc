---
id: DOCKER-VOLUMES
title: 'Volúmenes en Docker: qué sobrevive a recrear un container'
published: 2026-10-25T10:04:00Z
locale: es
translationKey: container-environments-volumes
slug: docker-volumenes-recrear-containers-datos
draft: true
status: draft
level: intermedio
prerequisites: [DOCKER-COMPOSE]
description: 'Distingue writable layer, named volume, bind mount y tmpfs. Comprueba conservación e inicialización de PostgreSQL con dos setups limpios y explica por qué un volumen no equivale a un backup.'
author: 'Luis Ramírez Calle'
series: 'Docker: construir y comprobar un entorno reproducible'
tags: [docker, volumes, postgresql, persistencia]
---

Recreas el container de PostgreSQL y las notas desaparecen. O sucede lo contrario: esperabas una base vacía para repetir una prueba y siguen apareciendo datos de ayer. En ambos casos falta hacer explícito qué almacenamiento se conserva.

Después de [conectar la API con sus dependencias](/posts/docker-compose-redes-readiness-localhost), vamos a separar el ciclo de vida del proceso y el de los datos. El objetivo es poder conservar una nota cuando corresponde y empezar realmente desde cero cuando el ejercicio lo exige.

## La writable layer pertenece al container

Un container con escritura habilitada puede modificar su filesystem sobre las layers de la image. Esos cambios no alteran la image original. Parar y volver a arrancar ese mismo container conserva su capa escribible; eliminarlo elimina también esa capa.

Un **named volume** tiene otro ciclo de vida. Docker gestiona el almacenamiento y lo monta en la ruta que indicamos. Un nuevo container puede montar el mismo volumen y encontrar los archivos anteriores.

La API del laboratorio no necesita archivos persistentes. PostgreSQL sí los necesita para conservar sus tablas. Redis se usa como cache y puede reconstruirse a partir de SQL. Esa distinción determina qué montamos, en lugar de añadir volúmenes a todos los servicios por costumbre.

## Named volume, bind mount y tmpfs responden a necesidades distintas

Un **named volume** evita fijar una carpeta específica del host para los datos de PostgreSQL. Su nombre queda asociado al proyecto Compose. El harness usa un proyecto aleatorio, de modo que su volumen no coincide con el de un arranque manual.

Un **bind mount** hace visible un archivo o directorio concreto del host. Lo utilizamos para el SQL inicial: queremos que PostgreSQL lea exactamente el fichero que está en el repositorio. Se monta con `:ro` porque el servicio no debe modificar ese source.

Un **tmpfs** permite almacenamiento temporal que no se conserva al detener el container. Puede servir para ciertos archivos efímeros; ocupa recursos de memoria y no proporciona persistencia. Este laboratorio no lo necesita y no monta uno para PostgreSQL.

Estas opciones tampoco son intercambiables al mover el entorno. Un bind mount depende de rutas del host; un volumen requiere gestionar y migrar su contenido si cambias de máquina.

## El montaje de PostgreSQL debe coincidir con la image usada

Extracto de `services.postgres.volumes`, en `compose.yaml`:

```yaml
    volumes:
      - pgdata:/var/lib/postgresql
      - ./sql/01-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
```

La image fijada ejecuta **PostgreSQL 18.4**. Para la familia 18 usamos el volumen en `/var/lib/postgresql`, conforme a su organización de datos. No copies sin revisar una ruta de un tutorial para otra versión mayor.

`pgdata` se declara también en la sección superior `volumes`. Compose resuelve el nombre del proyecto para crear su volumen. La captura registra el montaje efectivo, su nombre, destino y modo de acceso.

Actualizar una image de PostgreSQL a otra versión mayor no migra automáticamente el formato de los datos. Fijar un digest facilita identificar qué se ejecutó, pero la compatibilidad y la migración siguen necesitando un procedimiento propio.

## El SQL inicial se ejecuta al inicializar datos nuevos

La image oficial procesa los scripts de `/docker-entrypoint-initdb.d` durante la inicialización de un directorio de datos vacío. Reutilizar un volumen inicializado no vuelve a ejecutar ese paso como si fuera una migración.

Archivo `sql/01-schema.sql`:

```sql
CREATE TABLE notes (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,40}$'),
  text text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 200)
);
```

Las restricciones protegen también la escritura SQL: identificadores válidos, texto no vacío y clave primaria. La API añade validación para responder con errores útiles antes de llegar a la base de datos.

Editar este script y reiniciar PostgreSQL sobre el volumen anterior no actualiza una tabla existente. Para cambios de un servicio real hacen falta [migraciones compatibles](/posts/migraciones-base-datos-sin-romper-aplicacion). Borrar los datos para aplicar un esquema nuevo solo sirve cuando se ha decidido que esos datos son desechables.

## El ejercicio distingue conservación de un setup vacío

La secuencia empieza con cero notas, crea una y verifica que la lectura funciona. Después elimina los containers y redes mediante `down`, manteniendo el volumen. Al levantar el proyecto de nuevo, PostgreSQL conserva una fila y la API la obtiene desde SQL.

Más adelante se ejecuta `down --volumes`, siempre sobre el proyecto aleatorio creado por el harness. Se comprueba que ya no tiene volúmenes y se repite el arranque. La nota anterior devuelve `404`; crearla de nuevo funciona.

<img src="/assets/visuals/container-environments/DOCKER-VOLUMES.svg" alt="El primer setup comienza con cero notas y guarda una. Después de down y up con el mismo volumen sigue habiendo una; eliminar el volumen y volver a levantar el proyecto produce cero notas y una lectura 404." width="229" height="708" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/container-environments/DOCKER-VOLUMES.svg).

El recuento procede de SQL y las lecturas se verifican por HTTP. No inferimos conservación porque el nombre del volumen siga apareciendo en una lista.

## Un volumen conserva archivos; un backup permite recuperarlos

Recrear containers con el mismo volumen demuestra separación de ciclos de vida. No prueba recuperación si el disco se pierde, si alguien borra el volumen o si una consulta modifica datos incorrectamente.

Un **backup** necesita una copia independiente y un procedimiento de restauración probado. También hay que decidir qué pérdida de datos y tiempo de recuperación resultan aceptables. Este ejercicio no crea esa copia ni ejecuta una restauración.

La misma distinción afecta a Redis. Se configura sin snapshots ni AOF porque guarda copias prescindibles de notas inmutables. Perder esa cache puede aumentar consultas SQL; no debería eliminar las notas. Usar Redis para una cola u otro estado obligatorio exigiría revisar esa decisión.

## Recorrer la evidencia de conservación y limpieza

<iframe src="/assets/interactive/container-environments/explorer.html" title="Explorador de la ejecución de Docker Compose, persistencia y caídas de dependencias" width="100%" height="880" loading="lazy" style="border:1px solid #475569;border-radius:12px"></iframe>

Selecciona `volume_reused` y `second_fresh_setup`. El visor muestra los hechos capturados y deja sin valor los campos que una fase no midió. Los controles solo cambian la vista de datos estáticos; no ejecutan `down` ni acceden a tu Docker local.

## Código completo y pruebas

Clona el repositorio y consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/container-environments/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
```

El [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/docker-volumes/README.md) enlaza Compose, SQL y ejercicio. Desde la raíz del monorepo, tras instalar con pnpm:

```bash
pnpm --filter @luisrc-examples/container-environments exercise
pnpm --filter @luisrc-examples/container-environments verify
```

El README incluye arranque y limpieza manuales. El harness elimina únicamente los recursos de su propio proyecto; no ejecuta una limpieza global de Docker.

## Garantías y límites

Se verificaron una nota conservada al reutilizar el volumen y un segundo setup vacío después de eliminarlo. Es un recorrido local con paradas controladas y datos ficticios.

No se ha probado un corte de energía, corrupción, recuperación frente a pérdida del disco, backup restore ni upgrade de versión mayor. Persistencia observada en este recorrido no equivale a durabilidad ante cualquier fallo.

## Ejercicio: explicar por qué el esquema no cambia

Crea un entorno manual desechable, añade una columna al SQL inicial y vuelve a levantarlo sin eliminar el volumen. Comprueba el esquema real con `psql`. Explica qué evidencia distingue «el script cambió en Git» de «la base de datos aplicó una migración».

## Referencias

- [Docker: volumes y ciclo de vida](https://docs.docker.com/engine/storage/volumes/).
- [Docker: bind mounts](https://docs.docker.com/engine/storage/bind-mounts/).
- [Docker: tmpfs mounts](https://docs.docker.com/engine/storage/tmpfs/).
- [PostgreSQL official image: almacenamiento e initialization scripts](https://github.com/docker-library/docs/blob/master/postgres/README.md).
- [Docker Compose: qué elimina down](https://docs.docker.com/reference/cli/docker/compose/down/).

Fuentes consultadas el 25 de octubre de 2026.
