---
id: CD-ARTIFACTS
title: 'Artefactos inmutables: desplegar lo que probaste y conservar una vuelta atrás'
published: 2026-10-25T13:01:00Z
locale: es
translationKey: progressive-delivery-artifacts
slug: artefactos-inmutables-promocion-rollback
draft: true
status: draft
level: intermedio
prerequisites: [P063]
description: 'Relaciona source, configuración de release e identidad de la image. Aprende a promover un artefacto ya probado, comprobar lo que ejecuta cada container y conservar la versión compatible para un rollback.'
author: 'Luis Ramírez Calle'
series: 'CI/CD: entregar cambios y conservar una vuelta atrás'
tags: [artifacts, docker, ci-cd, rollback]
---

Staging ejecutó una image y producción reconstruyó otra desde el mismo commit. El source coincidía, pero la etiqueta de la base había cambiado. La validación anterior ya no describía exactamente el artefacto que acababa de desplegarse.

Después de [definir los gates del pipeline](/posts/ci-cd-pipeline-gates-evidencia), necesitamos una identidad que los conecte con la ejecución. Si cada entorno reconstruye por su cuenta, «probado» y «desplegado» pueden referirse a contenidos diferentes.

## Un artefacto incluye más entradas que el commit

Un **artefacto** es el resultado identificable que distribuimos: una image, un binario o un paquete, por ejemplo. En nuestro caso es una image Docker con runtime, JavaScript compilado, dependencias y un fichero de release.

El commit ayuda a rastrear el código. El **lockfile** fija resoluciones de paquetes. La image base y la configuración de construcción también influyen en el resultado. Guardar únicamente el SHA de Git dejaría fuera esas entradas.

El laboratorio conserva hashes de las fuentes y entradas de build junto a los IDs de las images construidas. No intenta demostrar que dos builds independientes producirán exactamente los mismos bytes. Su objetivo es poder reconocer y reutilizar el contenido que sí se construyó y comprobó.

## Una tag es un nombre; un identificador de contenido fija una versión

Una **tag**, como `api:stable`, puede apuntar después a otra image. Puede resultar cómoda para encontrar una versión, pero no basta como prueba de identidad cuando alguien tiene permiso para moverla.

Un **digest** identifica contenido. En un registry puede referirse a un manifest de plataforma o a un índice de varias plataformas. El image ID que muestra Docker local es otra referencia del sistema local; no conviene intercambiar esos valores solo porque todos empiecen por `sha256`.

Aquí construimos tags únicas por ejecución, consultamos `docker image inspect` y utilizamos los **IDs locales** en Compose con `pull_policy: never`. No hay registry push ni un digest publicado que otro equipo pueda descargar.

## Construir una vez y promover el mismo contenido

La promoción cambia el destino o la exposición del artefacto; no debería necesitar recompilarlo a escondidas. El candidato de nuestro caso se utiliza en dark deployment, rolling, blue-green y canary con el mismo ID.

Las diferencias entre releases están en un JSON copiado durante el build. La versión estable fija `divisor: 1` y la candidata fija `divisor: 100`, además del contrato de esquema que usa. El servidor compilado es compartido para concentrar el ejercicio en entrega y compatibilidad.

Extracto del stage runtime del Dockerfile:

```dockerfile
ARG RELEASE=stable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /output ./
COPY --chown=node:node packages/progressive-delivery/variants/${RELEASE}.json /app/release.json
USER node
CMD ["node", "dist/server.js"]
```

El argumento de build elige qué fichero se incluye. En ejecución no cambiamos esa configuración de release mediante una variable de entorno. Cambiar el fichero incluido produce otro contenido y exige construir otra image.

Una feature flag sí cambiará exposición durante el recorrido, pero no reescribirá ese archivo. Registrar ambos estados, image y flag, permite explicar por qué una misma image puede dar resultados diferentes sin atribuirlo a un cambio de binario.

<img src="/assets/visuals/progressive-delivery/CD-ARTIFACTS.svg" alt="Source, lockfile y configuración de release producen una image candidata identificada. Dark deployment, rolling y canary reutilizan su ID; volver atrás selecciona el artefacto estable conservado, sin reconstruirlo durante el incidente." width="279" height="692" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/progressive-delivery/CD-ARTIFACTS.svg).

## La configuración externa también forma parte del estado de una entrega

Una image inmutable no congela todo el sistema. Las URLs de dependencias, los secretos, el esquema SQL, las flags y las reglas de tráfico pueden vivir fuera de ella. Para reproducir una incidencia necesitamos relacionar esas versiones con el artefacto.

En el fixture, la conexión SQL procede de Compose y las rutas del router se cambian por IPC con una revisión esperada. El esquema se amplía antes de exponer el candidato. La captura conserva esas decisiones además de la identidad de las images.

No metemos credenciales reales dentro de la image para intentar convertir todo el entorno en un único objeto. Eso haría más difícil rotarlas y distribuiría secretos con el artefacto. Las credenciales del laboratorio son públicas y desechables.

## Comprobar la image declarada y la que ejecuta el container

El script consulta `Image` en la inspección de los containers. Durante el primer paso rolling exige candidato en `a` y estable en `b`. Después exige candidato en ambos.

Al revertir `green`, comprueba el ID efectivo antes de verificar la lectura:

```javascript
  const greenContainer = (await json('inspect', await compose('ps', '-q', 'green')))[0]
  assert.equal(greenContainer.Image, stable)
```

La comparación detectaría un container que siguiera usando otro artefacto. La respuesta HTTP añade una comprobación de comportamiento y revisión de release. Son evidencias complementarias: un nombre de versión devuelto por una API podría estar mal configurado, y un ID correcto no prueba por sí solo que el precio sea correcto.

## Conservar un artefacto antiguo no garantiza que pueda volver

Para hacer rollback hay que tener la versión anterior disponible y poder ejecutarla con las dependencias actuales. Si eliminamos una columna que esa versión consulta, seleccionar su image volverá a introducir un consumidor incompatible.

El laboratorio conserva `name` al añadir `display_name`. Por eso el artefacto estable puede volver y leer una fila creada por el candidato. La comprobación depende del contrato SQL mantenido; no surge de la inmutabilidad de la image.

También hay que decidir cuánto tiempo retener artefactos, manifests, firmas y evidencia. Aquí se conservan images locales al terminar. Si el host las elimina, el archivo de captura no puede reconstruir por sí solo aquel contenido.

## Código completo y pruebas

Consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/progressive-delivery/README.md) y el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/cd-artifacts/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/progressive-delivery run exercise
pnpm --filter @luisrc-examples/progressive-delivery run verify
```

Revisa `pipeline_completed`, `candidate_deployed_dark`, `rolling_first_slot` e `image_rollback`. Los IDs completos de la captura evitan depender de una abreviatura en el artículo.

## Garantías y límites

Se construyeron dos images locales y se inspeccionaron sus identidades durante sustituciones reales. El rollback utilizó el artefacto estable conservado, con el esquema expandido.

No hay firma, verificación de attestations, registry remoto ni build multi-arch. Un identificador de contenido ayuda a reconocer bytes; la confianza en su origen requiere controles adicionales.

## Ejercicio: reconstrucción y promoción no significan lo mismo

Escribe qué referencias guardarías para promover una image de staging a producción sin reconstruirla. Añade la versión de configuración y la migración esperada. Después plantea qué comprobarías si el container declara la release correcta, pero su image ID no coincide con el aprobado.

## Referencias

- [Docker: digests, tags e índices multi-platform](https://docs.docker.com/dhi/explore/security-concepts/digests/).
- [Google SRE: release engineering](https://sre.google/sre-book/release-engineering/).
- [Dockerfile: ARG y COPY](https://docs.docker.com/reference/dockerfile/).

Fuentes consultadas el 25 de octubre de 2026.
