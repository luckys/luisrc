---
id: P063
title: 'CI/CD: qué demuestra un pipeline y cuándo debe detener una entrega'
published: 2026-10-25T13:00:00Z
locale: es
translationKey: progressive-delivery-pipeline
slug: ci-cd-pipeline-gates-evidencia
draft: true
status: draft
level: intermedio
prerequisites: [P055, P062]
description: 'Conecta tests, tipos, build y controles de seguridad con criterios explícitos. Un pipeline local real muestra qué evidencia produce cada gate y por qué los checks verdes no bastan para liberar un cambio.'
author: 'Luis Ramírez Calle'
series: 'CI/CD: entregar cambios y conservar una vuelta atrás'
tags: [ci-cd, testing, delivery, security]
---

El pipeline termina en verde y la nueva versión devuelve precios incorrectos. Compila, arranca y responde `200`; ninguna de esas comprobaciones comparaba el precio con el valor que debía recibir el usuario.

Un **pipeline** resulta útil cuando sus etapas responden preguntas concretas y pueden detener el avance. El color final resume esas comprobaciones. Para interpretarlo hay que saber qué se probó, sobre qué artefacto y qué sigue pendiente.

Partimos de [diseñar pruebas útiles](/posts/disenar-pruebas-invariantes-casos-limite) y [construir un entorno Docker reproducible](/posts/docker-images-containers-entorno-reproducible). La nueva ruta separa [artefactos](/posts/artefactos-inmutables-promocion-rollback), [feature flags](/posts/feature-flags-deploy-release-comportamiento), [smoke tests](/posts/smoke-tests-release-correcta-http-200), [rolling](/posts/rolling-deployments-versiones-compatibilidad), [blue-green](/posts/blue-green-deployments-trafico-base-datos), [canary](/posts/canary-releases-candidato-control-muestras) y [rollback](/posts/rollback-aplicacion-esquema-datos-compatibles).

## CI es una práctica de integración; el pipeline aporta feedback

**Continuous Integration**, o **CI**, implica integrar cambios con frecuencia y comprobar que el resultado compartido sigue funcionando. Un servidor de automatización ayuda a hacerlo, pero tener un fichero YAML no vuelve pequeñas las ramas ni resuelve automáticamente sus conflictos.

**Continuous Delivery** busca mantener el software en condiciones de ser desplegado cuando se decida. **Continuous Deployment** añade que los cambios aceptados avanzan automáticamente a producción. Conviene aclarar qué significa «CD» en el equipo, porque las expectativas operativas son diferentes.

El laboratorio ejecuta las etapas localmente mediante un script. Eso permite observar comandos, resultados y fallos sin afirmar que hemos configurado un runner remoto o las reglas de protección de una organización.

## Cada gate debe tener una condición de aceptación

Un **gate** decide si el trabajo puede continuar según un criterio. «Ejecutar tests» describe una actividad; «detener el proceso si cualquiera falla» añade la consecuencia que necesitamos.

En `scripts/pipeline.mjs`, el helper `step` espera la operación. Si esta falla, registra el nombre de la etapa y vuelve a lanzar el error. El flujo no sigue construyendo como si hubiera pasado.

Este extracto ejecuta tres etapas independientes en intención, aunque aquí se ordenan para simplificar el recorrido:

```javascript
  await step('unit_and_router_tests', () => command('pnpm', ['run', 'test']))
  await step('typecheck', () => command('pnpm', ['run', 'typecheck']))
  await step('compile', () => command('pnpm', ['run', 'build']))
```

Los **tests** comprueban reglas y el router real. **TypeScript** comprueba tipos con configuración strict. El **build** emite el JavaScript que se empaquetará. Pasar una de estas etapas no hace redundantes las otras: código que compila puede incumplir el contrato del precio.

En un servicio mayor podrías ejecutar tareas independientes en paralelo. Mantendrías las dependencias necesarias: no puedes probar un artefacto que todavía no se ha construido ni promoverlo antes de conocer el resultado de sus gates.

<img src="/assets/visuals/progressive-delivery/P063.svg" alt="El pipeline local conecta tests, tipos, compilación, audit runtime y construcción e inspección de images. Sus ocho etapas pasan para ejecutar el fixture, pero ese resultado no concede promoción al candidato defectuoso." width="301" height="796" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/progressive-delivery/P063.svg).

## Un security gate necesita explicar su alcance

El script prepara un paquete temporal con `pnpm deploy --prod` y consulta **pnpm audit** sobre ese artefacto. Así revisa el grafo runtime del laboratorio, sin atribuirle los paquetes de las otras series del monorepo.

La política exige cero hallazgos high o critical. Un error del registry tampoco se convierte en éxito: no utilizamos `--ignore-registry-errors`. La captura conserva la respuesta completa y su fecha; una consulta futura puede descubrir nuevas vulnerabilidades.

Después del build se inspecciona la image y se aplica esta función de `src/gates.ts`:

```typescript
export function imagePolicy(input: { user: string; base: string; high: number; critical: number }) {
  return ['node', '1000'].includes(input.user) && /@sha256:[a-f0-9]{64}$/.test(input.base)
    && input.high === 0 && input.critical === 0
}
```

El usuario procede de la inspección de la image; el identificador de la base se lee del Dockerfile. Es una política pequeña, ligada a este formato de construcción. No es un analizador general de cualquier Dockerfile ni demuestra la procedencia de todos sus archivos.

El audit se limita a dependencias runtime de paquetes. No analiza los paquetes del sistema operativo, no firma images y no revisa vulnerabilidades desconocidas. Nombrar el gate «security» sin explicar esos límites daría una impresión mucho más amplia de la que permite la evidencia.

## Construir un fixture defectuoso no es aprobar su release

El caso usa dos artefactos de una API de catálogo ficticia. La configuración de release queda incluida en cada image. El candidato tiene una regresión deliberada: al activar una flag, convierte céntimos a euros y sigue etiquetando el resultado como céntimos.

Los tests contienen ese contraejemplo y comprueban que el smoke lo rechaza. Que la suite pase significa que el ejercicio distingue el caso correcto del incorrecto. No significa que hayamos validado el candidato para usuarios reales.

El resultado del pipeline marca `not_granted_negative_fixture`. Más adelante se expone la versión incorrecta dentro de un proyecto Docker desechable para probar su retirada. La activación completa de esa regresión se registra explícitamente como una prueba negativa que fuerza el camino que un gate normal debería bloquear.

Esta separación permite estudiar recuperación sin presentar el fallo conocido como una promoción legítima.

## El mismo contrato debe llegar al entorno desplegado

Probar una función en memoria ayuda a localizar errores. Probar la image desplegada añade rutas de importación, dependencias empaquetadas, configuración, red y SQL reales.

Por eso el ejercicio continúa después del pipeline: levanta servicios, modifica el esquema de forma compatible y verifica respuestas por HTTP. El canary recibe doscientas peticiones sintéticas; después se restaura una image anterior y se contrastan las filas SQL.

Un runner remoto podría ejecutar estos mismos comandos, conservar resultados y exigir el estado correspondiente antes de integrar. También necesitaría permisos mínimos, control de concurrencia y una política para código no confiable de pull requests. Este paquete no ha activado esa infraestructura remota.

## Código completo y pruebas

Clona el repositorio y consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/progressive-delivery/README.md) y el [índice de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p063/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/progressive-delivery run ci:local
pnpm --filter @luisrc-examples/progressive-delivery run exercise
pnpm --filter @luisrc-examples/progressive-delivery run verify
```

`ci:local` construye dos images y consulta el registry público para el audit. `exercise` incluye ese pipeline y el recorrido completo. `verify` solo contrasta el archivo guardado; no vuelve a desplegar nada.

## Garantías y límites

Se ejecutaron ocho etapas locales, siete tests, comprobación de tipos, audit runtime y builds reales. La captura no contiene advisories devueltos por aquella consulta. Conserva versiones, IDs de images y hashes de las fuentes.

No se ha ejecutado GitHub Actions, promovido una release real, escaneado el sistema operativo ni probado disponibilidad continua. Las imágenes del candidato son material de un fixture negativo, no una aplicación preparada para producción.

## Ejercicio: poner nombre al fallo que detendría cada etapa

Elige un error de tipos, un precio con unidades equivocadas y una dependencia con un advisory conocido. Escribe qué gate debería detectarlos y cuál podría pasar sin verlos. Si varias etapas terminan evaluando solo «el proceso arrancó», falta concretar el contrato que protege la entrega.

## Referencias

- [GitHub Actions: componentes de un workflow](https://docs.github.com/en/actions/get-started/understand-github-actions).
- [Martin Fowler: Continuous Delivery y Continuous Deployment](https://martinfowler.com/bliki/ContinuousDelivery.html).
- [pnpm: audit y opciones de error](https://pnpm.io/cli/audit).
- [GitHub: uso seguro de Actions y permisos](https://docs.github.com/en/actions/reference/security/secure-use).

Fuentes consultadas el 25 de octubre de 2026.
