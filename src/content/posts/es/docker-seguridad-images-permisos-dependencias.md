---
id: DOCKER-SECURITY
title: 'Seguridad de images y containers: reducir permisos y mantener las dependencias'
published: 2026-10-25T10:05:00Z
locale: es
translationKey: container-environments-security
slug: docker-seguridad-images-permisos-dependencias
draft: true
status: draft
level: intermedio
prerequisites: [DOCKER-VOLUMES]
description: 'Comprueba usuario no root, filesystem de solo lectura y restricciones de la API. Explica digests, secretos, límites de recursos y riesgos pendientes sin confundir un build correcto con una auditoría de seguridad.'
author: 'Luis Ramírez Calle'
series: 'Docker: construir y comprobar un entorno reproducible'
tags: [docker, security, supply-chain, permisos]
---

La API solo necesita leer su código, atender HTTP y consultar dos servicios. Ejecutarla como root y dejar todo su filesystem escribible le concede posibilidades que no necesita. Una vulnerabilidad tendría más opciones para causar daño.

Vamos a reducir esas posibilidades y comprobar algunos controles dentro del container. Cerramos la ruta después de [decidir dónde persisten los datos](/posts/docker-volumenes-recrear-containers-datos); ahora podemos restringir la API sin romper una escritura legítima que hubiéramos olvidado.

## El control empieza en las entradas del build

El Dockerfile usa una image oficial de **Node.js** fijada por versión y **digest**. PostgreSQL y Redis también están fijados por digest en Compose. Así el registro del ejercicio identifica el contenido usado, incluso si una etiqueta cambia después.

Un digest aporta identidad del contenido referenciado. No demuestra que ese contenido carezca de vulnerabilidades ni valida por sí solo quién lo aprobó. Seguir usando un digest antiguo indefinidamente puede conservar precisamente el software que necesitas corregir.

El mantenimiento requiere revisar actualizaciones, construir con la nueva entrada, ejecutar pruebas y decidir si promover el artefacto. Un scanner puede aportar hallazgos, pero la política debe considerar qué paquete está afectado, si existe una corrección y qué riesgo supone para el servicio.

No se ha ejecutado un vulnerability scan en este laboratorio. Fijar versiones y pasar tests no se presentará como sustituto de ese análisis.

## Sacar herramientas del runtime reduce lo que distribuimos

El [multi-stage build](/posts/multi-stage-build-typescript-runtime) deja fuera el compilador TypeScript y el source de construcción. El test dentro del container comprueba que no se resuelve `typescript`. El contexto usa una allowlist que tampoco incluye `.env`, archivos locales o `node_modules` del host.

Esto reduce contenido innecesario, pero la base de Node sigue teniendo paquetes del sistema y herramientas. No estamos usando una image distroless ni comprobando que sea imposible ejecutar un shell.

La seguridad necesita mirar el contenido concreto y sus permisos. Contar dependencias o comparar megabytes ayuda a revisar cambios, pero no asigna automáticamente un nivel de riesgo.

## USER cambia la identidad del proceso

El Dockerfile termina con `USER node`. En esta base, el proceso se ejecuta con **UID 1000**. El harness consulta `process.getuid()` desde dentro de la API para comprobar la identidad efectiva.

Eso se refiere al proceso de la aplicación. No significa que el daemon Docker se haya configurado en **rootless mode** ni que hayamos probado user namespaces. Son mecanismos distintos, con sus propias condiciones de despliegue.

`COPY --chown=node:node` asigna propiedad a los archivos copiados. La restricción de solo lectura de Compose evita modificarlos durante la ejecución. Si hubiera una necesidad legítima de escritura, sería mejor asignarle una ruta concreta que habilitar todo el filesystem sin revisarlo.

## Restringir filesystem, privilegios y recursos por separado

Extracto de `services.api`, en `compose.yaml`:

```yaml
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    pids_limit: 64
    mem_limit: 256m
    cpus: 0.5
    init: true
```

`read_only` protege el filesystem raíz. No convierte automáticamente en solo lectura un volumen que se monte con escritura; por eso hay que revisar también los montajes. La API no tiene ninguno.

`cap_drop: [ALL]` retira capabilities Linux que este proceso no necesita. La API escucha en el puerto 3000 y no requiere permisos para administrar red, dispositivos o procesos ajenos. `no-new-privileges` limita la obtención de privilegios adicionales mediante mecanismos de ejecución como setuid.

Los límites de **PIDs**, memoria y CPU acotan recursos distintos. `256m` no garantiza que el servicio soporte una carga concreta, y medio CPU no significa disponer en exclusiva de medio núcleo físico. Son restricciones del fixture, no un dimensionamiento de producción.

`init: true` incorpora un pequeño proceso de inicialización para gestión de señales y recolección de procesos hijos. La aplicación también atiende `SIGTERM`, cierra el servidor y termina conexiones con un límite de espera. Ninguna de estas opciones sustituye verificar que el shutdown conserva el trabajo de un servicio que tenga operaciones pendientes.

<img src="/assets/visuals/container-environments/DOCKER-SECURITY.svg" alt="El control empieza limitando el contexto y fijando la base. La API ejecuta con UID 1000, filesystem raíz de solo lectura y recursos limitados; análisis de vulnerabilidades, firmas y permisos de datos de producción siguen fuera de esta prueba." width="311" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/container-environments/DOCKER-SECURITY.svg).

## Qué comprobamos y qué solo está configurado

El ejercicio ejecuta una escritura a `/app/probe` desde el container. En la captura falla con **EROFS**, coherente con un filesystem de solo lectura. También consulta el UID y confirma que no puede resolver TypeScript.

La inspección de Docker registra `ReadonlyRootfs`, capabilities retiradas, `no-new-privileges`, memoria y CPU. Son datos de configuración observados. No hemos provocado un OOM, agotado PIDs o medido throttling para demostrar el comportamiento de cada límite bajo carga.

La API sigue creando y leyendo notas después de aplicar las restricciones. Ese recorrido ayuda a detectar un endurecimiento que impidiera ejecutar el caso válido.

Los controles se aplican aquí a la API. PostgreSQL y Redis mantienen las necesidades de sus images oficiales; no atribuimos a los tres servicios el mismo perfil de permisos.

## Una contraseña fuera del código necesita también un destino adecuado

Compose contiene una contraseña **pública y didáctica**. PostgreSQL no publica puerto, pero el valor sigue siendo visible en el repositorio y en la configuración del container. No es un ejemplo de gestión de secretos de producción.

Un servicio real debe usar credenciales con alcance limitado y un mecanismo de entrega apropiado al entorno. Las variables de entorno facilitan configuración, pero no evitan que un operador con acceso suficiente las inspeccione.

Durante el build, pasar un secreto por `ARG` o `ENV` puede dejarlo expuesto en resultados o metadatos. Los **BuildKit secret mounts** permiten ofrecerlo temporalmente a una instrucción. Aun así, esa instrucción podría copiarlo o imprimirlo si está mal escrita. En este build no hay tokens privados ni un secret mount ejecutado.

El usuario `lab` de PostgreSQL simplifica el fixture y tiene permisos amplios. Para producción separaríamos administración, migraciones y acceso de la aplicación. Limitar el UID de Linux de la API no restringe los permisos que conceda esa cuenta SQL.

## Código completo y pruebas

Clona el repositorio y consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/container-environments/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
```

El [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/docker-security/README.md) enlaza los controles y las comprobaciones reales. Desde la raíz del monorepo, tras instalar con pnpm:

```bash
pnpm --filter @luisrc-examples/container-environments typecheck
pnpm --filter @luisrc-examples/container-environments exercise
pnpm --filter @luisrc-examples/container-environments verify
```

## Garantías y límites

La captura demuestra UID 1000, escritura rechazada en `/app`, ausencia del compilador y configuración inspeccionada de restricciones. El recorrido funcional sigue pasando con ellas.

No es una auditoría de seguridad, un pentest, una firma del artefacto ni un scan de vulnerabilidades. Tampoco hay TLS, usuarios finales autenticados o permisos SQL mínimos. Este entorno es un laboratorio local; esos límites forman parte de su contrato.

## Ejercicio: revisar un permiso con una razón concreta

Elige una necesidad nueva, por ejemplo generar un archivo temporal. Propón una ruta y un montaje limitado, conserva el resto del filesystem de solo lectura y comprueba tanto la escritura permitida como una rechazada fuera de ella. Explica cómo limpiarías ese archivo y qué límite de recursos necesita.

## Referencias

- [Docker: prácticas de construcción y bases fijadas](https://docs.docker.com/build/building/best-practices/).
- [Compose: read_only, capabilities, security_opt y recursos](https://docs.docker.com/reference/compose-file/services/).
- [Docker: resource constraints](https://docs.docker.com/engine/containers/resource_constraints/).
- [Docker: build secrets](https://docs.docker.com/build/building/secrets/).
- [Docker Engine: límites del aislamiento](https://docs.docker.com/engine/security/).

Fuentes consultadas el 25 de octubre de 2026.
