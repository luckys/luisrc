---
title: 'Aprender Rust después de PHP y TypeScript: quién puede usar tus datos y durante cuánto tiempo'
published: 2026-10-07
locale: es
translationKey: aprender-rust-despues-de-php-typescript
slug: aprender-rust-despues-de-php-typescript
draft: true
description: 'Qué aporta Rust a quien trabaja con PHP y TypeScript: ownership, préstamos y errores explícitos, con ejemplos y decisiones explicadas.'
author: 'Luis Ramírez Calle'
series: 'Aprender otros lenguajes desde PHP y TypeScript'
tags: ['ingenieria-de-software', 'aprendizaje', 'php', 'typescript', 'rust']
---

Una función recibe las ventas, calcula un informe y termina. ¿Puede quedarse con esos datos? ¿Puede modificarlos mientras otra función los está leyendo? En **PHP** o **TypeScript**, muchas de estas decisiones quedan en las convenciones del proyecto. **Rust** convierte parte de ellas en reglas que comprueba el compilador.

Ese cambio puede resultar incómodo al principio: un programa que parece razonable no compila porque intenta usar un valor que ya ha entregado a otra función. Entender por qué ocurre es una de las razones más interesantes para aprender **Rust**, incluso si no tienes previsto usarlo en tu próximo trabajo.

En el [artículo de Python](/posts/aprender-python-despues-de-php-typescript) transformamos datos de ventas. En el [de Go](/posts/aprender-go-despues-de-php-typescript) añadimos consultas concurrentes y controlamos cuándo debían terminar. Ahora retomaremos ese informe para ver cómo **Rust** organiza el acceso a los datos y expresa los casos en los que una operación puede fallar.

## Cuándo merece la pena aprender Rust

**Rust** es un lenguaje compilado y de **tipado estático** que permite gestionar memoria sin necesitar un **recolector de basura**. Su propuesta combina control sobre los recursos con comprobaciones que evitan determinadas clases de errores de memoria en código seguro.

Sus [áreas de uso oficiales](https://rust-lang.org/what/) incluyen herramientas de línea de comandos, **WebAssembly**, servicios de red y sistemas embebidos. También puede resultar interesante para componentes que procesan muchos datos o deben ajustarse a límites de memoria concretos.

No son territorios exclusivos de **Rust**. La pregunta es qué restricciones tiene el proyecto y si su modelo ayuda a resolverlas. Una herramienta de procesamiento de archivos y una aplicación web de gestión pueden tener prioridades muy distintas, aunque ambas pertenezcan a la misma empresa.

Si trabajas con **PHP** y **TypeScript**, aprenderlo puede acercarte a programación de sistemas o al desarrollo de bibliotecas y herramientas. Pero escribir algunos programas no sustituye al conocimiento del área: también tendrás que aprender a medir, entender el sistema operativo y manejar las herramientas del equipo.

Para un servicio que pasa casi todo su tiempo esperando a la base de datos, cambiar a **Rust** puede añadir esfuerzo sin resolver el problema principal. Tampoco hace falta reescribir una aplicación para probarlo: una herramienta pequeña e independiente permite aprender con menos riesgos.

## El mismo informe en TypeScript y Rust

Seguimos con tres ventas ya validadas. Los importes están en céntimos enteros, todas usan la misma moneda y queremos sumar las pagadas. Esta vez calcularemos un total general, `4300`, en lugar de agruparlo por categoría.

En **TypeScript**, podemos separar el cálculo de los datos de ejemplo. Puedes guardar este programa como `report.ts` y ejecutarlo con `node report.ts` en **Node.js 24**. Esa ejecución elimina las anotaciones de tipos, pero no las comprueba; el análisis estático sigue siendo una tarea de `tsc`, como explica la [documentación de Node.js](https://nodejs.org/docs/latest-v24.x/api/typescript.html):

```typescript
type Sale = {
  category: string
  amountCents: number
  paid: boolean
}

function totalPaid(sales: readonly Sale[]): number {
  return sales
    .filter((sale) => sale.paid)
    .reduce((total, sale) => total + sale.amountCents, 0)
}

const sales: Sale[] = [
  { category: 'books', amountCents: 2500, paid: true },
  { category: 'courses', amountCents: 5000, paid: false },
  { category: 'books', amountCents: 1800, paid: true },
]

console.log(totalPaid(sales)) // 4300
console.log(sales.length) // 3
```

`readonly Sale[]` impide, durante la comprobación de tipos, que esta función modifique la estructura del array mediante operaciones como `push`. No hace inmutables los objetos que contiene ni congela los datos durante la ejecución. Los campos de `Sale` siguen siendo modificables. El [manual de TypeScript](https://www.typescriptlang.org/docs/handbook/2/objects.html#the-readonlyarray-type) describe este contrato de solo lectura.

En **Rust**, empezaremos con una función que también lee la colección sin quedarse con ella. Tras [instalar Rust](https://www.rust-lang.org/tools/install), guarda este programa como `report.rs` y ejecuta `rustc --edition=2024 report.rs -o report` y después `./report`:

```rust
struct Sale {
    category: String,
    amount_cents: u64,
    paid: bool,
}

fn total_paid(sales: &[Sale]) -> u64 {
    sales
        .iter()
        .filter(|sale| sale.paid)
        .map(|sale| sale.amount_cents)
        .sum()
}

fn main() {
    let sales = vec![
        Sale {
            category: String::from("books"),
            amount_cents: 2500,
            paid: true,
        },
        Sale {
            category: String::from("courses"),
            amount_cents: 5000,
            paid: false,
        },
        Sale {
            category: String::from("books"),
            amount_cents: 1800,
            paid: true,
        },
    ];

    println!("{}", total_paid(&sales)); // 4300
    println!("{}", sales.len()); // 3
    println!("{}", sales[0].category); // books
}
```

`struct` define los campos de cada venta, y `vec!` construye un **vector**, una colección que puede crecer. Usamos `String` para que cada venta posea el texto de su categoría. La categoría no interviene en la suma, pero la conservamos para mantener los datos de la serie.

`&[Sale]` significa que la función recibe una referencia compartida a una secuencia de ventas, un **slice**. Puede leerla sin necesitar un vector concreto ni hacerse responsable de liberar sus datos. `&sales` presta ese acceso; después de calcular el total, `main` puede seguir utilizando la colección.

`iter()` recorre referencias a las ventas. `filter` selecciona las pagadas y `map` obtiene sus importes. Estos **iteradores** trabajan de forma perezosa: no crean un vector intermedio por cada paso. `sum` consume el recorrido y produce el total. La [guía de iteradores de Rust](https://doc.rust-lang.org/book/ch13-02-iterators.html) explica esta diferencia.

Elegimos `u64`, un entero sin signo de 64 bits, porque este ejemplo solo admite importes no negativos. No modela devoluciones ni garantiza que una suma quepa en ese rango. Más adelante haremos explícito ese posible error. En la versión de **TypeScript**, también habría que controlar que los importes y el total no salgan del rango de enteros seguros de `number`.

### Por qué indicamos `--edition=2024`

Una **edición de Rust** establece qué conjunto de reglas del lenguaje utiliza el compilador. Permite introducir cambios, como nuevas palabras reservadas, sin obligar a modificar todos los proyectos anteriores: cada proyecto elige cuándo adoptar esas reglas.

La edición no es la **versión del compilador**. Un compilador reciente puede compilar código de distintas ediciones. **Rust 2024** es la edición estable más reciente y está disponible desde la versión **1.85.0**, como recoge la [guía oficial de ediciones](https://doc.rust-lang.org/edition-guide/rust-2024/index.html). El número `2024` identifica la edición, no el año en el que ejecutas el programa.

Si ejecutas `rustc report.rs` sin indicar una edición, el compilador utiliza **2015** por defecto, no la más reciente. Por eso escribimos `--edition=2024`: queremos que los ejemplos utilicen explícitamente las reglas de esa edición. Puedes comprobar ese valor predeterminado en la [documentación de rustc](https://doc.rust-lang.org/rustc/command-line-arguments.html#--edition).

Con **Cargo**, la edición se indica en la sección `[package]` de `Cargo.toml`:

```toml
[package]
name = "sales-report"
version = "0.1.0"
edition = "2024"
```

Después basta con ejecutar `cargo run` o `cargo test`; **Cargo** pasa la edición al compilador. Si el campo `edition` falta, se asume **2015**. En cambio, `cargo new` configura los proyectos nuevos con la edición estable más reciente. El [manual de Cargo](https://doc.rust-lang.org/cargo/reference/manifest.html#the-edition-field) explica ambos comportamientos.

## Ownership: pasar un valor puede significar entregarlo

**Ownership**, o propiedad, determina quién es responsable de un valor. Para tipos como `String`, asignarlo a otra variable o pasarlo por valor a una función normalmente transfiere esa responsabilidad. A esa transferencia se la llama **move**, o movimiento.

Este programa está escrito para provocar un error de compilación. Puedes guardarlo como `move_error.rs` y comprobarlo con `rustc --edition=2024 move_error.rs`:

```rust
fn print_category(category: String) {
    println!("{category}");
}

fn main() {
    let category = String::from("books");
    print_category(category);
    println!("{category}"); // Error: el valor ya se ha movido.
}
```

`print_category` recibe el `String` por valor. Tras la llamada, `main` ya no puede usarlo. No se ha duplicado el texto ni se ha dejado a las dos funciones como responsables independientes del mismo recurso. El [capítulo sobre ownership](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html) desarrolla este modelo.

Con enteros como `u64`, el comportamiento es distinto porque implementan **Copy**. Cuando pasas uno a una función, esta recibe una copia del número: no se transfiere la propiedad del valor original. Por eso puedes seguir usando la variable después de la llamada.

Este programa independiente muestra la diferencia:

```rust
fn print_amount(amount: u64) {
    println!("{amount}");
}

fn main() {
    let amount = 2500_u64;
    print_amount(amount);
    println!("{amount}"); // Sigue siendo válido: imprime 2500.
}
```

Aquí ambas llamadas pueden utilizar `amount`. En el ejemplo anterior con `String`, la primera llamada transfería su propiedad y la segunda ya no podía usarlo. No conviene memorizar la regla como «toda asignación invalida la variable anterior».

Cuando un valor propietario sale de su ámbito, normalmente se ejecuta su destructor. Para `String`, eso libera el almacenamiento del texto. No necesitas llamar manualmente a una función de liberación. La [referencia sobre destructores](https://doc.rust-lang.org/reference/destructors.html) describe esa limpieza y sus reglas.

La pregunta útil al diseñar una función pasa a ser: ¿necesita quedarse con el dato o solo consultarlo? En nuestro ejemplo, imprimir una categoría no necesita consumirla.

## Borrowing: consultar sin quedarse con los datos

Podemos corregir el ejemplo anterior mediante un **préstamo**, o **borrowing**:

```rust
fn print_category(category: &str) {
    println!("{category}");
}

fn main() {
    let category = String::from("books");
    print_category(&category);
    println!("{category}"); // books
}
```

`&str` es una referencia a texto, no un `String` nuevo. Permite aceptar tanto texto almacenado en un `String` como un literal. Aquí la función necesita leer, así que pedir la propiedad del texto sería una restricción innecesaria.

La regla básica de los préstamos permite varias referencias compartidas, `&T`, o una referencia exclusiva, `&mut T`, mientras ese acceso está en uso. Con una referencia exclusiva puedes modificar el valor, pero no mantener al mismo tiempo otros accesos incompatibles a él. El [capítulo sobre referencias y préstamos](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) muestra cómo lo comprueba el compilador.

Piensa en una función que recorre las ventas y otra que intenta añadir elementos al mismo vector. Añadirlos podría requerir mover su almacenamiento a otra zona de memoria. **Rust** impide combinar esos accesos cuando una referencia que sigue en uso podría quedar invalidada.

Estas restricciones son distintas del `readonly` de **TypeScript**. No solo describen lo que una función puede escribir: también relacionan su acceso con otros usos de los mismos datos. Existen tipos con reglas especiales para modificar datos desde referencias compartidas, pero no los necesitamos para este informe.

Los **lifetimes**, o tiempos de vida de las referencias, completan esa comprobación: una referencia no debe seguir utilizándose cuando el dato al que apunta ya no existe. Habitualmente el compilador los infiere. Cuando hacen falta anotaciones, estas describen relaciones entre referencias; no prolongan la vida de los datos. Puedes profundizar en el [capítulo sobre lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html).

Una reacción habitual ante un error de préstamos es añadir `clone()`. A veces necesitas una copia independiente y esa es una decisión correcta. Pero clonar un `String` o un vector tiene un coste: antes de hacerlo, conviene comprobar si la función solo necesitaba un préstamo.

## Result y Option: los casos alternativos forman parte del tipo

Hasta ahora hemos supuesto que la suma cabe en `u64`. Si ese supuesto falla, el resultado deja de ser fiable. En lugar de depender del comportamiento del desbordamiento según la configuración de compilación, podemos comprobar cada suma.

Sustituye `total_paid` en `report.rs` por esta versión y añade la definición de `ReportError` antes de ella:

```rust
#[derive(Debug, PartialEq)]
enum ReportError {
    TotalOverflow,
}

fn total_paid(sales: &[Sale]) -> Result<u64, ReportError> {
    let mut total = 0_u64;

    for sale in sales.iter().filter(|sale| sale.paid) {
        total = total
            .checked_add(sale.amount_cents)
            .ok_or(ReportError::TotalOverflow)?;
    }

    Ok(total)
}
```

Aquí preferimos un bucle al encadenamiento anterior para que se vea dónde puede fallar cada suma. `let mut` permite actualizar el acumulador; las variables son inmutables por defecto. `derive` genera implementaciones para representar el error al depurar y compararlo en las pruebas.

`checked_add` devuelve **Option**: `Some(total)` si la suma cabe y `None` si no cabe. La [documentación de checked_add](https://doc.rust-lang.org/std/primitive.u64.html#method.checked_add) especifica ese comportamiento.

`ok_or` convierte esa ausencia en un error concreto. El operador `?` obtiene el valor correcto o termina la función devolviendo el error. Por eso la firma ya no promete siempre un número: devuelve **Result**, con una variante `Ok` para el total y otra `Err` para el fallo.

En `main`, sustituye únicamente la línea que imprime `total_paid(&sales)` por este bloque. Las otras dos líneas pueden quedarse:

```rust
match total_paid(&sales) {
    Ok(total) => println!("{total}"),
    Err(error) => {
        eprintln!("No se pudo generar el informe: {error:?}");
        std::process::exit(1);
    }
}
```

`match` obliga a contemplar ambas variantes. Aquí hemos decidido que un informe que falla debe escribir en la salida de errores y terminar con un código distinto de cero. En un servicio web, la respuesta podría ser otra. La [guía de Result](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html) explica también el uso de `?`.

Podríamos llamar a `unwrap()` para extraer el total, pero provocaría un **panic** si hubiera un error. Para un fallo que hemos identificado y queremos comunicar, esa no es la política que buscamos.

**TypeScript** también permite representar éxito y error con **uniones discriminadas**, y **PHP** puede utilizar objetos de resultado o excepciones. **Rust** no inventa la idea de tratar los errores explícitamente; la integra en convenciones y herramientas del lenguaje.

Tampoco valida por nosotros los datos externos. Poder representar `u64` no demuestra que una venta pertenezca a la moneda correcta o que no esté duplicada. Esas reglas siguen formando parte del problema que estamos resolviendo.

## Probar el informe y sus límites con Rust

Después de cambiar la función, añade estas pruebas al final de `report.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn sale(amount_cents: u64, paid: bool) -> Sale {
        Sale {
            category: String::from("books"),
            amount_cents,
            paid,
        }
    }

    #[test]
    fn sums_only_paid_sales() {
        let sales = vec![sale(2500, true), sale(5000, false), sale(1800, true)];
        assert_eq!(total_paid(&sales), Ok(4300));
    }

    #[test]
    fn returns_zero_without_sales() {
        assert_eq!(total_paid(&[]), Ok(0));
    }

    #[test]
    fn reports_overflow() {
        let sales = vec![sale(u64::MAX, true), sale(1, true)];
        assert_eq!(total_paid(&sales), Err(ReportError::TotalOverflow));
    }
}
```

Puedes ejecutarlas con `rustc --edition=2024 --test report.rs -o report_tests` y después `./report_tests`. Comprobamos el cálculo habitual, la colección vacía y un límite que no aparece en los datos de ejemplo.

Para un proyecto que vaya a crecer, usaría **Cargo**, la herramienta de construcción y gestión de dependencias de **Rust**. `cargo new sales-report` crea el proyecto; puedes colocar el programa y sus pruebas en `src/main.rs`, ejecutar `cargo run` y comprobarlas con `cargo test`. La [introducción a Cargo](https://doc.rust-lang.org/book/ch01-03-hello-cargo.html) explica esa organización.

No necesitamos crear una jerarquía de clases para separar responsabilidades. El cálculo es una función independiente y `main` decide cómo presentar su resultado. Si más adelante hay distintos orígenes de ventas, podemos introducir una abstracción cuando exista esa necesidad, no antes.

## Qué cambia respecto a las goroutines de Go

En el artículo anterior iniciamos una **goroutine** por tienda. En **Rust**, `std::thread::spawn` crea un hilo del sistema operativo: no es el equivalente en coste ni en planificación de una **goroutine**. Crear un hilo por cada consulta no sería una traducción adecuada para miles de tiendas. La [guía de hilos de Rust](https://doc.rust-lang.org/book/ch16-01-threads.html) describe este modelo.

Las reglas de tipos también intervienen al compartir datos. **Send** expresa que un tipo puede transferirse entre hilos; **Sync**, que puede compartirse mediante referencias entre ellos. El compilador suele derivar estas propiedades a partir de los componentes del tipo. La [guía de Send y Sync](https://doc.rust-lang.org/book/ch16-04-extensible-concurrency-sync-and-send.html) explica estas comprobaciones.

Para muchas operaciones de red concurrentes se suele utilizar **async/await** con un entorno de ejecución como **Tokio**. Una **future** describe trabajo que puede avanzar cuando ese entorno la consulta; no arranca automáticamente una tarea solo por llamar a una función `async`. Es una diferencia importante frente a las promesas del ejemplo de **TypeScript**. El [capítulo sobre futures](https://doc.rust-lang.org/book/ch17-01-futures-and-syntax.html) introduce ese funcionamiento.

No vamos a añadir ese entorno a una suma que no lo necesita. Si convertimos el informe en un programa que consulta tiendas reales, tendremos que decidir límites de concurrencia, plazos y cancelación, como hicimos en **Go**. El modelo de memoria no decide esas políticas por nosotros.

## Seguridad de memoria no significa ausencia de errores

En código seguro, **Rust** evita errores como usar una referencia a memoria ya liberada y ayuda a impedir **data races**, accesos concurrentes incompatibles a la misma memoria. Esa garantía depende también de que las bibliotecas que encapsulan código `unsafe` respeten sus contratos. La [guía de unsafe Rust](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html) explica dónde parte de esa responsabilidad pasa del compilador a quien escribe el código.

El programa todavía puede calcular mal los impuestos, bloquearse esperando un recurso, consumir demasiada memoria o ejecutar dos veces una operación de negocio. **Rust** no elimina la necesidad de pruebas ni de revisar el diseño.

Tampoco podemos concluir que será más rápido que **Go**, **PHP** o **TypeScript** sin medir. No necesitar un recolector de basura y poder controlar las asignaciones son características relevantes para ciertos requisitos, no un resultado de rendimiento por sí mismas. Los algoritmos, las bibliotecas y las esperas externas siguen importando.

En este informe no hemos medido ninguna mejora. Si queremos comparar rendimiento, necesitaremos datos representativos, resultados equivalentes y condiciones de ejecución comparables. Una suma de tres ventas sirve para entender el código, no para elegir el lenguaje de un sistema.

## Qué te aporta Rust aunque sigas trabajando con PHP y TypeScript

La práctica con **Rust** puede ayudarte a hacer preguntas más precisas: ¿esta función necesita modificar los datos?, ¿quién se queda con el recurso?, ¿una copia es necesaria?, ¿cómo se representa que una operación no ha podido completarse?

Puedes trasladar esas preguntas a **PHP** o **TypeScript** sin intentar imitar toda la sintaxis de **Rust**. Por ejemplo, reducir mutaciones compartidas o representar un fallo esperado en el contrato de una función puede mejorar un diseño en cualquiera de esos lenguajes.

El esfuerzo adicional también cuenta. Aprender **ownership**, leer errores del compilador y conocer las bibliotecas llevará tiempo. Un proyecto puede beneficiarse de ese control y otro priorizar la velocidad de entrega con herramientas que el equipo ya domina. La decisión depende de los requisitos y de las personas que mantendrán el software.

Para continuar, convierte el informe en una herramienta que lea ventas de un archivo. Empieza por un formato pequeño y añade pruebas para registros incompletos, importes no válidos y sumas que desbordan. Mantén la lectura separada del cálculo para probar este último sin depender del disco.

Después prueba un cambio deliberado: haz que una función reciba `Vec<Sale>` en lugar de `&[Sale]` e intenta usar las ventas tras la llamada. Leer el error y decidir si la función debe consumir o pedir prestados los datos es un ejercicio más útil que resolverlo añadiendo `clone()` a ciegas. El [libro oficial de Rust](https://doc.rust-lang.org/book/) puede acompañarte en ese siguiente paso.
