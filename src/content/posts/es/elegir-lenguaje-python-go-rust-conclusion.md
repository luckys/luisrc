---
title: 'Python, Go o Rust después de PHP y TypeScript: cómo elegir y qué mitos dejar atrás'
published: 2026-10-08
locale: es
translationKey: elegir-lenguaje-python-go-rust-conclusion
slug: elegir-lenguaje-python-go-rust-conclusion
draft: true
description: 'Cierre de la serie: ventajas, ámbitos y límites de Python, Go, Rust, PHP y TypeScript, con criterios para elegir y mitos explicados.'
author: 'Luis Ramírez Calle'
series: 'Aprender otros lenguajes desde PHP y TypeScript'
tags:
  ['ingenieria-de-software', 'aprendizaje', 'php', 'typescript', 'python', 'go', 'rust']
---

Después de probar **Python**, **Go** y **Rust**, la pregunta «¿qué lenguaje debería aprender?» tiene más respuestas posibles. Ahora puedes relacionar cada opción con un trabajo concreto: investigar datos, coordinar servicios o controlar cómo se utiliza la memoria. Elegir resulta más fácil cuando sabes qué quieres hacer con lo aprendido.

En esta serie hemos construido pequeñas versiones de un informe de ventas. Con [Python](/posts/aprender-python-despues-de-php-typescript) exploramos transformaciones y herramientas de análisis; con [Go](/posts/aprender-go-despues-de-php-typescript), consultas concurrentes y cancelación; con [Rust](/posts/aprender-rust-despues-de-php-typescript), propiedad de los datos y errores explícitos.

Los ejemplos servían para entender decisiones. No eran pruebas de rendimiento ni demostraban que hubiera que abandonar **PHP** o **TypeScript**. Para cerrar la serie, merece la pena separar lo que aporta cada lenguaje de las expectativas que solemos colocar sobre él.

## Python: cuando el trabajo gira alrededor de los datos

La ventaja de **Python** aparece con claridad cuando necesitas explorar archivos, cruzar información, automatizar tareas o trabajar con herramientas científicas. **pandas** permite expresar operaciones sobre tablas; **NumPy** ofrece arrays y cálculo numérico; **scikit-learn** incluye herramientas para entrenar y evaluar modelos de aprendizaje automático. Puedes consultar los [ámbitos de uso de Python](https://www.python.org/about/apps/) y la [documentación de scikit-learn](https://scikit-learn.org/stable/).

En nuestro informe, lo elegiría si la siguiente tarea fuera investigar por qué los datos de dos tiendas no coinciden: cargar sus archivos, detectar registros incompletos y comprobar distintas explicaciones. Poder experimentar con esas operaciones dentro del mismo ecosistema es una ventaja práctica.

También se utiliza para desarrollo web y aplicaciones empresariales. Asociarlo solo con **inteligencia artificial** deja fuera mucho trabajo útil. Además, integrar una API de un modelo de IA no exige usar **Python**: la ventaja depende de las bibliotecas y del trabajo que vayas a realizar alrededor de ese modelo.

Aprenderlo puede acercarte a equipos de datos, automatización o investigación. Para trabajar en esas áreas tendrás que sumar conocimientos sobre calidad de datos, estadística o el problema estudiado. Saber llamar a una biblioteca no basta para interpretar sus resultados.

### «Python es lento, así que no sirve para proyectos exigentes»

Esta frase mezcla el coste de ejecutar código con la utilidad del sistema completo. Un cálculo que recorre millones de elementos en código **Python** puede convertirse en un cuello de botella. Pero una operación escrita desde **Python** también puede delegar el trabajo en una biblioteca nativa. La documentación de [NumPy sobre hilos](https://numpy.org/doc/stable/reference/thread_safety.html), por ejemplo, explica que muchas de sus operaciones liberan el **GIL** mientras trabajan.

El **GIL** limita a un hilo la ejecución de bytecode de **Python** dentro de un intérprete de **CPython** que lo tenga habilitado. Eso no significa que toda aplicación Python sea incapaz de aprovechar varios núcleos: existen procesos separados, bibliotecas que liberan el GIL y compilaciones _free-threaded_ que permiten deshabilitarlo. Estas últimas no son la configuración predeterminada y requieren comprobar la compatibilidad de las dependencias. La [documentación de threading](https://docs.python.org/3/library/threading.html#gil-and-performance-considerations) y la [guía de free threading](https://docs.python.org/3/howto/free-threading-python.html) explican las alternativas y sus condiciones.

Antes de cambiar de lenguaje, conviene medir qué parte del programa tarda más. Si la mayor parte del tiempo se dedica a esperar una respuesta de la base de datos, acelerar los cálculos tendrá poco efecto en el tiempo total. Si, en cambio, el programa dedica casi todo ese tiempo a procesar datos dentro de un bucle, tiene sentido revisar ese cálculo: mejorar el algoritmo, utilizar una biblioteca adecuada o valorar implementarlo en otro lenguaje.

## Go: cuando necesitas organizar trabajo concurrente y operar servicios

**Go** combina tipos estáticos, una biblioteca estándar amplia y herramientas comunes para formatear, probar y construir programas. Sus **goroutines** permiten organizar tareas concurrentes, y sus interfaces favorecen dependencias pequeñas basadas en comportamiento.

Los [casos de uso oficiales](https://go.dev/solutions/use-cases) incluyen servicios de red y nube, desarrollo web, herramientas de línea de comandos e infraestructura. Son ámbitos en los que suele importar tanto escribir el programa como desplegarlo, observarlo y entender qué hace cuando una dependencia falla.

En el informe de ventas, lo evaluaría si tuviera que construir un servicio que consulta muchas tiendas y combina sus respuestas. El interés estaría en controlar las consultas activas, sus plazos y su finalización. Esas necesidades pueden existir en comercio, logística o finanzas; el sector por sí solo no determina el lenguaje.

El aprendizaje más transferible es pensar en la vida de cada tarea: quién la inicia, qué datos comparte y cómo termina. Esa forma de razonar también ayuda al trabajar con promesas en **TypeScript** o procesos en **PHP**.

### «Go es más rápido porque tiene goroutines»

Una **goroutine** permite organizar trabajo; no hace que cada operación tarde menos. Si varias tareas esperan respuestas de red, sus esperas pueden solaparse. Si realizan cálculos independientes y hay núcleos disponibles, pueden ejecutarlos en paralelo. En ambos casos hay costes de coordinación, memoria y sincronización.

Añadir más tareas puede incluso empeorar el resultado. La [FAQ de Go sobre paralelismo](https://go.dev/doc/faq#parallel) explica por qué un programa concurrente no tiene garantizado un mejor rendimiento.

Tampoco es una capacidad exclusiva de **Go**. **Node.js** dispone de [worker threads](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html) para repartir cálculos entre hilos. **PHP-FPM** puede atender peticiones con varios procesos. Una comparación útil tiene que especificar qué implementaciones se están midiendo, con qué recursos y bajo qué carga.

### «Como Go es sencillo, la concurrencia también lo será»

Aunque iniciar una **goroutine** requiere poco código, tienes que decidir cuántas tareas pueden ejecutarse a la vez, cómo comunicar sus resultados y qué hacer si una falla o tarda demasiado. **Go** proporciona herramientas para coordinar ese trabajo, pero usarlas correctamente requiere entender esos problemas.

En el artículo de **Go** vimos que la cancelación requiere colaboración de la operación y que un envío a un canal puede quedarse esperando. Dominar esa parte necesita práctica con errores y límites, además de conocer la sintaxis.

## Rust: cuando el control de recursos justifica un esfuerzo adicional

**Rust** ofrece control sobre la memoria sin exigir un recolector de basura. Su sistema de **ownership** y **préstamos** permite comprobar en compilación quién puede acceder a determinados datos y durante cuánto tiempo. **Result** y **Option** ayudan a expresar fallos y ausencias dentro de los tipos.

Sus [ámbitos de uso](https://rust-lang.org/what/) incluyen herramientas de línea de comandos, servicios de red, sistemas embebidos y **WebAssembly**. Puede ser un candidato para componentes donde el consumo de memoria, el procesamiento o la integración con código nativo condicionan el diseño.

En el informe, lo evaluaría si una transformación de archivos consumiera demasiados recursos y las mediciones justificaran trabajar sobre esa parte. Antes comprobaría si basta con mejorar el algoritmo o procesar los datos por lotes en el lenguaje actual.

Aprender **Rust** también tiene valor aunque no exista ese problema: obliga a revisar qué funciones necesitan poseer un dato, cuáles solo lo consultan y cuándo estás copiando información. El coste es una curva de aprendizaje que incluye modelos de memoria, mensajes del compilador y nuevas convenciones de diseño.

### «Si compila en Rust, funciona correctamente»

El compilador puede rechazar ciertos accesos inválidos a memoria; no sabe si aplicaste el descuento que correspondía a una venta. Un programa puede compilar y producir un informe incorrecto, bloquearse esperando un recurso o repetir un cobro.

Las garantías del código seguro también dependen de que las bibliotecas que encapsulan código `unsafe` cumplan sus contratos. El [capítulo sobre unsafe Rust](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html) explica esa responsabilidad. La seguridad de memoria reduce una clase de problemas, mientras las pruebas y la revisión del diseño siguen cubriendo otras.

### «Rust siempre será más rápido y consumirá menos»

Poder controlar las asignaciones de memoria da margen para optimizar, pero también puedes hacer copias innecesarias, elegir un algoritmo costoso o mantener datos que ya no necesitas. El resultado depende del programa y de sus dependencias.

Tampoco hay que reescribir una aplicación entera para aprovechar un componente en **Rust**. Es posible aislar una operación, aunque la integración tendrá costes: mover datos entre componentes, distribuirlos y depurar sus fallos. La mejora medida debería compensar ese trabajo.

## PHP y TypeScript siguen siendo opciones para el siguiente proyecto

Explorar otros lenguajes no vuelve inadecuadas las herramientas que ya conoces. Esa experiencia permite entregar y mantener software con menos incertidumbre, siempre que el entorno responda a las necesidades del proyecto.

### PHP: aplicaciones web y reglas de negocio

**PHP** encaja en aplicaciones web, APIs, comercio electrónico y sistemas de gestión. Un equipo que conoce **Laravel** o **Symfony** puede aprovechar sus herramientas y convenciones para concentrarse en permisos, transacciones y procesos del negocio. El [manual de PHP](https://www.php.net/manual/en/introduction.php) recoge tanto su orientación web como su uso en línea de comandos.

**«PHP no puede atender trabajo en paralelo»** confunde el lenguaje con la ejecución de una petición. En **PHP-FPM**, varios procesos pueden atender peticiones simultáneamente. `pm.max_children` limita esa capacidad, como explica la [configuración de FPM](https://www.php.net/manual/en/install.fpm.configuration.php).

Eso no significa que una petición concreta reparta automáticamente sus cálculos entre núcleos. Tampoco que los procesos sean gratuitos: una espera bloqueante ocupa un trabajador. Son restricciones que hay que conocer, pero no demuestran que el lenguaje impida construir un servicio con muchas peticiones.

Si el informe ya pertenece a una aplicación **PHP** y cumple sus requisitos, mantenerlo ahí evita introducir otra cadena de herramientas y otro entorno que operar. Puede ser una decisión técnica perfectamente razonable.

### TypeScript: compartir conocimientos entre interfaz y servidor

**TypeScript** aporta comprobación estática al ecosistema de **JavaScript**. En aplicaciones web permite trabajar con convenciones y tipos relacionados entre frontend y backend, además de mejorar la navegación y las refactorizaciones del código. Su [manual](https://www.typescriptlang.org/docs/handbook/intro.html) describe ese papel.

**«Si está tipado en TypeScript, los datos ya están validados»** es una confusión especialmente peligrosa. Las anotaciones se eliminan y no comprueban por sí mismas una respuesta HTTP o un archivo JSON. Compartir un tipo entre cliente y servidor describe un contrato, pero no verifica que los datos recibidos lo cumplan. El [apartado sobre eliminación de tipos](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types) explica este comportamiento.

**«Una función async ejecuta sus cálculos en otro hilo»** tampoco es correcto. En el ejemplo de la serie, `async` permitía esperar sin bloquear por esa espera, pero el cálculo seguía ejecutándose en el hilo que lo atendía. Para trabajo intensivo en CPU hay que decidir cómo repartirlo, por ejemplo mediante workers. La [guía de Node.js sobre el event loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) explica cómo esos cálculos pueden retrasar otras tareas.

En un producto con mucha interacción en el navegador y un backend que integra servicios, seguir con **TypeScript** puede simplificar el trabajo del equipo. La elección del entorno de ejecución, como **Node.js** o **Bun**, forma parte de esa decisión: el lenguaje por sí solo no describe cómo se comportará el servicio.

## Una guía de elección basada en el siguiente problema

Esta tabla propone puntos de partida, no fronteras entre lenguajes. Las alternativas pueden resolver varios de los mismos problemas.

| Si tu siguiente tarea es…                                     | Merece la pena evaluar…                               | Antes de decidir, comprueba…                                             |
| ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| Investigar archivos y discrepancias en los datos              | **Python** y su ecosistema de análisis                | Calidad de los datos, bibliotecas disponibles y memoria necesaria        |
| Coordinar consultas a muchas tiendas                          | **Go** o el modelo asíncrono de tu entorno actual     | Límites de conexiones, cancelación y recursos bajo carga                 |
| Reducir el coste de una transformación intensiva              | **Rust**, tras localizar el cuello de botella         | Algoritmo, coste de integración y mejora con datos representativos       |
| Añadir el informe a una aplicación de gestión en PHP          | **PHP** con las herramientas que ya utiliza el equipo | Consultas, volumen de trabajo y necesidad de ejecutarlo en segundo plano |
| Integrar el informe en un producto web con frontend y backend | **TypeScript**                                        | Validación de entradas y separación de cálculos costosos                 |

Hay una diferencia importante entre elegir para **aprender** y elegir para **producción**. Para aprender basta con que el modelo te interese. Para introducirlo en un producto hay que considerar además quién lo mantendrá, cómo se desplegará y qué dependencias necesita.

Usar los cinco lenguajes en el informe sería un ejercicio posible, pero no una arquitectura que recomendaría por ese motivo. Cada entorno adicional exige actualizaciones, diagnóstico y conocimientos operativos. Una aplicación pequeña puede resolver todas sus necesidades con una sola elección.

## Cambiar de lenguaje puede orientar tu carrera, pero necesita un objetivo

Si buscas otro tipo de trabajo, empieza por identificar qué actividades te interesan. **Python** puede acompañar un camino hacia datos o automatización; **Go**, hacia servicios e infraestructura; **Rust**, hacia sistemas y componentes donde importa el control de recursos. Ninguno garantiza un puesto por dominar su sintaxis.

Revisa ofertas del ámbito y la ubicación que te interesan. Observa qué conocimientos aparecen junto al lenguaje: bases de datos, redes, estadística, sistemas operativos o experiencia operando servicios. Esa información permite preparar un proyecto que demuestre habilidades relevantes, sin deducir oportunidades a partir de la popularidad de una tecnología.

Si tu objetivo es ampliar conocimientos, puedes elegir por curiosidad. Lo valioso será explicar por qué prestas un dato, limitas las tareas activas o validas una entrada. Ese criterio sigue sirviendo al volver a **PHP** o **TypeScript**.

Para terminar la serie, elige una de las versiones del informe y dale una necesidad real: leer un archivo problemático, consultar tiendas con un plazo o procesar más datos con un presupuesto de memoria. Escribe qué esperas conseguir, añade casos de fallo y comprueba el resultado.

Después deja una nota breve con lo que elegirías para mantener ese programa y por qué. Incluye el coste de aprenderlo, probarlo y operarlo, además de cómo funciona. Tendrás una decisión basada en una experiencia concreta y un siguiente paso más claro que empezar otro tutorial solo para sumar un lenguaje a la lista.
