---
id: API-THREATS-SQL
title: 'SQL injection: separar valores y consultas sin perder el filtro de tenant'
published: 2026-10-18T04:25:00Z
locale: es
translationKey: sql-injection-parametros-tenant-ordenacion
slug: sql-injection-parametros-tenant-ordenacion
draft: true
status: draft
level: intermedio
prerequisites: [P030, API-THREATS-ASSIGNMENT]
description: 'Reproduce SQL injection en SQLite real y compara parámetros, filtros de tenant y allowlists de ordenación. Explica por qué un prepared statement todavía puede autorizar mal.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, sql, api, multi-tenant, testing]
---

Una búsqueda de documentos de North termina devolviendo un título de South. El servidor había reconocido a Alice y validado el tenant de la ruta. El aislamiento se perdió después, cuando el título recibido pasó a formar parte del texto de la consulta.

**SQL injection** ocurre cuando una entrada puede alterar las instrucciones que interpreta la base de datos. La defensa principal de este ejemplo no consiste en reconocer palabras peligrosas: consiste en que la consulta y sus valores lleguen por canales distintos.

Después de [limitar las propiedades de entrada](/posts/mass-assignment-comandos-propiedades-autorizadas), seguimos con el escenario T04 del threat model. El campo title está permitido; aun así, hay que utilizarlo correctamente.

## Qué ve SQLite cuando concatenamos el título

La variante vulnerable de `store.mjs` construye la consulta mediante interpolación. Aquí mostramos el método completo, que pertenece al objeto devuelto por createStore:

```javascript
    unsafeSearch(tenantId, title) {
      // Intencionadamente vulnerable: el input cambia la sintaxis del WHERE.
      return db
        .prepare(
          `SELECT id, title FROM documents WHERE tenant_id = '${tenantId}' AND title = '${title}' ORDER BY id`,
        )
        .all()
    },
```

El tenant proviene del contexto de fixture verificado, no del body. Pero title sigue procediendo del cliente. Haber comprobado un valor de la consulta no hace confiables los demás.

Para reproducirlo usamos esta cadena, exclusivamente sobre los datos ficticios del laboratorio:

```text
' OR 1=1 --
```

La primera comilla termina el literal donde debía ir el título. OR añade una alternativa verdadera. Los dos guiones convierten el resto de esa línea en comentario, incluida la comilla que el código iba a cerrar después.

SQLite recibe una condición equivalente a «coinciden tenant y título vacío, o se cumple 1=1». AND tiene mayor precedencia que OR. Como la segunda alternativa es verdadera, el filtro ya no limita el resultado a North.

No necesitamos múltiples sentencias, un DROP TABLE o un permiso de administrador para mostrar el daño. Una sola lectura mal construida puede divulgar datos. El test observa tres filas: dos de North y una de South.

El método se llama prepare, pero eso no lo hace seguro. En el momento de prepararlo ya hemos mezclado la entrada con el código SQL. **Prepared statement** y concatenación previa no forman una defensa por el nombre de la API.

## Un parámetro ocupa el lugar de un valor, no de código

En la variante segura, el texto SQL conserva dos placeholders `?`. Los valores se entregan después con all:

```javascript
    search(tenantId, title, sort) {
      if (!Object.hasOwn(columns, sort)) throw invalidInput()
      const column = columns[sort]
      return db
        .prepare(
          `SELECT id, title FROM documents WHERE tenant_id = ? AND title = ? ORDER BY ${column}, id`,
        )
        .all(tenantId, title)
    },
```

La función de createStore define db y el mapa columns antes de este método. Las claves del mapa son id y title; sus valores son esos mismos identificadores SQL fijos. Veremos enseguida por qué la ordenación usa otro mecanismo.

El driver enlaza tenantId y title como valores de la sentencia ya definida. La cadena con comillas, OR y guiones pasa a ser un título que buscar literalmente. No puede sustituir por sí misma el WHERE.

En el dataset inicial no hay un título así, y obtenemos una lista vacía. Otro test guarda esa misma cadena como título mediante el cambio permitido y después consigue encontrar exactamente ese documento. Este segundo caso es importante: no estamos demostrando que «no aparece nada sospechoso», sino que el valor conserva su significado de dato.

También buscamos O'Reilly. La comilla es parte legítima del nombre y no debería eliminarse para que el código funcione. El test obtiene la fila esperada con el mismo método parametrizado.

<img src="/assets/visuals/api-contracts/API-THREATS-SQL.svg" alt="Una búsqueda compara dos caminos hacia SQLite. Concatenar el título permite alterar el WHERE y devuelve filas de North y South. Enlazar parámetros mantiene fijo el filtro de tenant; la allowlist elige únicamente identificadores de ordenación definidos en el servidor." width="376" height="1076" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-THREATS-SQL.svg).

## Parametrizar no añade un permiso que has olvidado

Una consulta con `WHERE title = ?` separa correctamente sintaxis y valor. Sin embargo, si falta tenant_id, puede encontrar el documento de otra organización cuyo título coincida.

El laboratorio conserva searchWithoutTenant como contraejemplo directo, sin exponerlo como una ruta adicional. La prueba busca Privado South y obtiene esa fila aunque el valor esté parametrizado. Es una omisión de autorización, no una nueva forma de SQL injection.

Por eso la consulta segura incluye ambos parámetros: tenant del contexto reconocido y título del cliente. Parametrizar el tenant impide que cambie la gramática, pero no demuestra que esa persona pertenezca al tenant. Esa relación la establece otra parte del sistema.

En nuestra demo, Alice solo tiene North y la ruta debe coincidir. Un sistema con varias memberships necesitaría resolver y verificar el contexto activo, no copiar sin más la cabecera o el parámetro que el cliente elija.

## ORDER BY necesita una selección cerrada de sintaxis

Los parámetros SQL sirven para valores en posiciones que admiten valores. No podemos suponer que un parámetro se convertirá en nombre de columna, tabla o dirección de ordenación.

Si escribimos ORDER BY ? y enlazamos title, no estamos pidiendo al driver que sustituya el placeholder por el identificador title. En SQLite esa expresión es un valor, no la columna que queremos seleccionar.

Nuestra solución permite al cliente elegir entre dos nombres públicos. El mapa del servidor traduce cada uno a SQL fijo. Rechazamos cualquier clave que no exista antes de interpolar column. Object.hasOwn evita aceptar propiedades heredadas del objeto como si fueran opciones declaradas.

La interpolación restante es deliberada: proviene de una allowlist controlada por el código, no del texto arbitrario del cliente. Si necesitas dirección, añade otra selección cerrada entre ASC y DESC. No concatentes toda una expresión de ordenación recibida por URL.

El test envía una ordenación que contiene un punto y coma y una segunda instrucción. Recibe 422 y después seguimos leyendo las dos filas de North. No se ejecuta esa cadena ni se afirma que el driver admita múltiples sentencias en ese método.

## Validación, ORM y privilegios aportan defensas diferentes

El título tiene un límite de longitud. Esa regla evita entradas fuera del contrato, pero la sonda cabe dentro del límite. Rechazar cadenas largas no resuelve la separación entre código y datos.

Un ORM puede generar consultas parametrizadas y reducir errores repetitivos. Sus métodos raw, filtros construidos con texto o extensiones dinámicas siguen necesitando revisión. Lo importante es qué SQL y bindings produce la operación concreta, no si el proyecto tiene instalado un ORM.

Los permisos mínimos de base de datos pueden limitar consecuencias: un proceso de lectura no debería necesitar modificar el esquema. Pero un usuario SQL que pueda leer todos los tenants aún puede divulgar esos datos con una lectura vulnerable.

SQLite embebido no reproduce usuarios de un servidor SQL ni políticas RLS. Tampoco usamos escaping manual de comillas como defensa alternativa. Los detalles de escape dependen del motor y del contexto; aquí el driver ya ofrece bindings apropiados para los valores.

## Reproduce el resultado sin atacar servicios externos

Consulta el [laboratorio de amenazas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats/store.mjs) y, con Node 24.19.0 o posterior, ejecuta:

```bash
pnpm test
```

No requiere instalación. `tests/lab.test.mjs` identifica T04 en los tests de consulta vulnerable, binding literal, tenant y ordenación. Cada test abre SQLite real en memoria, no un mock que busca palabras como OR.

En el entorno verificado, Node 24.19.0 informa SQLite 3.53.3. No es un benchmark ni demuestra equivalencia entre SQLite y PostgreSQL. Los placeholders, tipos, collations y errores deben revisarse con el driver del motor que vayas a utilizar.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-threats-sql/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-threats
```

## Garantías y límites

Se demuestra una fuga local de lectura y su corrección en una búsqueda exacta. El servidor reconoce credenciales públicas de fixture y solo escucha en loopback. No publiques sus variantes inseguras.

No implementamos búsqueda parcial con LIKE. Parametrizar un patrón no elimina el significado de sus comodines: si quieres buscar los signos porcentaje o guion bajo literalmente, hay que diseñar ese contrato aparte. Tampoco probamos todos los sinks SQL futuros, procedimientos almacenados o permisos de infraestructura.

Los tests verdes prueban estas rutas y consultas. Una revisión de SQL injection real también necesita localizar otras construcciones dinámicas, incluidas tareas internas y procesos que no pasan por HTTP.

## Ejercicio: conservar datos y autorización al ampliar la búsqueda

Añade un filtro state con dos valores permitidos y mantén tenant obligatorio. Escribe casos para North, South, un estado desconocido y un título con comillas.

Después revisa dónde acabó cada entrada: los valores deben ir enlazados; cualquier fragmento de sintaxis elegido dinámicamente debe proceder de opciones cerradas. Usa el threat model para registrar nuevas fronteras, no solo para tachar T04.

La [siguiente entrega sobre SSRF](/posts/ssrf-destinos-permitidos-redirecciones) sigue otra entrada hasta una nueva frontera: la dirección de una petición saliente.

## Referencias

- [OWASP: SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).
- [SQLite: expresiones, parámetros y precedencia de operadores](https://www.sqlite.org/lang_expr.html).
- [Node.js: DatabaseSync y StatementSync en node:sqlite](https://nodejs.org/api/sqlite.html).

Fuentes consultadas el 19 de octubre de 2026. El código y los resultados corresponden a la versión local indicada, no necesariamente a la versión más reciente de la documentación.
