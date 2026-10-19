# Permisos sobre documentos: laboratorio local de P028

Tres entregas de la serie Diseño de APIs y seguridad web. **Solo loopback,
fixtures ficticias y memoria de un proceso**. No desplegar en Internet.

## Ejecutar sin instalaciones

Node 24.19.0 o posterior. No tiene dependencias externas.

```bash
pnpm test
pnpm serve
```

El servidor imprime una URL `http://127.0.0.1:PUERTO` elegida por el sistema.
Ctrl+C cierra solo ese servidor. Los tests también crean y cierran sus propios
servidores en puertos efímeros; no buscan servicios ajenos.

Sustituye PUERTO por el impreso. Estas credenciales son públicas de fixture,
no secretos que debas reutilizar:

```bash
curl -i http://127.0.0.1:PUERTO/tenants/north/documents/shared \
  -H 'Authorization: Bearer alice-demo'

curl -i -X PATCH http://127.0.0.1:PUERTO/tenants/north/documents/bob-draft \
  -H 'Authorization: Bearer alice-demo' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Intento ajeno"}'
```

La primera devuelve 200; la segunda 404 y no modifica el draft de Bob.
Para verlo usa `bob-demo` con GET. No hay endpoint de login, gestión de roles,
refresh, emisión de JWT, MFA, cookies, CORS ni integración con el OP de api-identidad.
El adaptador de autenticación de fixture se sustituiría por una identidad ya
verificada y resuelta a un ID interno (por ejemplo, desde issuer + sub).

## Política elegida, no reglas universales

| Sujeto       | North          | South          |
| ------------ | -------------- | -------------- |
| alice-demo   | editor         | reader         |
| bob-demo     | editor         | admin          |
| rita-demo    | reader         | sin membership |
| trent-demo   | admin          | sin membership |
| mallory-demo | sin membership | sin membership |

- Todos los roles conocidos leen documentos published **del tenant autorizado**.
- Propietario y admin local leen también sus drafts/archivados o, para admin, todos.
- Solo editor propietario o admin del tenant edita, y solo documentos draft.
- Reader no edita, ni siendo propietario. Admin no es un superusuario global.
- Desconocido, incompleto, acción nueva o documento fuera del tenant: denegado.
- PATCH acepta únicamente `{title: string}` recortado y no vacío, hasta 120
  unidades UTF-16. El body tiene un límite de 4096 bytes. No cambia owner, tenant,
  estado o roles. No implementa las operaciones de publicar o transferir propiedad.

`shared` existe en ambos tenants con contenidos distintos. Los IDs no son una
barrera de seguridad: los tests conocen los IDs ajenos y aun así deben fallar.

GET de lista filtra por tenant y por política **antes** del límite 1–20 y del total.
Sin cursor, orden de inserción estable del fixture, sin contrato de navegación
para datos mutables. No reutiliza el benchmark PostgreSQL de artículos anteriores.

Error 401 con challenge si no hay identidad. Error 404 con la misma estructura
para membership ausente, objeto inexistente o invisible. Error 403 al intentar
editar un objeto que ya se puede leer. Se evita esa distinción de existencia en
estos casos, no se demuestra indistinguibilidad temporal. Respuestas no-store.

## Archivos por artículo

| Artículo                      | Fuente principal         | Evidencia                                                                    |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| P028, RBAC/ABAC               | policy.mjs               | 5 tests de política, incluida matriz explícita                               |
| API-AUTHZ-TENANT, aislamiento | fixtures.mjs, server.mjs | claves compuestas, roles por tenant y filtros antes del límite               |
| API-AUTHZ-TESTS, BOLA         | tests/http.test.mjs      | 13 tests HTTP: casos positivos, lectura y escritura ajenas, estado posterior |

`setMembership` solo existe en la fixture del proceso de tests. No hay ruta HTTP
para que un usuario cambie roles. `inTenant` reduce accesos accidentales sin scope,
pero **no comprueba permisos por sí mismo**. El handler valida membership y llama
a `can` en el servidor. Los snapshots de lectura son copias, no referencias mutables.

## Modelo interactivo

`explorer.html`, `.css`, `.mjs` y `policy.mjs` forman un visor estático. El blog
distribuye esos cuatro archivos en `/assets/interactive/api-authorization/`.
Reutiliza la función probada, no simula una API ni permite probar seguridad del
servidor cambiando selects. No requiere cuentas ni envía información a terceros.

## Límites de la evidencia

Estado y permisos se consultan tras terminar de leer el body. Desde esa consulta
hasta escribir no hay await, por lo que este tramo no se intercala con otra tarea
JavaScript en el mismo proceso. **No es una transacción distribuida ni SQL**.
Con almacenamiento externo hay que mantener la condición en la escritura y
resolver concurrencia y cambios de membership deliberadamente.

Sin base de datos, RLS, cachés, colas, adjuntos, índices de búsqueda, exportaciones,
otras réplicas, auditoría persistente, cuotas o protección completa de DoS. Tampoco
se demuestra resistencia temporal, aislamiento de infraestructura o carga real.
Las reglas deben aplicarse también en esos canales si se añaden. No se mide
rendimiento ni se certifica toda la seguridad de una API por pasar 18 tests.

El desarrollo comenzó por los tests; fallaron al faltar los módulos. Una nueva
prueba de contexto incompleto detectó una aceptación indebida, corregida exigiendo
tenant y atributos conocidos antes de evaluar las reglas.
