---
id: P047
title: 'C4: dibujar la arquitectura sin mezclar sistemas, procesos y clases'
published: 2026-10-20T09:08:00Z
locale: es
translationKey: architecture-c4-levels
slug: c4-contexto-contenedores-componentes
draft: true
status: draft
level: intermedio
prerequisites: [DOMAIN-EVENTS, DESIGN-REQUIREMENTS]
description: 'Distingue contexto, contenedores y componentes con un servicio de devoluciones. Separa diseño objetivo de código ejecutado y acompaña la estructura con una secuencia concreta.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [arquitectura, c4, diagramas, documentacion]
---

Un diagrama conecta «cliente», «API», `Payment`, PostgreSQL y Kubernetes con flechas que dicen «usa». Quien lo lee no sabe si `Payment` es un proceso, una clase o una aplicación externa. Tampoco puede distinguir lo que ya está desplegado de lo que alguien propone construir.

El problema no se arregla eligiendo iconos más bonitos. Hace falta decidir qué pregunta responde el dibujo y mantener el mismo nivel de detalle.

Después de [coordinar una solicitud de reembolso](/posts/repositorios-eventos-dominio-concurrencia), utilizaremos **C4** para comunicar el diseño. Aprenderás a separar contexto, unidades de ejecución y componentes; también a identificar qué parte del dibujo tiene evidencia en el laboratorio.

## C4 cambia el zoom, no prescribe una arquitectura

**C4** organiza la estructura estática en cuatro niveles: **system context**, **containers**, **components** y **code**. Cada uno permite responder preguntas diferentes. No hace falta dibujarlos todos para que la documentación sea útil, como explica la [introducción oficial a los diagramas](https://c4model.com/diagrams).

Tampoco obliga a utilizar microservicios, una herramienta concreta o una notación visual exclusiva. Vamos a producir SVG desde archivos **D2** versionados, pero las decisiones de contenido importan más que el formato.

Para cada vista escribimos título, alcance y estado: **diseño objetivo propuesto; no desplegado por este laboratorio**. Esa frase no es una advertencia decorativa. Impide que un lector interprete un PostgreSQL dibujado como una integración ya probada.

## Contexto: quién utiliza el sistema y con qué otros sistemas se relaciona

La vista de **contexto** trata al sistema de devoluciones como una caja. Muestra al comprador, el sistema que estamos diseñando y un proveedor de pagos externo. No necesita enseñar clases, tablas o funciones.

La pregunta es: «¿Qué responsabilidad tiene nuestro sistema y dónde termina?». La [guía oficial de system context](https://c4model.com/diagrams/system-context) sitúa este nivel alrededor del sistema y sus interlocutores, no de sus detalles internos.

<img src="/assets/visuals/domain-design/P047-context.svg" alt="Diseño objetivo de contexto: un comprador solicita y consulta devoluciones en nuestro sistema; este solicita y consulta reembolsos en un proveedor de pagos externo. No se representa infraestructura interna." width="251" height="659" loading="lazy" style="width:100%;height:auto" />

[Ampliar la vista de contexto](/assets/visuals/domain-design/P047-context.svg).

El [mapa de **bounded contexts**](/posts/bounded-context-limites-modelos) no era esta vista. Separaba modelos de negocio. Un system context C4 muestra el sistema software de interés y sus relaciones externas. Que ambos términos contengan «context» no los convierte en el mismo concepto.

Hemos omitido logística para concentrarnos en la confirmación del reembolso. No significa que una aplicación completa no la necesite. Una vista debe declarar su alcance y enlazar las vistas complementarias, no esconder dependencias decisivas bajo una etiqueta genérica.

## Contenedores: aplicaciones y almacenes, no necesariamente Docker

En C4, un **container** puede ser una aplicación o un almacén de datos. No significa necesariamente un contenedor Docker, una máquina o una réplica. La [definición oficial](https://c4model.com/abstractions/container) distingue esa frontera de ejecución de la infraestructura donde se despliega.

Proponemos cuatro contenedores dentro del sistema: interfaz web, API, PostgreSQL y worker. El proveedor permanece fuera. El worker permite sacar el efecto remoto del commit local; eso añade trabajo operativo que tendremos que justificar, no un requisito automático de C4.

<img src="/assets/visuals/domain-design/P047-containers.svg" alt="Diseño objetivo: interfaz web llama a la API por HTTPS; la API confirma estado y outbox en PostgreSQL; un worker consulta el trabajo pendiente y solicita reembolsos al proveedor. Estos contenedores no se ejecutan en el fixture." width="331" height="695" loading="lazy" style="width:100%;height:auto" />

[Ampliar la vista de contenedores](/assets/visuals/domain-design/P047-containers.svg).

Una flecha debe indicar una relación legible: «confirma estado y outbox mediante transacción SQL» informa más que «usa». También conviene indicar tecnología cuando permite entender una dependencia real, como HTTPS/JSON o SQL. No hace falta anotar una versión de librería que no afecta a la pregunta de esa vista.

El dibujo no indica cuántas réplicas habrá, en qué región vivirán ni qué red permitirá conectarlas. Eso correspondería a una vista de **deployment**, cuando tengamos esas decisiones. Un icono de PostgreSQL no demuestra backups ni alta disponibilidad.

## Componentes: ampliar una API sin convertir cada clase en una caja

La vista de **componentes** amplía un contenedor concreto. En la API distinguimos el caso de uso, las reglas del pago y el contrato de persistencia con su adaptador. Cada caja agrupa una responsabilidad; no necesariamente un único archivo.

<img src="/assets/visuals/domain-design/P047-components.svg" alt="Dentro de la API propuesta, el caso de uso invoca reglas de Payment y depende del contrato Payments; el laboratorio dispone de un fake en memoria y el adaptador PostgreSQL permanece pendiente." width="405" height="436" loading="lazy" style="width:100%;height:auto" />

[Ampliar la vista de componentes](/assets/visuals/domain-design/P047-components.svg).

La [guía oficial de componentes](https://c4model.com/diagrams/component) sitúa estas responsabilidades dentro de un contenedor. Dibujar todas las clases haría más difícil seguir la decisión principal y crearía documentación que cambia por cualquier refactor.

También debemos distinguir tipos de flecha. «El caso de uso depende del contrato `Payments`» describe una dependencia del código. «El adaptador envía SQL a PostgreSQL» describe una interacción en ejecución. Si necesitamos ambas perspectivas, las etiquetamos o las separamos; una flecha sin significado no explica ninguna.

En el repositorio, `docs/architecture.json` hace explícitos los padres de cada elemento. Archivo: `packages/domain-design/docs/architecture.json`, extracto de componentes.

```json
  "components": [
    { "id": "refund-application", "parent": "api", "responsibility": "Coordinar el caso de uso", "fixture": "src/application.ts" },
    { "id": "refund-rules", "parent": "api", "responsibility": "Proteger límite y moneda", "fixture": "src/domain.ts" },
    { "id": "payment-repository", "parent": "api", "responsibility": "Confirmar por revisión", "fixture": "src/application.ts" }
  ],
```

Es un inventario propio del ejercicio, **no un schema oficial C4**. Los tests comprueban IDs únicos, padres, referencias y archivos citados. No generan los dibujos automáticamente ni prueban que los límites elegidos sean adecuados: eso requiere revisión humana con las reglas y restricciones del sistema.

## Una estructura estática no explica el orden de una confirmación

En la vista de componentes podemos saber quién colabora con quién. No sabemos qué ocurre primero, qué puede fallar ni cuándo debe releerse el pago.

Para eso sirve la [secuencia del post de repositorios](/posts/repositorios-eventos-dominio-concurrencia): A y B leen revisión 0, A confirma, B encuentra un conflicto, B relee y decide de nuevo. El [diagrama dinámico de C4](https://c4model.com/diagrams/dynamic) permite representar colaboraciones de un caso concreto; una secuencia también puede cumplir esa función.

El visor de trazas de ese post enseña dos recorridos, no toda la arquitectura. No ejecuta el proveedor que aparece en el diseño objetivo. Mantener esa distinción evita confundir una animación o un diagrama con una prueba de integración.

## El laboratorio y el diseño objetivo tienen alcances distintos

<div class="overflow-x-auto" role="region" aria-label="Implementación del fixture y diseño objetivo" tabindex="0">

| Elemento                        | Existe en este laboratorio  | Qué faltaría para el objetivo           |
| ------------------------------- | --------------------------- | --------------------------------------- |
| Reglas de importes y reservas   | Código TypeScript y tests   | Adaptar políticas si cambia el negocio  |
| Caso de uso y contrato Payments | Código y fake de un proceso | Integrar entradas y permisos            |
| Persistencia                    | Solo memoria                | Transacción SQL, outbox y recuperación  |
| Web, HTTP y worker              | Dibujados como propuesta    | Implementarlos y verificarlos           |
| Proveedor de pagos              | No se invoca                | Contrato, idempotencia y reconciliación |

</div>

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p047/README.md) y el [inventario de arquitectura](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/docs/architecture.json). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
```

## Garantías y límites de un diagrama revisable

Separar niveles ayuda a detectar inconsistencias y a localizar preguntas. No demuestra seguridad, rendimiento, disponibilidad o corrección funcional. Tampoco mantener el dibujo junto al código garantiza que alguien lo actualice.

Si cambia una frontera o una relación, la revisión del cambio debe incluir el dibujo afectado. Si solo cambia un nombre interno que la vista no representa, no hay motivo para actualizarla. Elegir el nivel correcto reduce ese coste.

La alternativa más simple puede ser un dibujo de contexto y una secuencia. Un diagrama de clases añade valor si la pregunta trata de tipos o relaciones internas; no sustituye la descripción de qué se ejecuta y quién lo mantiene.

## Ejercicio: identifica una caja que promete demasiado

Añade una vista de deployment para una única máquina de pruebas. Debe quedar claro qué procesos compartirían host y qué datos desaparecerían al reiniciar el fake. No dibujes réplicas o recuperación automática si no puedes explicar su mecanismo.

El criterio de aceptación es que otro lector pueda distinguir diseño, implementación y evidencia sin tener que preguntarte qué significa cada caja.

Seguimos con [ADR y decisiones revisables](/posts/adr-decisiones-arquitectura-evidencia): un diagrama puede mostrar PostgreSQL, pero todavía no explica por qué lo proponemos ni qué nos haría cambiar de opinión.

## Referencias

- [C4: niveles y diagramas](https://c4model.com/diagrams).
- [C4: contexto](https://c4model.com/diagrams/system-context), [contenedores](https://c4model.com/diagrams/container) y [componentes](https://c4model.com/diagrams/component).
- [C4: definición de container](https://c4model.com/abstractions/container).
- [C4: diagramas dinámicos](https://c4model.com/diagrams/dynamic).

Fuentes consultadas el 20 de octubre de 2026. Los dibujos muestran una propuesta educativa, no un servicio desplegado ni un diseño aprobado para producción.
