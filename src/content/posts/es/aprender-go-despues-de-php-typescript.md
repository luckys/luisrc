---
title: 'Aprender Go después de PHP y TypeScript: concurrencia sin confundirla con paralelismo'
published: 2026-10-07
locale: es
translationKey: aprender-go-despues-de-php-typescript
slug: aprender-go-despues-de-php-typescript
draft: false
description: 'Qué aporta Go a quien trabaja con PHP y TypeScript: tipos, errores y goroutines, con ejemplos comparables y sus límites.'
author: 'Luis Ramírez Calle'
series: 'Aprender otros lenguajes desde PHP y TypeScript'
tags: ['ingenieria-de-software', 'aprendizaje', 'php', 'typescript', 'go', 'concurrencia']
---

Un informe que consulta tres servicios no tiene por qué esperar a que termine uno para empezar con el siguiente. Puedes solapar esas consultas con **TypeScript** y también con **Go**. Entonces, ¿qué cambia al aprender **Go** si ya sabes trabajar con código asíncrono?

La diferencia no está en descubrir que varias tareas pueden avanzar a la vez. Está en aprender otro modelo para organizarlas, comunicar sus resultados y controlar cuándo deben terminar. Ese modelo resulta interesante para desarrollar servicios, herramientas de **infraestructura** y programas que combinan muchas operaciones independientes.

En la [primera entrega, sobre Python](/posts/aprender-python-despues-de-php-typescript), usamos un informe de ventas para comparar formas de transformar datos. Retomamos ese pequeño proyecto: primero calcularemos los mismos totales y después imaginaremos que las ventas proceden de distintas tiendas.

## Cuándo tiene sentido aprender Go

**Go** es un lenguaje compilado y de **tipado estático**. Su entorno incluye herramientas para formatear, probar, construir programas y una **biblioteca estándar** con soporte para tareas como trabajar con **HTTP** o interpretar **JSON**.

Sus [casos de uso oficiales](https://go.dev/solutions/) incluyen servicios en la nube, herramientas de línea de comandos y desarrollo web. Si te interesa acercarte al **backend**, a la **infraestructura** o a herramientas utilizadas por otros desarrolladores, merece la pena explorar esa dirección. Son tipos de trabajo, no sectores exclusivos de un lenguaje: una empresa financiera y una plataforma de comercio pueden necesitar servicios similares.

Eso no convierte **Go** en un reemplazo necesario de **PHP** o **TypeScript**. Si una aplicación funciona bien con **Laravel**, o necesitas compartir conocimientos y herramientas entre un frontend y un backend con **Node.js**, cambiar de lenguaje tiene un coste que debes justificar.

También puedes aprenderlo sin plantearte una migración. Construir una herramienta pequeña en **Go** permite revisar cómo organizas los tipos, cómo tratas los errores y qué das por supuesto cuando varias tareas comparten datos.

## De TypeScript a Go: los mismos datos, otras convenciones

Volvemos a las tres ventas del artículo de **Python**. Los datos ya están validados, los importes son céntimos enteros y todas las ventas usan la misma moneda. Queremos sumar únicamente las pagadas.

En **TypeScript**, el ejemplo completo sería:

```typescript
type Sale = {
  category: string
  amountCents: number
  paid: boolean
}

const sales: Sale[] = [
  { category: 'books', amountCents: 2500, paid: true },
  { category: 'courses', amountCents: 5000, paid: false },
  { category: 'books', amountCents: 1800, paid: true },
]

const totals = new Map<string, number>()

for (const sale of sales) {
  if (!sale.paid) continue
  const previous = totals.get(sale.category) ?? 0
  totals.set(sale.category, previous + sale.amountCents)
}

console.log(Object.fromEntries(totals)) // { books: 4300 }
```

En **Go**, podemos usar una estructura, un **slice** para las ventas y un mapa para acumular los importes. Guarda este programa como `report.go` y ejecútalo con `go run report.go`, después de [instalar Go](https://go.dev/doc/install):

```go
package main

import "fmt"

type Sale struct {
	Category    string
	AmountCents int64
	Paid        bool
}

func main() {
	sales := []Sale{
		{Category: "books", AmountCents: 2500, Paid: true},
		{Category: "courses", AmountCents: 5000, Paid: false},
		{Category: "books", AmountCents: 1800, Paid: true},
	}

	totals := make(map[string]int64)
	for _, sale := range sales {
		if !sale.Paid {
			continue
		}
		totals[sale.Category] += sale.AmountCents
	}

	fmt.Println(totals["books"]) // 4300
}
```

Un **slice** es una vista de una secuencia de elementos de un array subyacente, con una longitud y una capacidad. Aquí nos sirve como colección de ventas. No necesitamos dominar todavía cómo crece ni cómo comparte memoria, pero será importante aprenderlo antes de asumir que copiar un **slice** copia todos sus elementos.

`:=` declara una variable e infiere su tipo. No vuelve dinámico el programa: `totals` sigue siendo un mapa de cadenas a enteros de 64 bits. Al consultar una clave ausente, ese mapa devuelve el valor cero del tipo, `0`, por lo que podemos sumar sin escribir el equivalente a `?? 0`.

Hemos elegido `int64` para expresar que trabajamos con importes enteros, no con decimales. Tampoco es una solución monetaria completa: hay un límite de representación, y un informe real debería comprobar que las sumas no lo superan. En **TypeScript**, habría que considerar también el rango de enteros seguros de `number`.

La diferencia más interesante no es la cantidad de líneas. **Go** usa estructuras y métodos, pero no ofrece **herencia de clases**. Para reutilizar comportamiento se recurre a funciones, **composición** e **interfaces**.

Las **interfaces** se satisfacen al disponer de los métodos necesarios, sin una declaración `implements` como en **PHP**. Esto invita a definir dependencias por lo que necesitan hacer, aunque también puedes diseñar **interfaces** pequeñas en tus lenguajes actuales. La [FAQ de Go](https://go.dev/doc/faq) explica este sistema de tipos basado en **composición**.

## Concurrencia no significa ejecutar todo en paralelo

**Concurrencia** significa organizar tareas que pueden progresar durante periodos solapados. Una puede esperar una respuesta de red mientras otra empieza su trabajo. **Paralelismo** significa ejecutar trabajo simultáneamente, por ejemplo en distintos núcleos de **CPU**.

Piensa en nuestro informe. Si consultas una tienda, esperas su respuesta y después consultas la siguiente, estás trabajando de forma secuencial. Si inicias las tres consultas antes de esperar sus resultados, sus esperas pueden solaparse. No necesitas tres núcleos para aprovechar esa espera.

En **Node.js**, `async` y `await` permiten expresar operaciones asíncronas, y `Promise.all` permite esperar varios resultados. Pero declarar una función `async` no mueve sus cálculos a otro hilo. Una transformación costosa ejecutada en el hilo del **event loop** puede bloquear la atención de otras tareas. La [guía de Node.js sobre el event loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) explica este problema.

En **Go**, una **goroutine** es una tarea cuya ejecución gestiona el **runtime** del lenguaje. Se inicia con `go`, y el **runtime** distribuye **goroutines** entre hilos del sistema operativo. No hay un hilo dedicado por cada **goroutine**. Dependiendo de los recursos y de la configuración, varias pueden ejecutar trabajo en paralelo; no existe una garantía de que cada tarea tenga su propio núcleo. La [guía Effective Go](https://go.dev/doc/effective_go#goroutines) explica este modelo.

Por eso, decir que «**Go** tiene **concurrencia** y **TypeScript** no» sería incorrecto. Lo que cambia es el modelo de ejecución y las herramientas para coordinarlo. Tampoco se puede deducir que un programa será más rápido solo porque use **goroutines**: hay que medir el trabajo concreto.

## Consultar varias tiendas con Promise.all

Ahora cada tienda devuelve un total pagado. Usaremos `2500`, `0` y `1800` céntimos, equivalentes a las ventas anteriores. La tienda con la venta no pagada devuelve cero.

Para poder ejecutar el ejemplo sin servicios externos, simularemos cada consulta con una espera de 50 milisegundos. Los datos están definidos en el programa: no estamos implementando una petición **HTTP**, una validación de respuestas ni una prueba de rendimiento.

Este ejemplo es independiente del anterior. Con **Node.js 24** puedes guardarlo como `stores.ts` y ejecutar `node stores.ts`. El soporte integrado elimina las anotaciones, pero no comprueba los tipos: ejecutar el archivo no sustituye al análisis con `tsc`, como explica la [documentación de TypeScript en Node.js](https://nodejs.org/docs/latest-v24.x/api/typescript.html).

```typescript
type Store = {
  name: string
  paidCents: number
}

const stores: Store[] = [
  { name: 'north', paidCents: 2500 },
  { name: 'central', paidCents: 0 },
  { name: 'south', paidCents: 1800 },
]

async function fetchPaidTotal(store: Store): Promise<number> {
  await new Promise<void>((resolve) => setTimeout(resolve, 50))
  return store.paidCents
}

async function main(): Promise<void> {
  const amounts = await Promise.all(stores.map(fetchPaidTotal))
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  console.log(total) // 4300
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
```

`map` llama a `fetchPaidTotal` para cada tienda, iniciando las tres esperas antes de que `Promise.all` aguarde sus resultados. Si hubiéramos escrito un `await` dentro de un bucle para cada consulta, las esperas serían secuenciales.

`Promise.all` rechaza su promesa si una de las operaciones falla, pero no cancela automáticamente las demás. Con peticiones reales tendrías que decidir si quieres detenerlas, por ejemplo utilizando **AbortController** con una API que admita su señal. Este ejemplo no incorpora **cancelación**; la siguiente versión sí la introduce para explicar cómo se expresa en **Go**.

## La misma consulta con goroutines y un canal

En **Go** podemos iniciar una **goroutine** por tienda y recoger sus resultados mediante un **canal**, una herramienta para enviar valores entre **goroutines**. Añadiremos un plazo de un segundo para que la operación no espere indefinidamente.

Guarda este programa independiente como `stores.go` y ejecútalo con `go run stores.go`:

```go
package main

import (
	"context"
	"fmt"
	"os"
	"time"
)

type Store struct {
	Name      string
	PaidCents int64
}

type Result struct {
	AmountCents int64
	Err         error
}

func fetchPaidTotal(ctx context.Context, store Store) (int64, error) {
	timer := time.NewTimer(50 * time.Millisecond)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	case <-timer.C:
		return store.PaidCents, nil
	}
}

func totalPaid(ctx context.Context, stores []Store) (int64, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Cada tarea envía una vez, incluso si dejamos de recoger resultados.
	results := make(chan Result, len(stores))
	for _, store := range stores {
		go func(store Store) {
			amount, err := fetchPaidTotal(ctx, store)
			results <- Result{AmountCents: amount, Err: err}
		}(store)
	}

	var total int64
	for range stores {
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case result := <-results:
			if result.Err != nil {
				return 0, result.Err
			}
			total += result.AmountCents
		}
	}
	return total, nil
}

func main() {
	stores := []Store{
		{Name: "north", PaidCents: 2500},
		{Name: "central", PaidCents: 0},
		{Name: "south", PaidCents: 1800},
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	total, err := totalPaid(ctx, stores)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(total) // 4300
}
```

Los resultados pasan por un único punto de recogida:

```text
goroutine: tienda north   ─┐
goroutine: tienda central ─┼─> canal results ─> totalPaid suma los importes
goroutine: tienda south   ─┘
```

Hay más código que en la versión con `Promise.all`, en parte porque hemos añadido un plazo y **cancelación**. No sería justo atribuir toda la diferencia de tamaño al lenguaje. Lo importante es entender las decisiones:

- Cada **goroutine** consulta una tienda y envía un resultado. No modifica directamente el total compartido.
- La **goroutine** que ejecuta `totalPaid` es la única que suma. Así evitamos que varias tareas escriban sobre el mismo acumulador sin sincronización.
- El canal tiene espacio para guardar un resultado por tienda. Si `totalPaid` termina por un error y deja de recoger resultados, las otras **goroutines** todavía pueden dejar los suyos en el canal y terminar. Así no se quedan esperando a que alguien los recoja.
- `context` comunica la **cancelación**, pero no detiene automáticamente el código que está ejecutando una **goroutine**. Es una señal que indica: «ya no necesitamos este trabajo». En nuestro ejemplo, `fetchPaidTotal` usa `select` para esperar a que termine el temporizador o llegue esa señal. Si detecta la cancelación, deja de esperar y devuelve un error; la **goroutine** envía ese resultado al canal y termina. Si la función no comprobara la señal, seguiría trabajando aunque hubiéramos llamado a `cancel()`.
- No cerramos el canal porque recogemos una cantidad conocida de resultados. Cerrar un canal no es obligatorio para liberar sus recursos; sirve para indicar que no habrá más envíos.

Al retornar por un error se descarta el total parcial y se cancela el contexto de las consultas. La función no espera a que terminen todas las **goroutines** antes de retornar; en esta simulación pueden terminar sin bloquearse porque la espera admite **cancelación** y el canal tiene espacio. Si un recurso exigiera esperar al cierre de todas las tareas, habría que coordinar también esa finalización.

En una consulta **HTTP** real pasarías el contexto a la petición, por ejemplo con `http.NewRequestWithContext`, y gestionarías la respuesta y su cierre. Un contexto no arregla una función que ignora la **cancelación**. La [documentación de context](https://pkg.go.dev/context) desarrolla este contrato.

## Lo que las goroutines no resuelven por ti

Crear una **goroutine** por tienda sirve para este ejemplo de tres elementos. Hacerlo para cien mil tiendas puede saturar conexiones, consumir memoria o superar los límites del proveedor. Una **goroutine** tiene un coste, aunque no equivalga a un hilo dedicado.

Cuando el volumen crezca, necesitarás limitar el trabajo activo, por ejemplo con un número fijo de trabajadores que procesen tareas. En **TypeScript**, lanzar miles de peticiones con `Promise.all` plantea un problema parecido: hay que controlar la **concurrencia**, no solo saber iniciarla.

También hay que decidir qué significa un fallo. Nuestro informe exige que todas las tiendas respondan; por eso no devuelve un total parcial. Otro producto podría mostrar resultados incompletos y señalar qué tiendas faltan. Esa es una decisión del negocio, no una propiedad de **Go**.

Si varias **goroutines** comparten y modifican un mapa o una variable, debes coordinar ese acceso con **canales**, un **mutex** u otra herramienta adecuada. El [artículo oficial sobre pipelines y cancelación](https://go.dev/blog/pipelines) muestra cómo un envío bloqueado puede dejar tareas sin terminar. Aprender **Go** incluye aprender a reconocer estos problemas, no solo añadir `go` delante de una llamada.

## Cuándo Go puede aportar más rendimiento que TypeScript o PHP

La asociación entre **Go** y un buen rendimiento tiene una base técnica, pero mezcla varias ventajas distintas: ejecución de código compilado, tareas ligeras y posibilidad de aprovechar varios núcleos. Usar **goroutines** no mejora por sí solo las tres cosas.

Además, cuando hablamos del rendimiento de **TypeScript**, estamos comparando programas ejecutados en un entorno concreto. **Node.js** utiliza **V8** y **Bun** utiliza **JavaScriptCore**. El mismo código puede comportarse de forma diferente según el motor, las bibliotecas y las APIs utilizadas. Lo explican las documentaciones de [Node.js](https://nodejs.org/learn/getting-started/the-v8-javascript-engine) y [Bun](https://bun.sh/docs/runtime).

Escribimos el programa en **TypeScript**, pero sus tipos se eliminan y el código se ejecuta como **JavaScript**. Por eso hablaremos de **TypeScript** al referirnos al código que escribimos y de **JavaScript** al describir los motores que lo ejecutan. La [documentación de Node.js sobre TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping) explica esa eliminación de tipos.

### Cuando el trabajo consiste en calcular, no en esperar

Imagina que nuestro informe ya no suma tres importes, sino que aplica reglas de cálculo a millones de ventas independientes. Si ejecutas esas reglas en un bucle dentro del hilo principal de **Node.js**, ese hilo estará ocupado calculando y no podrá atender otras tareas del **event loop** hasta que termine. Envolver el bucle en una función `async` no cambia eso.

En **Go**, puedes dividir las ventas en lotes y procesarlos con un número limitado de **goroutines**. Si hay varios núcleos disponibles, el **runtime** puede ejecutar esos lotes en paralelo. Frente a una versión que hace todos los cálculos en un único hilo, existe una oportunidad concreta de terminar antes. La mejora dependerá de cuánto trabajo sea independiente y de cuánto cueste repartirlo y combinar sus resultados. La [FAQ de Go sobre paralelismo](https://go.dev/doc/faq#parallel) explica también por qué añadir tareas puede llegar a ralentizar un programa.

Eso no significa que **Node.js** o **Bun** no puedan hacerlo. **Node.js** dispone de [**worker threads**](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html) y **Bun** ofrece [**Workers**](https://bun.sh/docs/runtime/workers), que ejecutan otra instancia de JavaScript en un hilo separado. Con ellos también puedes repartir cálculos entre núcleos. La documentación de Bun señala que su API de Workers todavía es experimental, especialmente la terminación de workers.

La ventaja de **Go** aquí es que las **goroutines** forman parte del modelo habitual del lenguaje y comparten el espacio de memoria del proceso. No tienes que crear una instancia de JavaScript por cada tarea. Eso puede facilitar un reparto con menor coste, pero compartir memoria exige sincronización. Los workers tampoco obligan siempre a copiar todos los datos: **Node.js**, por ejemplo, permite transferir buffers o compartirlos. Una comparación justa debe incluir esas alternativas.

### Cuando un servicio mezcla red y procesamiento

Volvamos a las tiendas. Mientras solo esperamos sus respuestas, el modelo asíncrono de **Node.js** ya permite aprovechar esas esperas. La situación cambia si cada respuesta exige después un cálculo costoso escrito en **TypeScript** que se ejecuta en el hilo principal: ese procesamiento puede retrasar también otras peticiones del servicio.

**Go** puede repartir ese trabajo entre núcleos dentro del mismo proceso mediante **goroutines**. Esto lo convierte en un candidato interesante para servicios que mezclan muchas conexiones con procesamiento independiente. No elimina la saturación: si todos los núcleos están ocupados, necesitas limitar el trabajo y gestionar la cola de tareas pendientes. En **Node.js** o **Bun**, separar esos cálculos en workers también permite evitar que bloqueen el hilo principal. La [guía de Node.js sobre bloqueos](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) desarrolla este problema.

### De dónde viene la comparación con PHP

En un despliegue habitual con **PHP-FPM**, distintos procesos atienden distintas peticiones. Por tanto, una aplicación **PHP** puede atender peticiones en paralelo y aprovechar varios núcleos. La [configuración de FPM](https://www.php.net/manual/en/install.fpm.configuration.php) define con `pm.max_children` el límite de peticiones simultáneas.

Si una petición hace una consulta bloqueante y queda esperando, mantiene ocupado uno de esos procesos. Un servicio **Go** puede organizar muchas esperas mediante tareas ligeras, sin necesitar un proceso completo por cada una. Cuando el límite está en los procesos disponibles y su consumo de memoria, ese cambio de modelo puede permitir atender más trabajo con los mismos recursos. Es una razón para evaluar **Go**, no una garantía sobre cualquier aplicación.

Tampoco todo **PHP** funciona como ese despliegue. Existen bibliotecas y extensiones para operaciones asíncronas y servidores de larga duración. El lenguaje incluye [**Fibers**](https://www.php.net/manual/en/language.fibers.php), que permiten suspender y reanudar funciones, aunque por sí solas no distribuyen cálculos entre núcleos. Comparar **Go** con **PHP-FPM** y extrapolar el resultado a cualquier entorno **PHP** sería engañoso.

### Una goroutine no hace más rápido el cálculo que contiene

**Go** compila el programa a código máquina antes de ejecutarlo. Esa característica es distinta de su soporte de **concurrencia**. Por su parte, los motores de JavaScript también pueden compilar y optimizar código durante la ejecución; no sería correcto resumir la comparación como «compilado frente a interpretado». Las documentaciones del [runtime de Go](https://go.dev/doc/faq#runtime) y de [V8](https://nodejs.org/learn/getting-started/the-v8-javascript-engine) explican estos modelos.

Una transformación puede resultar más rápida en **Go**, pero no podemos deducirlo solo por el lenguaje: importan el algoritmo, la representación de los datos, las asignaciones de memoria y las bibliotecas. Una operación resuelta por una biblioteca nativa desde **Node.js**, **Bun** o **PHP** tampoco equivale a ejecutar todo su trabajo en código de aplicación.

Antes de migrar nuestro informe, mediríamos cuánto tarda en responder, cuántos informes completa por segundo y cuánta **CPU** y memoria consume. Usaríamos los mismos datos, recursos y límites de concurrencia, comprobaríamos que los resultados son equivalentes y probaríamos con carga sostenida, no solo con una petición aislada. También miraríamos la **latencia p95**, el tiempo dentro del que se completa el 95 % de las peticiones, para no ocultar respuestas lentas detrás de una media aceptable.

Si el tiempo se va en una consulta mal diseñada o en esperar una API externa, cambiar a **Go** no corrige ese problema. Si se va en cálculos que podemos repartir, o en mantener demasiados procesos ocupados esperando, ya tenemos una hipótesis concreta que probar. Esa es una justificación más útil que «Go es más rápido porque tiene goroutines».

## Qué aporta Go a tu criterio como ingeniero

Una parte del aprendizaje está en tratar los errores como resultados explícitos. En `fetchPaidTotal`, `(int64, error)` indica que la función devuelve un importe y un posible error. El código que llama a `fetchPaidTotal` decide qué hacer con el error; no tiene que descubrir ese caso leyendo una excepción lanzada en otra capa. El [tutorial oficial de manejo de errores](https://go.dev/doc/tutorial/handle-errors) muestra este patrón.

Eso no impide ignorar errores ni garantiza un buen diseño. Puedes devolverlos sin contexto o repetir comprobaciones que no ayudan. La práctica útil consiste en decidir dónde recuperarte de un error, dónde añadir información y cuándo devolverlo para que el código que llamó a la función lo gestione. Es un criterio que también puedes aplicar al volver a **PHP** o **TypeScript**.

Otra parte está en aprender a gestionar tareas con una vida definida: quién las inicia, cuándo terminan, qué ocurre si falla una dependencia y quién modifica los datos compartidos. Las **goroutines** hacen visibles estas preguntas, pero las preguntas importan en cualquier sistema concurrente.

También tendrás que conocer módulos, pruebas, perfiles de rendimiento y herramientas como `gofmt`. Si buscas trabajar en **infraestructura**, añade redes, sistemas operativos y **observabilidad** a esa lista. Saber escribir una **goroutine** no equivale a saber operar un servicio en producción.

## Un siguiente paso para el informe de ventas

Empieza ejecutando los ejemplos y sustituye después la espera simulada por dos servicios **HTTP** locales. Mantén un límite de consultas simultáneas y define un plazo para la operación completa. No añadas reintentos hasta decidir qué errores son recuperables y qué solicitudes es seguro repetir.

Prueba la lista vacía, una tienda lenta, una respuesta inválida y la **cancelación**. Comprueba también que un fallo no deja consultas esperando indefinidamente. Puedes usar `go test -race` para buscar **carreras de datos** durante las pruebas, aunque no encontrarlas no demuestra que no existan. La [documentación del detector de carreras](https://go.dev/doc/articles/race_detector) explica sus límites.

Si disfrutas ese trabajo, tendrás una pista sobre si te interesa profundizar en servicios e **infraestructura**. Si lo que más te interesó fue explorar y comparar los datos, puedes continuar por el camino de **Python** de la primera entrega. No hace falta elegir uno de forma definitiva.

En la siguiente entrega hablaremos de **Rust**. Retomaremos los tipos y los errores, pero añadiremos una pregunta que **Go** resuelve en buena parte con su **recolector de basura**: quién es dueño de los datos y durante cuánto tiempo pueden utilizarse.
