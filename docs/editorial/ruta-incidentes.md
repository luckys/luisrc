# Responder a incidentes: de la señal a una mejora verificada

Seis drafts españoles amplían P061 con un incidente sintético reproducible.
OPS-DELIVERY conserva su introducción y su laboratorio. Las explicaciones y snippets
permanecen en los posts; el código completo vive en `packages/incident-response`
del monorepo luisrc-blog-examples.

## Orden recomendado

1. [Triage y evidencia](../../src/content/posts/es/incidentes-triage-sintomas-hipotesis-evidencia.md): impacto, hipótesis y una API viva sin progreso.
2. [Mitigación y recuperación](../../src/content/posts/es/mitigar-incidente-verificar-recuperacion.md): contener, restaurar y contrastar resultados.
3. [Runbooks](../../src/content/posts/es/runbooks-precondiciones-pasos-salida-segura.md): alcance, precondiciones, revisión y salida segura.
4. [On-call y handoff](../../src/content/posts/es/on-call-coordinacion-incidentes-handoff.md): roles, comunicación e incertidumbre transferida.
5. [Postmortems](../../src/content/posts/es/postmortems-blameless-cronologia-causas.md): cronología, mecanismo y condiciones contribuyentes.
6. [Acciones y regresión](../../src/content/posts/es/acciones-postmortem-regresion-evidencia-cierre.md): criterio, responsable y evidencia de cierre.

## Por qué seis partes

Diagnosticar, intervenir, coordinar y aprender requieren decisiones distintas.
Separarlas permite explicar el mismo caso con detalle sin un artículo que mezcle
todo el ciclo. Cada entrega incluye diagrama, código, ejercicio y límites.
El postmortem incorpora un replay estático; mitigación muestra recuentos observados.

## Alcance de la evidencia

HTTP y dos procesos reales, once eventos capturados. Cero pasa la validación legacy
y selecciona un lote vacío. Tres trabajos quedan pendientes durante al menos tres
ticks observados. La recuperación conserva IDs, completa cinco trabajos anteriores
y dos nuevos; rechaza cero sin cambiar configuración. Nueve tests y typecheck.

Runbook ejecutado por script; coordinación ficticia, sin guardia o paging real.
Cola en memoria, sin durabilidad, crash recovery o exactly-once demostrado.
La ruta validada ya existe en el binario, no se despliega una versión nueva.
Dos acciones verificadas solo en fixture y dos abiertas. No publicar ni comitear
automáticamente. Ver `incident-response-review.md` para la verificación final.

Siguiente bloque: P062 y entornos reproducibles; después P063–P066 según fichas.
Mantener gaps P026, Stripe sandbox P045 y soak P058. Serie02 conserva su alcance
de estructuras de datos y algoritmos. El inventario de IDs no sustituye aceptación.
