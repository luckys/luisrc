---
id: INC-ONCALL
title: 'On-call y coordinación: quién decide, quién actúa y qué necesita un relevo'
published: 2026-10-25T08:03:00Z
locale: es
translationKey: incident-response-oncall-handoff
slug: on-call-coordinacion-incidentes-handoff
draft: true
status: draft
level: intermedio
prerequisites: [INC-RUNBOOKS]
description: 'Organiza roles, cambios y comunicación durante un incidente. Define un handoff que conserve hechos e incertidumbres y distingue una plantilla completa de una coordinación humana realmente ensayada.'
author: 'Luis Ramírez Calle'
series: 'Responder a incidentes: de la señal a una mejora verificada'
tags: [on-call, incidentes, handoff, operaciones]
---

Dos personas aplican mitigaciones distintas, otra intenta entender el estado y nadie sabe quién comunicó el último cambio. Tener suficientes conocimientos técnicos no evita por sí solo esa confusión.

La coordinación necesita que alguien mantenga el contexto del incidente, que las intervenciones sean visibles y que el relevo no dependa de reconstruir una conversación dispersa.

Después de [definir un runbook con precondiciones](/posts/runbooks-precondiciones-pasos-salida-segura), nos centraremos en la parte humana. El laboratorio incluye documentos ficticios y pruebas de su estructura. **No se avisó a una guardia ni se ejecutó un handoff entre personas**.

## On-call no es simplemente recibir una notificación

Estar **on-call** implica saber qué servicio se cubre, cómo reconocer su impacto y cuándo pedir ayuda. También requiere acceso a las herramientas, autoridad para ciertas acciones y un camino de escalación cuando esa autoridad no basta.

Una alerta entregada a alguien sin contexto o sin permisos no equivale a una capacidad de recuperación. El procedimiento, los accesos y el respaldo deben prepararse antes del incidente.

La organización de turnos depende del equipo. Aquí no proponemos una rotación universal ni afirmamos que exista una guardia real detrás de los nombres del fixture. `lab-ic`, `lab-ops` y `lab-comms` son etiquetas para explicar responsabilidades.

## Separar responsabilidades no exige un organigrama enorme

La función de **incident commander** mantiene la visión global: alcance, prioridades, estado y reparto de trabajo. La función de **operations** realiza las intervenciones técnicas acordadas. La de **communications** mantiene informadas a las personas que necesitan conocer el estado.

En un incidente pequeño, una persona puede asumir varias funciones. Lo importante es que se sepa quién las está cubriendo y cuándo necesita delegar una de ellas para no perder contexto.

Coordinar tampoco significa que todo el mundo cambie el sistema a la vez. Si una persona restaura configuración mientras otra reinicia el worker, resulta más difícil atribuir efectos y preservar trabajo. Un registro compartido ayuda a evitar intervenciones contradictorias.

<img src="/assets/visuals/incident-response/INC-ONCALL.svg" alt="La coordinación distingue decisión, operación y comunicación, conserva hechos y cambios en un registro compartido y prepara un relevo con alcance y siguiente acción; la confirmación humana no queda probada por rellenar una plantilla." width="367" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/incident-response/INC-ONCALL.svg).

## El registro debe conservar también lo que aún no sabemos

En el incidente del lote cero podemos afirmar que hay tres trabajos aceptados pendientes y que la API responde. Antes de contrastar el selector, el mecanismo exacto sigue siendo una hipótesis.

Un comunicado que diga «hemos encontrado la causa y estará resuelto en cinco minutos» introduce dos certezas que quizá no tengamos. Es mejor separar impacto observado, intervención actual, incertidumbre y momento de la próxima actualización.

`docs/coordination.json` incluye un borrador de estado con esa separación. No es un mensaje enviado a clientes ni una conversación transcrita. Los nombres, fechas de revisión y roles son parte de un **tabletop example**, un ejemplo preparado para discutir el procedimiento.

No hace falta compartir cada detalle interno con cualquier audiencia. Los equipos que intervienen necesitan contexto técnico; quien depende del servicio puede necesitar alcance y alternativas. En ambos casos hay que evitar secretos o datos personales innecesarios.

## Handoff: transferir una investigación, no solo una guardia

Un **handoff** útil explica alcance, hechos, hipótesis, cambios aplicados y siguiente acción. Debe indicar también riesgos y condiciones que obligan a escalar.

La persona entrante necesita poder distinguir «se ejecutó el cambio» de «se comprobó el resultado». Si solo recibe «ya está mitigado», puede reabrir entrada antes de verificar que los jobs anteriores se conservan.

El fixture comprueba que su plantilla contiene un contexto mínimo. `src/review.ts`:

```typescript
export function handoffHasContext(handoff: Record<string, unknown>) {
  return ['scope', 'facts', 'hypotheses', 'changes', 'nextAction', 'acknowledgedBy']
    .every((key) => typeof handoff[key] === 'string' && String(handoff[key]).trim().length > 0)
}
```

Eso solo valida campos no vacíos. No comprueba que sean ciertos, que estén actualizados o que otra persona los haya leído. En el ejemplo, `acknowledgedBy` contiene expresamente un marcador ficticio, no una confirmación humana.

## Un check de documento no prueba comunicación

Las pruebas hacen explícita esa frontera:

```javascript
  assert.equal(coordination.deliveredToPeople, false)
  assert.equal(handoffHasContext(coordination.handoff), true)
  assert.equal(handoffHasContext({ ...coordination.handoff, nextAction: '' }), false)
```

Una plantilla completa puede ser una ayuda, pero no una evidencia de que el relevo se produjo. En una operación real habría que verificar recepción, aclarar dudas y confirmar quién queda al mando.

Esto también evita una forma de falsa automatización: contar documentos generados como si fueran incidentes gestionados correctamente. Las herramientas pueden conservar datos y recordar pasos; no sustituyen todos los acuerdos entre personas.

## La carga operativa también necesita revisión

Si siempre interviene la misma persona o cada relevo repite la investigación, quizá falten documentación, acceso, formación o capacidad de respuesta. El problema no se arregla pidiendo más atención individual indefinidamente.

Revisar alertas repetidas, procedimientos ambiguos y tareas manuales recurrentes permite convertir experiencia de guardia en trabajo de ingeniería. Algunas mejoras reducirán frecuencia; otras harán más segura la recuperación.

El laboratorio no mide fatiga, tiempos de respuesta humanos o calidad de una rotación. Esas conclusiones necesitan observación real del equipo, no la duración en milisegundos de un script automático.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/inc-oncall/README.md), [ejemplo de coordinación](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/incident-response/docs/coordination.json) y comprobación de estructura:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/incident-response test
```

La evidencia técnica del incidente está en otro archivo. Mantener separado el journal observado de los documentos redactados evita atribuir a una ejecución automática conversaciones que no ocurrieron.

## Garantías y límites

Validamos estructura documental y límites declarados. No hay paging, guardia, confirmación humana, escalación o coordinación entre equipos ejecutados. Ninguno de los roles ficticios representa una persona responsable de un servicio real.

## Ejercicio: un relevo que conserve una incertidumbre

Prepara un handoff antes de restaurar el lote. Incluye una hipótesis aún no confirmada y una comprobación que decidiría el siguiente paso. Pide a otra persona que explique qué haría primero y registra dónde necesitó información que faltaba.

Seguimos con [postmortems y reconstrucción de causas](/posts/postmortems-blameless-cronologia-causas).

## Referencias

- [Google SRE: being on-call](https://sre.google/sre-book/being-on-call/).
- [Google SRE: roles y estado compartido durante incidentes](https://sre.google/sre-book/managing-incidents/).
- [Google SRE Workbook: organización de la respuesta](https://sre.google/workbook/incident-response/).

Fuentes consultadas el 25 de octubre de 2026. El material de coordinación es un ejemplo editorial, no un ejercicio de guardia humana completado.
