---
id: API-VALIDATION-PYDANTIC
title: 'Validación con Pydantic: tipos estrictos, campos ausentes y reglas entre campos'
published: 2026-10-18T04:04:00Z
locale: es
translationKey: validacion-pydantic-strict-null-refinements
slug: validacion-pydantic-strict-null-refinements
draft: true
status: draft
level: intermedio
prerequisites: [P022]
description: 'Implementa el mismo contrato en Python con Pydantic estricto. Ausencia, null, defaults, enteros JSON y validadores probados.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, python, pydantic, validacion, testing]
---

Python permite escribir `quantity: int`, pero esa anotación no comprueba por sí sola un JSON externo. Tampoco basta con pedir «modo estricto» sin decidir cómo debe tratar el contrato los valores que representa cada lenguaje.

Esta es la ruta **Python** del [contrato de reserva](/posts/validacion-runtime-json-schema-zod-pydantic). Es una alternativa a la entrega de Zod: no tienes que aprender ambas herramientas para continuar con errores HTTP.

## Pydantic necesita decisiones equivalentes, no una traducción línea a línea

En **Python**, las anotaciones tampoco validan por sí solas los datos externos. **Pydantic** sí ejecuta comprobaciones al construir o validar un modelo. Archivo `validation.py`, extracto probado con **Pydantic 2.13.5**:

```python
class ReservationInput(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    sku: str
    quantity: int = Field(ge=1, le=100)
    expectedVersion: int = Field(ge=1, le=1_000_000)
    priority: Literal["standard", "express"]
    note: str = Field(default="", max_length=80)
```

El archivo completo incluye imports, validación del SKU y un `model_validator` para el límite express. `strict=True` evita conversiones generales como pasar de string a entero; `extra="forbid"` rechaza campos desconocidos.

Hay un detalle importante: JSON Schema considera entero un número sin parte fraccionaria, como `2.0`. Al cargar JSON en Python, ese literal puede convertirse en `float`, mientras que JavaScript no conserva esa distinción de representación. El modelo incluye un validador previo que convierte únicamente floats integrales a int. Los límites se comprueban después; no convierte strings ni booleanos.

También evita confundir opcional con nullable. `note` tiene un default interno vacío, pero `null` sigue siendo inválido. Para comparar con el comando original usamos `model_dump(exclude_unset=True)`, que no añade el campo omitido. No queremos que un detalle del modelo cambie silenciosamente el contrato de transporte.

Veinte documentos compartidos pasan por Ajv, Zod y Pydantic. Incluyen ausencia, `null`, booleanos, strings, fracciones, campos extra y la regla express. Otras pruebas cubren 80 y 81 emoji. Esto demuestra acuerdo en esos casos, no equivalencia universal entre bibliotecas o dialectos.

## La anotación describe; model_validate ejecuta las comprobaciones

La clase hereda de `BaseModel`. Sus campos y configuración no convierten cualquier función Python en una frontera validada: el código debe ejecutar `ReservationInput.model_validate` o construir el modelo por una vía que valide.

El laboratorio recibe un objeto cargado desde JSON y ejecuta `model_validate`. Si incumple el contrato, Pydantic produce un `ValidationError`. Nuestros tests lo capturan para distinguir un caso rechazado de uno válido; no publican su representación completa al usuario.

Esa distinción importa porque el error nativo puede incluir valores de entrada y detalles de la biblioteca. En un servidor Python real habría que proyectarlo al contrato público, igual que hacemos en Node. Esta entrega no implementa ese adaptador HTTP ni afirma que los mensajes de ambos backends coincidan.

<img src="/assets/visuals/api-contracts/API-VALIDATION-PYDANTIC.svg" alt="El objeto JSON pasa por validadores de campo, tipos estrictos y una regla de modelo; el resultado se serializa excluyendo defaults de campos no enviados." width="349" height="1013" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-VALIDATION-PYDANTIC.svg).

## Un validador de campo debe preservar lo que no pretende convertir

La conversión específica para los enteros JSON está en `validation.py`:

```python
    @field_validator("quantity", "expectedVersion", mode="before")
    @classmethod
    def json_integer(cls, value: object) -> object:
        # JSON Schema acepta 2.0 como integer; no convertimos strings ni bools.
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value
```

`mode="before"` permite tratar el valor antes de comprobar el tipo del campo. Si es un float integral, lo convierte a int; si no, lo devuelve para que la validación estricta decida. No intenta arreglar cualquier entrada para que pase.

Por ejemplo, 2,0 puede aceptarse como entero matemático. `"2"` sigue siendo string y falla. `true` se carga como booleano y también falla, aunque en Python bool tenga relación con int. Los límites ge/le se aplican después: convertir un float integral no permite superar el máximo.

El test no presupone que todas las vías de entrada a Pydantic tengan idénticas conversiones. Verifica esta vía concreta, JSON cargado a objeto y `model_validate`, con las versiones fijadas. Cambiar a otro modo de validación requiere volver a contrastar esos casos.

## Las reglas de modelo necesitan campos que ya se pueden interpretar

El límite express utiliza un validador posterior:

```python
    @model_validator(mode="after")
    def express_limit(self) -> Self:
        if self.priority == "express" and self.quantity > 5:
            raise ValueError("express_limit")
        return self
```

Aquí ya disponemos de una prioridad admitida y una cantidad que cumple su contrato individual. La regla decide si esa combinación es aceptable y devuelve el modelo cuando lo es. No consulta inventario ni reserva unidades.

Si varios campos fallan de forma independiente, Pydantic puede acumular esos errores. Eso no significa que una regla de modelo deba ejecutarse sobre campos ilegibles. El test exige errores para SKU, cantidad, versión y prioridad inválidos; otro documento prueba la combinación express.

Un fallo del modelo puede quedar ubicado en la raíz en lugar de `quantity`. No debemos prometer los mismos paths públicos que Zod solo porque ambos rechacen el documento. Hay que adaptar y probar esa proyección si publicamos los dos servidores.

## Un default interno no tiene por qué aparecer en el comando

`note` tiene un default vacío para que el modelo pueda construirse cuando falta la propiedad. El contrato no dice que el cliente haya enviado ese string. Al comparar el resultado usamos `model_dump(exclude_unset=True)`, que conserva la diferencia entre omisión y un string vacío explícito.

Esto resulta especialmente importante en comandos parciales. Si sustituyes «no lo envió» por «envió vacío», podrías borrar una información que debía conservarse. Nuestra reserva no implementa PATCH, pero el motivo para mantener esa distinción es el mismo.

`null` continúa siendo inválido porque el campo es str, no str o None. No deducimos nullable del hecho de que exista un default. También comprobamos longitudes de 80 y 81 emoji para contrastar el límite con JSON Schema.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-validation-pydantic/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-validation-errors
```

## Garantías y límites

El [laboratorio compartido](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-validation-errors/validation.py) incluye `validation.py`, veinte casos y cuatro tests Python. El README explica la ejecución con Python 3.13.15 y Pydantic 2.13.5 ya presentes en la imagen local fijada; no instala paquetes Python ni descarga imágenes implícitamente.

Desde la raíz del monorepo de ejemplos, la comprobación aislada es:

```bash
node scripts/run-api-validation-python.mjs
```

Ese script está en `scripts/`, en la raíz del monorepo, no dentro del paquete. El README del laboratorio también incluye el comando Docker completo. La ejecución no tiene red y monta el ejemplo en lectura.

No hay endpoint HTTP Python, validación de salida Python ni comparación universal entre todos los valores posibles. Los documentos compartidos detectan divergencias concretas. La [siguiente entrega común](/posts/errores-api-problem-details-stock-concurrencia) retoma errores públicos y negocio.

## Ejercicio: probar antes de cambiar un default

Añade un campo opcional y compara tres entradas: ausente, vacío explícito y null. Escribe qué comando debe llegar al servicio en cada caso. Si cambias el tipo a nullable, actualiza también JSON Schema y comprueba si el cambio es realmente deseable para los consumidores existentes.

## Referencias

- [Pydantic: strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/).
- [Pydantic: field y model validators](https://docs.pydantic.dev/latest/concepts/validators/).
- [Pydantic: serialización y exclude_unset](https://docs.pydantic.dev/latest/concepts/serialization/).

Versiones fijadas para el laboratorio; fuentes consultadas el 18 de octubre de 2026.
