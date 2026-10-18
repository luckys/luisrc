# Validación y errores de API, P022/P023

## Ruta editorial de cinco entregas

El mismo laboratorio acompaña estas partes, sin duplicar servidores:

| Parte                          | Archivos principales                | Comprobación                                   |
| ------------------------------ | ----------------------------------- | ---------------------------------------------- |
| Parsing, JSON Schema y negocio | reservation.schema.json, cases.json | tests/validation.test.mjs                      |
| Zod                            | validation.mjs, server.mjs          | tests/validation.test.mjs, tests/http.test.mjs |
| Pydantic, alternativa Python   | validation.py                       | tests/test_validation.py                       |
| Errores públicos               | problems.mjs, service.mjs           | tests/service.test.mjs, tests/http.test.mjs    |
| Logs y request IDs             | server.mjs                          | tests/http.test.mjs                            |

Pydantic no es un prerrequisito para seguir la ruta Node. El caso Python valida
entradas; no sirve otro endpoint HTTP. La división no cambia las garantías del código.

## Ejecutar

Datos ficticios. Node 24.19.0, pnpm 12.8.1, Zod 4.6.7 y Ajv 8.20.0 fijados en
package.json/pnpm-lock.yaml. No es un servidor de producción. Solo loopback.

```bash
pnpm install --frozen-lockfile
pnpm test
node server.mjs
```

Reemplaza PUERTO por el puerto efímero que imprime el servidor:

```bash
curl -i http://127.0.0.1:PUERTO/reservations -H 'Content-Type: application/json' --data '{"sku":"BOOK","quantity":2,"expectedVersion":1,"priority":"standard"}'
```

Repetir devuelve 409/version_conflict. Cambiar expectedVersion a 2 devuelve
409/out_of_stock porque solo queda una unidad. El primer éxito devuelve 200:
ejecuta un comando sobre inventario, no crea un recurso de reserva consultable.
Reiniciar restablece tres unidades y versión uno. Ctrl+C cierra el proceso.

## Archivos y pruebas

- reservation.schema.json: JSON Schema 2020-12. Se puede referenciar desde el schema
  de requestBody de OpenAPI 3.1.1. No hay un nuevo router generado desde OpenAPI.
- validation.mjs: Zod, rechazo de desconocidos, límites, refinement entre campos,
  DTO de salida y proyección de errores públicos. No se exportan mensajes de Zod.
- validation.py: mismo contrato de entrada en Pydantic. No sirve HTTP ni valida salida.
- cases.json: veinte documentos compartidos; no es prueba de equivalencia universal.
- service.mjs: stock y versión en Map. Comprobación y escritura síncronas sin await.
- problems.mjs: catálogo estable, traducción a Problem Details y causas inesperadas.
- server.mjs: UTF-8 fatal, JSON y límite 4096 bytes; X-Request-Id generado localmente;
  logs estructurados por allowlist. No persiste cuerpos, tokens o mensajes de excepción.
- tests/: HTTP local, dos peticiones simultáneas, servicio, tres validadores y Unicode.

La implementación de Pydantic usa Python 3.13.15 y Pydantic 2.13.5, ya presentes en
la imagen fijada en runtime.json. Desde este directorio, con esa imagen **ya local**:

```bash
docker run --rm --pull=never --network=none --read-only --user 1000:1000 --memory 512m --cpus 1 --tmpfs /tmp:rw,size=64m --mount "type=bind,src=$PWD,dst=/work,readonly" --workdir /work --entrypoint python quay.io/jupyter/scipy-notebook@sha256:2479174ae36ec84373f3c352cb6d5801382c0aa6642e739f04bea409f6cedae1 -B -m unittest discover -s tests -p 'test_*.py' -v
```

Si no está disponible, usa un entorno propio con las versiones indicadas. Este
proyecto no instala Python con pip/conda ni descarga imágenes automáticamente.
Dentro del repo del blog se puede ejecutar `node scripts/run-api-validation-python.mjs`.

## Decisiones y límites

note ausente es válido, null no. Pydantic tiene un default interno vacío y la salida
de comparación usa model_dump(exclude_unset=True) para no inventar ese campo.
No hay coerción de strings ni booleanos; 2.0 se admite como entero matemático en el
contrato JSON. El refinement se expresa con if/then en JSON Schema, superRefine en
Zod y model_validator en Pydantic. Las rutas/mensajes nativos de sus errores no coinciden.

Los 409 de stock y versión tienen códigos diferentes. 412 se reservaría para
precondiciones HTTP como If-Match: no lo implementamos ni publicamos ETags.
503 se prueba con un fallo de dependencia inyectado, no con un driver real.
Las URN de type e instance son identificadores de laboratorio, no páginas de ayuda.
No se devuelve un stack ni se publica el error original en logs. Eso reduce diagnóstico:
producción requiere telemetría adicional con control de acceso, redacción y retención.

Dos peticiones HTTP reales se serializan en el tramo síncrono de un solo proceso.
No demuestra transacciones o seguridad entre workers. SQL necesitaría actualización
condicional/transacción. No hay autenticación, persistencia, trazas distribuidas,
idempotency keys, TLS, rate limiting o protección completa contra slow clients.
Un error validando la salida puede ocurrir después de escribir: no implica rollback.
No reintentar automáticamente un POST porque reciba 500 o pierda su respuesta.
