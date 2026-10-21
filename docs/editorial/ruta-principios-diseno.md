# Principios de diseño sin sobreingeniería

Siete artículos en español, todos draft. Profundiza P043 tras el bloque de modelado
y documentación, sin duplicar el resumen DESIGN-MODULES ni presentar SOLID como DDD.
Laboratorio: `luisrc-blog-examples/packages/design-principles`; carpetas en inglés.
El código explicado se conserva dentro de cada artículo. No traducciones ni audio.

## Orden recomendado

1. [Cohesión y SRP](../../src/content/posts/es/cohesion-srp-razones-cambio.md): refactor antes/después y responsabilidades.
2. [OCP y composición](../../src/content/posts/es/ocp-composicion-extension-tarifas.md): variación conocida y límites de extensión.
3. [LSP y contratos](../../src/content/posts/es/lsp-contratos-sustitucion-comportamiento.md): misma firma, expectativas distintas.
4. [ISP](../../src/content/posts/es/isp-interfaces-consumidor-capacidades.md): capacidades de lectura y escritura por consumidor.
5. [DIP e inyección](../../src/content/posts/es/dip-inyeccion-dependencias-sin-contenedor.md): contrato, adaptador y composition root.
6. [KISS y YAGNI](../../src/content/posts/es/kiss-yagni-diseno-necesidad-actual.md): necesidades reales, simplicidad y decisiones reversibles.
7. [DRY](../../src/content/posts/es/dry-duplicacion-conocimiento-abstracciones.md): conocimiento compartido y políticas independientes.

## Por qué siete entregas

Cada una tiene un problema, mecanismo, código probado, alternativa, límites y un
ejercicio con resultados observables. Separar LSP/ISP/DIP evita que sustitución,
capacidad y construcción se confundan. SRP permanece con cohesión y coupling porque
explican la misma decisión de separar responsabilidades. KISS/YAGNI comparten la
decisión de no construir capacidad especulativa. DRY tiene su propio contraste.

No hay un post por palabra ni cinco clases para las cinco letras. El programa usa
funciones, tipos estructurales y un adaptador pequeño. No existe un proyecto PaySafe
ni un servicio externo escondido detrás de las fixtures.

## Aceptación y siguientes entregas

Revisar `design-principles-review.md` para evidencia y límites. P043 tiene ahora
desarrollo propio; no se considera aceptado automáticamente por un ID y tests.
P045 todavía requiere puertos/adaptadores y un proveedor sandbox real, no equiparar
el writer en memoria a esa integración. P046 necesita ownership, modelos de lectura,
consistencia y despliegue; aquí solo se introducen sus diferencias cuando procede.

Continuación redactada: [fronteras de arquitectura](ruta-fronteras-arquitectura.md),
cinco posts P045/P046 de puertos/adaptadores, capas, ownership, CQRS y despliegue.
Conservar sus límites de aceptación; después contrastar P048/P051 y Serie 06.
