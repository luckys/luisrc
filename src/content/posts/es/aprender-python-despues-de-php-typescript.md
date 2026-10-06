---
title: 'Aprender Python después de PHP y TypeScript: qué cambia y cuándo merece la pena'
published: 2026-10-06
locale: es
translationKey: aprender-python-despues-de-php-typescript
slug: aprender-python-despues-de-php-typescript
draft: true
description: 'Qué aporta Python a quien trabaja con PHP y TypeScript: diferencias, ejemplos de código y una entrada al análisis de datos y la automatización.'
author: 'Luis Ramírez Calle'
series: 'Aprender otros lenguajes desde PHP y TypeScript'
tags: ['ingenieria-de-software', 'aprendizaje', 'php', 'typescript', 'python']
---

Después de años trabajando con los mismos lenguajes, conoces sus herramientas, sus límites y las formas habituales de resolver problemas. Esa familiaridad facilita el trabajo diario, pero también puede despertar la curiosidad por otras maneras de construir software.

Para un ingeniero que trabaja con **PHP** y **TypeScript**, ¿cuándo tiene sentido aprender **Python**? ¿Qué puede aportar, más allá de una sintaxis diferente?

No hace falta abandonar lo que sabes para explorar otra dirección. Pero sí conviene distinguir entre aprender un lenguaje por curiosidad y prepararte para trabajar con él. Ambas razones son válidas; lo que cambia es la profundidad que necesitas y el tiempo que tendrás que dedicarle.

Esta es la primera entrega de una serie que continuará con **Go** y **Rust**. En cada artículo compararemos soluciones con **PHP** o **TypeScript** para entender qué cambia, por qué puede resultar útil y qué esfuerzo exige. Empezamos con **Python**, manteniendo como referencia un pequeño informe de ventas.

## Qué quieres aprender y qué tipo de trabajo te interesa

Antes de elegir otro lenguaje, conviene aclarar qué buscas: acceder a otro tipo de proyectos, explorar un sector diferente o aprender una forma de programar que cuestione tus hábitos.

Esa intención ayuda a elegir. No es lo mismo querer trabajar con datos que desarrollar herramientas de infraestructura o entender mejor cómo se gestiona la memoria.

Aprenderlo también puede servir para revisar tus propias costumbres. Por ejemplo, una solución basada en una jerarquía de clases puede tener sentido en un proyecto y resultar innecesaria en otro. Conocer las convenciones de otro lenguaje ayuda a distinguir qué decisiones responden al problema y cuáles has adoptado por costumbre.

Y no todo tiene que convertirse en un plan de carrera. La curiosidad es una razón suficiente. Terminar una herramienta pequeña y descubrir otra forma de organizar el código puede compensar el esfuerzo, aunque nunca cambies de trabajo.

## La experiencia con PHP y TypeScript no se pierde

Al cambiar de lenguaje tendrás que aprender sintaxis, herramientas y convenciones. No tendrás que volver a aprender desde cero qué es una transacción, cómo diseñar una **API** o por qué conviene probar un caso de error.

La experiencia resolviendo problemas, leyendo código ajeno y manteniendo sistemas sigue siendo valiosa. Lo que no se transfiere automáticamente es el conocimiento del nuevo entorno: sus bibliotecas, su forma de desplegar, sus límites y sus problemas habituales.

Tener experiencia no significa dominar de inmediato un lenguaje nuevo. Tendrás que aprender sus convenciones y cometerás errores, pero contarás con criterio para analizar problemas, valorar alternativas y entender las consecuencias de tus decisiones. Esa experiencia sigue siendo útil mientras aprendes.

No necesitas cambiar de lenguaje para seguir creciendo. Profundizar en bases de datos, seguridad o diseño de software dentro de tu entorno actual también puede ser un buen siguiente paso. Aprender **Python** merece la pena cuando aporta algo que te interesa, no como prueba de que has alcanzado cierto nivel.

Además, analizar datos, automatizar tareas o construir servicios no es exclusivo de **Python**. La diferencia está en las bibliotecas disponibles, las herramientas y las restricciones con las que trabajarás. Conviene comparar eso, no solo lo que permite escribir cada sintaxis.

## Python: ampliar el terreno hacia los datos y la automatización

**Python** puede ser una buena elección si quieres acercarte al análisis de datos, la computación científica o la automatización. También se utiliza para aplicaciones web y herramientas de desarrollo, como recoge la [Python Software Foundation](https://www.python.org/about/apps/). Para aprendizaje automático, bibliotecas como [scikit-learn](https://scikit-learn.org/stable/) ofrecen herramientas para entrenar y evaluar modelos.

Para alguien que viene de **PHP**, parte de la experiencia resultará familiar: puedes ejecutar código sin una fase de compilación explícita y trabajar con tipos dinámicos. Lo nuevo no tiene por qué estar en esa característica, sino en las bibliotecas y en la manera de abordar el trabajo.

Imagina que quieres investigar por qué dos informes de ventas no coinciden. Tendrás que leer archivos, comparar registros y decidir qué hacer con datos incompletos o formatos inconsistentes. Puedes hacerlo con **PHP** o **TypeScript**; el interés de probar **Python** está en aprender cómo resolverlo con su ecosistema de análisis de datos, que incluye herramientas como **pandas**.

Ese trabajo entrena una habilidad importante: comprobar si los datos sostienen una conclusión antes de construir una funcionalidad alrededor de ella.

## Filtrar y transformar datos: de TypeScript a Python

Supongamos que tenemos ventas ya validadas y queremos los importes de las que están pagadas. Usamos céntimos enteros y una sola moneda para no introducir cálculos monetarios con decimales. No estamos mostrando todavía cómo validar ni leer un archivo.

En **TypeScript**, podemos filtrar y transformar un array:

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

const paidAmounts = sales.filter((sale) => sale.paid).map((sale) => sale.amountCents)

console.log(paidAmounts) // [2500, 1800]
```

En **Python**, podemos expresar esa misma transformación con una **comprensión de listas** (_list comprehension_), una expresión que construye una nueva lista transformando o filtrando los elementos de otra colección:

```python
from typing import TypedDict


class Sale(TypedDict):
    category: str
    amount_cents: int
    paid: bool


sales: list[Sale] = [
    {"category": "books", "amount_cents": 2500, "paid": True},
    {"category": "courses", "amount_cents": 5000, "paid": False},
    {"category": "books", "amount_cents": 1800, "paid": True},
]

paid_amounts = [sale["amount_cents"] for sale in sales if sale["paid"]]

print(paid_amounts)  # [2500, 1800]
```

`TypedDict` describe para las herramientas de tipos las claves y los valores que esperamos en cada diccionario. No crea un objeto con validación automática. Las anotaciones están ahí para ayudar a leer y comprobar el código, como veremos en la siguiente sección.

La diferencia útil no es que una versión ocupe menos líneas. La comprensión combina el filtro y la transformación en una expresión habitual en **Python**, mientras que en **TypeScript** hemos encadenado dos operaciones. Ambas son legibles para quien conoce sus convenciones. Si la transformación crece, conviene extraer funciones o usar un bucle en lugar de meter todas las reglas en una sola expresión. El [tutorial de estructuras de datos de Python](https://docs.python.org/3/tutorial/datastructures.html) explica las comprensiones.

## Las anotaciones de tipos no validan una entrada externa

**Python** permite añadir anotaciones de tipos y utilizar herramientas de análisis estático, pero el intérprete no impone esas anotaciones durante la ejecución, como explica la [documentación de typing](https://docs.python.org/3/library/typing.html).

Esto también ocurre en **TypeScript**: sus anotaciones se eliminan y no validan por sí solas los datos que llegan al programa. Lo explica el [manual de TypeScript](https://www.typescriptlang.org/docs/handbook/2/basic-types.html). En ambos casos hay que distinguir la comprobación estática de la validación de entradas externas.

Por ejemplo, imagina que recibes una edad en formato **JSON**. Esperas un número, pero el dato contiene el texto `"36"`. Simplificamos la entrada a un único valor para centrarnos en qué hace la anotación.

En **Python**, este código se ejecuta sin rechazar el dato:

```python
import json

age: int = json.loads('"36"')

print(age)                 # 36
print(type(age).__name__)  # str
```

Aunque hemos escrito `age: int`, la variable contiene una cadena. `json.loads` interpreta el **JSON**, pero no comprueba que el resultado coincida con nuestra anotación. Como su resultado está tipado como `Any`, un comprobador estático puede permitir esta asignación: no dispone de una garantía sobre el tipo del dato recibido.

En **TypeScript** ocurre algo equivalente:

```typescript
const age: number = JSON.parse('"36"')

console.log(age) // 36
console.log(typeof age) // string
```

`JSON.parse` también devuelve un valor tipado como `any`, por lo que esta asignación puede compilar incluso con el modo estricto activado. La anotación `number` no transforma la cadena en un número ni añade una comprobación al **JavaScript** que se ejecutará.

Para rechazar ese dato hay que comprobarlo durante la ejecución. En **Python** podemos hacerlo en una función que valide el valor antes de devolverlo:

```python
import json


def parse_age(value: object) -> int:
    if type(value) is not int:
        raise ValueError("La edad debe ser un número entero")
    return value


print(parse_age(json.loads('36')))    # 36
print(parse_age(json.loads('"36"')))  # Lanza ValueError
```

Aquí usamos `type(value) is int` para no aceptar un booleano como entero, algo que sí ocurriría con `isinstance(value, int)` en **Python**.

En **TypeScript**, `unknown` permite expresar que todavía no confiamos en el tipo del dato. La función lo comprueba antes de devolver un `number`:

```typescript
function parseAge(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error('La edad debe ser un número entero')
  }
  return value
}

console.log(parseAge(JSON.parse('36'))) // 36
console.log(parseAge(JSON.parse('"36"'))) // Lanza Error
```

La condición de **TypeScript** también comprueba que el entero esté dentro del rango que **JavaScript** representa con precisión. No hemos validado todavía si la edad tiene sentido para nuestra aplicación, por ejemplo, si puede ser negativa. Eso sería otra regla. Estos ejemplos solo muestran que describir el tipo esperado y comprobar el dato recibido son tareas distintas.

## Agrupar ventas: cuándo empieza a importar el ecosistema

Con las mismas ventas del primer ejemplo, queremos sumar el importe pagado por categoría. En **TypeScript** podemos recorrerlas y acumular los resultados en un `Map`. Este bloque continúa el ejemplo anterior y utiliza su variable `sales`:

```typescript
const totals = new Map<string, number>()

for (const sale of sales) {
  if (!sale.paid) continue
  const previous = totals.get(sale.category) ?? 0
  totals.set(sale.category, previous + sale.amountCents)
}

console.log(Object.fromEntries(totals)) // { books: 4300 }
```

En **Python**, también podemos hacerlo sin instalar ninguna biblioteca. Este bloque utiliza la lista `sales` del primer ejemplo en Python:

```python
totals: dict[str, int] = {}

for sale in sales:
    if not sale["paid"]:
        continue
    category = sale["category"]
    totals[category] = totals.get(category, 0) + sale["amount_cents"]

print(totals)  # {'books': 4300}
```

Para estos tres registros, ambas soluciones son suficientes. No hace falta añadir una dependencia para sumar dos importes.

Si el informe empieza a necesitar agrupaciones por varias columnas, cruces entre archivos o tratamiento de fechas, resulta interesante explorar **pandas**. Su estructura principal, el `DataFrame`, permite trabajar con datos organizados en filas y columnas. El siguiente ejemplo es independiente de los anteriores y requiere instalar la biblioteca.

Puedes hacerlo en un entorno virtual, que mantiene las dependencias del proyecto separadas de las de otros proyectos. En Linux o macOS:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install pandas
```

En Windows, el ejecutable equivalente es `.venv\Scripts\python.exe`. La [documentación de venv](https://docs.python.org/3/library/venv.html) explica las diferencias por plataforma. Guarda el siguiente código como `report.py` y ejecútalo con `.venv/bin/python report.py`:

```python
import pandas as pd

sales = pd.DataFrame([
    {"category": "books", "amount_cents": 2500, "paid": True},
    {"category": "courses", "amount_cents": 5000, "paid": False},
    {"category": "books", "amount_cents": 1800, "paid": True},
])

paid_sales = sales.loc[sales["paid"]]
totals = paid_sales.groupby("category")["amount_cents"].sum()

print(totals.to_dict())  # {'books': 4300}
```

Primero seleccionamos las filas pagadas. Después agrupamos por categoría y sumamos la columna de importes. Son operaciones de selección y agregación sobre una tabla, en lugar de un acumulador que actualizamos en cada iteración. El [tutorial de estadísticas de pandas](https://pandas.pydata.org/docs/getting_started/intro_tutorials/06_calculate_statistics.html) desarrolla este tipo de agrupaciones.

La ventaja está en disponer de esas operaciones y combinarlas con otras herramientas de análisis, no en que **Python** sea el único lenguaje capaz de hacerlo. Una consulta **SQL** o una biblioteca de **JavaScript** podrían ser opciones adecuadas según dónde estén los datos y qué utilice el equipo.

Tampoco hemos demostrado que una versión sea más rápida. Estos ejemplos comparan formas de expresar el trabajo, no rendimiento. En un informe real habría que validar las columnas, decidir cómo tratar los valores ausentes y controlar los límites de los tipos numéricos. Si los datos no caben en memoria, cargar todo en un `DataFrame` puede no ser una buena solución.

## Qué aporta Python y qué tendrás que aprender aparte

Al practicar con **Python** puedes ampliar tu repertorio con comprensiones, diccionarios y herramientas orientadas al trabajo con datos. Eso no exige renunciar a las clases ni significa que haya que resolverlo todo con funciones. Lo importante es aprender las convenciones del entorno y elegir una estructura que facilite entender el programa.

También tendrás que familiarizarte con los entornos virtuales, la gestión de dependencias y las herramientas de pruebas y análisis estático. Son tareas comparables a las que ya haces con **Composer** o las herramientas del ecosistema **TypeScript**, pero con otras convenciones.

Si buscas acercarte a datos o aprendizaje automático, el lenguaje será solo una parte del cambio. Según el puesto, necesitarás profundizar en **SQL**, estadística, calidad de datos o evaluación de modelos. Saber ejecutar una biblioteca no equivale a saber interpretar su resultado.

Si solo quieres seguir construyendo aplicaciones web similares a las que ya mantienes, conviene concretar qué esperas ganar: una biblioteca necesaria, colaborar con un equipo que use Python o aprender otro enfoque. Reescribir una aplicación que funciona solo para cambiar de lenguaje introduce trabajo y riesgos que también hay que valorar.

## Un primer proyecto para probar si este camino te interesa

Una herramienta de informes de ventas puede empezar leyendo un **CSV**, rechazando registros incompletos y calculando totales por categoría. Mantén una única moneda y documenta el formato de los importes. Escribe pruebas para el archivo vacío, un importe inválido y una venta no pagada, no solo para el ejemplo que produce el resultado esperado.

Después añade una necesidad concreta: comparar dos archivos o agrupar por mes. Esa ampliación te permitirá decidir si la biblioteca estándar sigue siendo suficiente o si **pandas** aporta algo que justifique la dependencia.

Si el objetivo es profesional, contrasta lo aprendido con ofertas de los puestos que te interesan. Identifica qué conocimientos se repiten y cuáles te faltan. No necesitas dejar de trabajar con **PHP** o **TypeScript** mientras exploras esa dirección.

La siguiente entrega se centrará en **Go**: compararemos tareas asíncronas en **TypeScript** con goroutines, distinguiendo la espera de operaciones de red del trabajo de CPU. Después llegará **Rust**, donde retomaremos los tipos y los errores para estudiar también la propiedad de los datos.
