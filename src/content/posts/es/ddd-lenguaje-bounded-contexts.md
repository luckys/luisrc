---
id: P044
title: 'Ubiquitous Language: acordar el significado antes de escribir clases'
published: 2026-10-20T09:00:00Z
locale: es
translationKey: domain-language-bounded-contexts
slug: ddd-lenguaje-bounded-contexts
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-MODULES]
description: 'Construye un lenguaje compartido a partir de casos concretos. Distingue cobro, entrega y devolución y convierte las diferencias en ejemplos y contratos verificables.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [ddd, ubiquitous-language, modelado, arquitectura]
---

Un pedido figura como «completado». Para cobros significa que el dinero se ha recibido; para logística, que el paquete llegó. Una comprobación utiliza ese mismo estado para admitir una devolución y la acepta cuando el comprador todavía no tiene el producto.

El código puede cumplir exactamente lo que dice su condición y aun así expresar una regla equivocada. Nos falta acordar qué significa la palabra que estamos utilizando.

Abrimos **Modelar el dominio y comunicar la arquitectura** desde [el diseño de un monolito modular](/posts/monolito-modular-solid-sin-sobreingenieria). Esta entrega se dedica al **Ubiquitous Language**. Las fronteras del modelo, las entidades y los demás patrones tendrán sus propios artículos: primero necesitamos una forma de hablar que permita reconocer una decisión correcta.

## Qué significa Ubiquitous Language

Un **Ubiquitous Language** es el lenguaje compartido que utilizan quienes conocen el negocio y quienes desarrollan el software para expresar el modelo. Sus términos deben funcionar en conversaciones, ejemplos, tests y código sin cambiar de significado entre ellos.

No consiste en traducir todos los nombres al inglés ni en mantener un glosario que nadie utiliza. Un término sirve cuando permite explicar un caso sin que cada persona complete mentalmente una definición diferente.

[Martin Fowler describe este lenguaje como algo que se contrasta y evoluciona con los expertos del dominio](https://martinfowler.com/bliki/UbiquitousLanguage.html). No esperamos acertar todos los nombres el primer día. Cuando un ejemplo revela una distinción que no habíamos visto, el vocabulario tiene que poder cambiar.

## DDD utiliza modelos, no una copia completa de la empresa

**Domain-Driven Design**, o **DDD**, orienta el diseño alrededor del conocimiento del ámbito que queremos resolver. Un modelo selecciona las distinciones útiles para ese problema.

Para decidir una devolución necesitamos saber qué se entregó, cuándo y qué condiciones exige nuestra política. No necesitamos reproducir todo el funcionamiento del transporte o de la contabilidad.

La [referencia de Eric Evans](https://www.domainlanguage.com/ddd/reference/) reúne los conceptos de DDD. Utilizaremos esas herramientas de forma gradual, sin convertirlas en una plantilla de clases ni en una obligación para cualquier CRUD.

## Sustituye una palabra ambigua por hechos que puedas comprobar

En el escenario ficticio acordamos términos más precisos. No son definiciones universales del comercio: otra empresa puede utilizar otros estados y políticas.

<div class="overflow-x-auto" role="region" aria-label="Vocabulario y límites del modelo de devoluciones" tabindex="0">

| Término                         | Qué afirma en este ejercicio                           | Qué no afirma                          |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Pago capturado                  | Hay un importe cobrado confirmado como dato de entrada | Que haya entrega                       |
| Envío entregado                 | Logística comunica que llegó el envío                  | Que toda devolución deba admitirse     |
| Precondición logística superada | La entrega permite seguir evaluando la solicitud       | Que el plazo o el importe sean válidos |
| Reserva de reembolso            | Se aparta parte del importe disponible                 | Que el proveedor haya enviado dinero   |

</div>

«Devolución aceptada» tampoco es suficiente si mezcla devolver un producto con devolver dinero. Puede hacer falta inspeccionar el artículo antes de decidir un reembolso. En este laboratorio no implementamos esa inspección; nombrar lo que falta evita fingir que el modelo ya lo contempla.

## Utiliza ejemplos que separen significados

Pregunta qué ocurre si el cobro está confirmado pero el paquete sigue en tránsito. Después cambia solo un hecho: el paquete ya se entregó. Si el resultado cambia, el modelo debe poder representar esa diferencia.

Archivo: `packages/domain-design/docs/language-examples.json`.

```json
[
  {
    "paymentState": "captured",
    "shipment": { "orderId": "o1", "state": "in_transit" },
    "shippingPrecondition": "awaiting-delivery"
  },
  {
    "paymentState": "captured",
    "shipment": { "orderId": "o1", "state": "delivered" },
    "shippingPrecondition": "eligible"
  }
]
```

Los dos ejemplos tienen el mismo estado de cobro. El resultado de la precondición logística cambia porque cambia el envío. `eligible` solo nombra el resultado de esa comprobación simplificada; no autoriza por sí solo un reembolso.

Un test carga estos casos y los contrasta con la función de traducción logística del laboratorio. No demuestra que el vocabulario sea correcto para una empresa real. Sí impide perder esta distinción al modificar el ejemplo.

<img src="/assets/visuals/domain-design/P044.svg" alt="Una palabra ambigua se contrasta con dos escenarios que mantienen el mismo cobro y cambian la entrega; el equipo acuerda términos precisos y los mantiene en ejemplos, tests y operaciones del modelo." width="290" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recorrido del lenguaje](/assets/visuals/domain-design/P044.svg).

## Lleva los verbos del negocio a las operaciones

Un método `processOrder` obliga a abrir su implementación para saber qué promete. `requestRefund` expresa una intención más concreta. Sigue necesitando un contrato: qué importe recibe, qué valida, cuándo confirma y qué devuelve.

El nombre del resultado también importa. `RefundRequested` no significa `RefundCompleted`. Si el proveedor todavía no ha actuado, utilizar el segundo nombre sería afirmar un hecho que no conocemos.

Más adelante implementaremos esa operación. Aquí basta con exigir que el mismo verbo pueda utilizarse para explicar el caso a otra persona: «Se solicita el reembolso; la solicitud se confirma; después otro componente ejecutará el efecto». Si el equipo necesita matizarlo, el nombre o el contrato aún pueden mejorar.

## Un glosario ayuda si registra decisiones y desacuerdos

Una entrada útil incluye término, significado, ejemplo y aquello que no debe interpretarse. «Pedido: objeto del sistema» no añade conocimiento. «En logística, pedido agrupa uno o varios envíos; entregado describe cada envío» permite discutir paquetes parciales.

También conviene registrar preguntas abiertas: ¿una entrega parcial permite devolver la parte recibida? ¿Una reserva se libera al cancelar? No respondemos inventando una propiedad en el DTO. Primero necesitamos una decisión del escenario y un caso que la haga comprensible.

El glosario no debe imponer una definición global si dos áreas necesitan distinciones distintas. La próxima entrega trata precisamente de limitar dónde cada modelo conserva su significado.

## Cambiar el lenguaje no obliga a romper contratos publicados

En código interno coordinado, un renombrado puede acompañarse de sus tests y documentación. Si el término aparece en una API o un evento que consumen otros sistemas, el cambio también afecta a un contrato.

Descubrir un nombre mejor no autoriza a sustituir mañana una propiedad de la API sin plan de compatibilidad. Hay que separar la mejora del modelo interno de la evolución de su interfaz pública. Esa evolución se desarrolla en [compatibilidad de APIs](/posts/evolucion-api-versiones-consumidores-contratos).

## Laboratorio y forma de comprobar los casos

Consulta el [índice de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p044/README.md) y los [ejemplos del lenguaje](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/docs/language-examples.json). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
```

El test comprueba el contraste entre tránsito y entrega con el mismo cobro. No inicia una base de datos, un proveedor o una consulta logística real.

## Garantías y límites

Estos ejemplos hacen explícito el significado que utiliza el laboratorio. No sustituyen conversación con expertos ni prueban que todos los consumidores entiendan lo mismo. Un test coherente con una definición equivocada seguirá pasando.

El lenguaje no resuelve concurrencia, permisos o recuperación. Su aportación es permitir formular esas decisiones con menos ambigüedad, antes de elegir cómo implementarlas.

## Ejercicio: elimina un estado que mezcla tres hechos

Recibe una ficha con `completed: true` y plantea tres preguntas que permitan distinguir cobro, entrega y reembolso. Escribe dos escenarios que den resultados distintos pese a compartir ese valor original. El criterio de aceptación es que otra persona pueda explicar qué cambió sin consultar el código.

Seguimos con [bounded contexts](/posts/bounded-context-limites-modelos): acordar términos dentro de un modelo no obliga a que toda la organización utilice una única representación de pedido.

## Referencias

- [Martin Fowler: Ubiquitous Language](https://martinfowler.com/bliki/UbiquitousLanguage.html).
- [Eric Evans: DDD Reference](https://www.domainlanguage.com/ddd/reference/).

Fuentes consultadas el 20 de octubre de 2026. Se conserva la URL anterior de esta entrega para no romper enlaces; los bounded contexts tienen ahora su propio post.
