---
id: API-AUTHZ-TESTS
title: 'Probar autorización por HTTP: detectar BOLA sin conformarse con un 403'
published: 2026-10-18T04:18:00Z
locale: es
translationKey: autorizacion-tests-adversariales-bola
slug: autorizacion-tests-adversariales-bola
draft: true
status: draft
level: intermedio
prerequisites: [P028, API-AUTHZ-TENANT]
description: 'Escribe pruebas adversariales de lectura y escritura: IDs ajenos, tenants, roles, listados y verificación del estado posterior, con un laboratorio HTTP local.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, seguridad, testing, autorizacion, bola, tdd]
---

Una petición devuelve 403 y el test pasa. Pero el servidor había actualizado el documento antes de responder. Comprobar únicamente el status habría dado por protegida una operación que ya hizo el daño.

Las pruebas de autorización necesitan observar dos cosas: la respuesta y los efectos. Para lectura, eso incluye qué datos se devuelven. Para escritura, también si el recurso ajeno continúa intacto después del intento.

Este artículo cierra el bloque de permisos con el mismo laboratorio de [políticas](/posts/autorizacion-rbac-abac-permisos-recursos) y [contexto multi-tenant](/posts/autorizacion-multi-tenant-contexto-datos). No vamos a explorar aplicaciones ajenas. Todas las identidades, documentos y peticiones pertenecen a un servidor de prueba que arranca en loopback y se cierra al terminar.

## BOLA no requiere adivinar un identificador complicado

**BOLA**, Broken Object Level Authorization, aparece cuando una operación sobre un objeto no comprueba correctamente si ese sujeto puede actuar sobre él. El usuario puede tener acceso legítimo al endpoint y, aun así, no al objeto cuyo ID ha elegido.

Por ejemplo, Alice puede editar su propio draft con PATCH. Reutilizar esa capacidad general para editar el draft de Bob sería un fallo a nivel de objeto. Acceder a una función administrativa que nunca debería poder utilizar sería otro problema, **Broken Function Level Authorization**, aunque ambos puedan coexistir.

[OWASP API1:2023](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) describe esta diferencia y señala que los identificadores pueden ser enteros, UUID o cadenas. Hacerlos difíciles de predecir reduce algunas posibilidades de enumeración, pero no autoriza al usuario que ya conoce uno.

Por eso los tests conocen los IDs ajenos desde el principio. No intentan demostrar que nadie podrá descubrirlos; comprueban que conocerlos no basta para leer o modificar su contenido. Un enlace compartido por error no debería convertirse automáticamente en un permiso de edición.

## Una fixture útil incluye diferencias que el código podría confundir

Usar un único usuario y un único documento permite probar el caso feliz, pero no las fronteras. La demo introduce dos tenants y varios roles, con diferencias deliberadas.

Alice es editor en North y reader en South. Bob es editor en North y admin en South. Rita solo es reader de North. Trent es admin únicamente de North. Mallory tiene una identidad reconocida y ninguna membership.

Hay un shared en cada tenant, con propietarios y títulos diferentes. También hay un draft de Bob en North, un documento published y otro archived. Así podemos separar confusión de tenant, ownership, rol y estado, en lugar de agruparlo todo bajo «acceso denegado».

Cada test crea sus propias fixtures. Un caso que renombra un documento o retira una membership no modifica los datos de otro. Compartir estado mutable haría que el resultado dependiera del orden de ejecución y complicaría localizar el fallo real.

## El primer caso debe demostrar que el servidor también permite

Una implementación que devuelve 404 a todo supera muchos tests negativos. No implementa una autorización correcta: simplemente ha dejado de prestar el servicio.

Por eso comprobamos primero que Alice lee y edita su draft. El test verifica 200, el nuevo título y una lectura posterior con ese título. También exige la forma de salida prevista: id, ownerId, state y title, sin internalNote.

Ese control positivo demuestra que las peticiones llegan a una operación funcional. No prueba por sí solo el aislamiento, pero evita atribuir a una política correcta lo que en realidad sería una ruta rota, un token siempre rechazado o un handler que nunca encuentra documentos.

Los casos negativos reutilizan el mismo cliente HTTP, que solo prepara headers y serializa JSON. El helper **no decide permisos**: envía la petición a un servidor Node real mediante fetch y recoge status, headers y cuerpo.

## Probar lectura y escritura ajenas, y después leer como propietario

Este es un test completo de `tests/http.test.mjs`:

```javascript
test('HTTP: cambiar ID no permite leer o modificar el draft de otra persona', async (t) => {
  const { request } = await setup(t)
  for (const method of ['GET', 'PATCH']) {
    const denied = await request('alice', '/tenants/north/documents/bob-draft', {
      method,
      ...(method === 'PATCH' ? { body: { title: 'Intrusión' } } : {}),
    })
    assert.equal(denied.status, 404)
    assert.deepEqual(denied.body, { error: 'not_found' })
  }
  const owner = await request('bob', '/tenants/north/documents/bob-draft')
  assert.equal(owner.status, 200)
  assert.equal(owner.body.title, 'Draft de Bob')
})
```

El 404 forma parte de la política de exposición de esta API. Un documento invisible y uno inexistente comparten respuesta pública. No estamos afirmando que 403 sea siempre incorrecto ni que igualar el JSON elimine diferencias de tiempo.

La última lectura es importante: Bob sí está autorizado, de modo que podemos observar el recurso sin acceder directamente al Map. Si el servidor hubiera escrito primero y denegado después, el título ya no coincidiría y el test fallaría.

Comprobamos también esa clase de defecto en una copia temporal del laboratorio: adelantamos la escritura justo antes de verificar el permiso de edición. El servidor conservó su 403 al intentar editar un documento published, pero el test de estado posterior falló: esperaba «Publicado en North» y encontró «No», el título del intento rechazado. Los otros 17 tests pasaron. La versión correcta no contiene esa modificación; esta comprobación demuestra que al menos ese test distingue ambos comportamientos, no que detecte cualquier defecto posible.

Para otro tenant repetimos GET y PATCH con un ID que solo existe en South, pero solicitado bajo North. Lo intenta Trent, admin de North. Después Bob confirma que el documento de South conserva su título. Ser admin local no debe saltarse esa frontera.

<img src="/assets/visuals/api-contracts/API-AUTHZ-TESTS.svg" alt="El test confirma primero una edición propia válida, intenta GET y PATCH sobre el draft ajeno y exige denegación. Finalmente entra como propietario y comprueba que el título no ha cambiado. El estado posterior complementa la respuesta HTTP." width="265" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-AUTHZ-TESTS.svg).

## Cambiar una dimensión cada vez hace que el fallo explique algo

La matriz siguiente resume casos del laboratorio. No es una lista de vulnerabilidades descubiertas en un producto real: son expectativas de una implementación educativa.

<div role="region" aria-label="Casos adversariales de autorización HTTP" tabindex="0" style="overflow-x:auto">

| Cambio respecto al acceso permitido         | Resultado esperado  | Qué comprueba                               |
| ------------------------------------------- | ------------------- | ------------------------------------------- |
| Quitar la credencial o inventarla           | 401                 | No aceptar identidad por headers auxiliares |
| Pedir el draft de Bob como Alice            | 404, título intacto | Ownership por objeto                        |
| Usar un ID de South bajo North              | 404, título intacto | Búsqueda acotada                            |
| Usar North admin dentro de South            | 404                 | Rol local, no global                        |
| Editar published como admin local           | 403                 | Restricción de estado                       |
| Añadir ownerId o tenantId al PATCH propio   | 400, título intacto | Mutación limitada                           |
| Retirar membership y repetir el mismo token | 404                 | Permiso consultado de nuevo                 |

</div>

Además enviamos `X-Role: admin` y `X-Tenant-Id: north` al solicitar South. Esos headers no alteran las memberships del servidor. Un test que cambiase a la vez token, tenant, ID y body podría fallar por una sola razón y dejar tres controles sin comprobar.

## Listados y verbos distintos también cruzan la frontera

Rita solo puede leer el documento published de North. El test pide límite uno y comprueba tanto ese ID como total uno. Si la API filtrase después de recortar la página, o contase documentos ocultos, el resultado sería incorrecto.

Se prueba también DELETE sobre un documento propio. Como la demo no implementa esa acción, responde 405 con Allow y conserva el recurso. No queremos que una ruta demasiado permisiva interprete cualquier método como lectura o deje una mutación sin la comprobación correspondiente.

Las entradas inválidas tienen sus propios casos: JSON malformado, tipo de contenido incorrecto, título vacío, propiedades desconocidas y cuerpo demasiado grande. No son pruebas equivalentes a BOLA. Ayudan a separar fallos de contrato de permisos y a demostrar que esos rechazos tampoco escriben.

No hay endpoint de exportación ni actualización masiva. Si se añaden, necesitarán casos propios. Haber probado PATCH de un documento no protege automáticamente un nuevo endpoint que reciba una lista de cien IDs.

## TDD sirve para concretar la regla, no para certificar seguridad

El desarrollo comenzó con los tests de política y HTTP antes de crear sus módulos. La primera ejecución falló porque faltaban esos módulos. Después se implementó el comportamiento mínimo y se añadieron casos más exigentes.

Uno detectó un permiso incorrecto con tenant ausente. La corrección no fue adaptar el resultado esperado, sino exigir un contexto completo y estados conocidos. Esa prueba se conserva para que una simplificación futura no vuelva a aceptar el mismo caso.

Los tests de política explican las combinaciones. Los HTTP comprueban que las rutas usan identidad, contexto, almacenamiento y política de la forma prevista. Ninguno sustituye la revisión del diseño ni detecta automáticamente todos los canales de entrada nuevos.

Conviene revisar la matriz cuando cambie una regla de producto. Si mañana un editor puede leer drafts compartidos, habrá que expresar qué relación permite esa lectura. Cambiar un assert de false a true sin explicar el nuevo contrato solo haría desaparecer una alerta.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-authz-tests/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-authorization
```

## Garantías y límites

El [código del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-authorization/tests/http.test.mjs) incluye fuentes, README y pruebas. Con Node 24.19.0 o posterior no necesita instalaciones:

```bash
pnpm test
```

Son **18 tests**: cinco de política y trece HTTP. Los servidores usan puertos efímeros en loopback y se cierran al acabar. Los tokens son fixtures públicas, no autenticación de producción; no se utilizan datos personales ni servicios externos.

No se prueban múltiples procesos, transacciones SQL, RLS, cachés, jobs, archivos adjuntos o aislamiento de infraestructura. Tampoco resistencia a diferencias temporales, fuzzing de protocolos o toda la seguridad del navegador. El siguiente bloque empieza por [XSS y representación de texto](/posts/xss-dom-texto-html-contextos) y continúa con CSP, CSRF y CORS: pasar estos casos no protege frente a esas amenazas distintas.

## Ejercicio: comprobar que una denegación llega antes del efecto

En una copia local del laboratorio, mueve temporalmente la actualización del título antes de la comprobación de escritura. El test existente para admin y estados inmutables debería detectar el defecto. Añade otro caso: un reader propietario que intenta editar su draft después de una rebaja de rol. Comprueba también el título mediante una lectura autorizada tras el rechazo.

Restaura el orden correcto y vuelve a ejecutar todos los casos. El objetivo no es producir otro status rojo: es demostrar que tu prueba distingue un rechazo sin efectos de una respuesta que llega cuando la modificación ya ocurrió.

## Referencias

- [OWASP API1:2023, Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/).
- [OWASP Authorization Cheat Sheet: pruebas y comprobaciones por petición](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [Node.js: test runner](https://nodejs.org/api/test.html).

Fuentes consultadas el 19 de octubre de 2026. La evidencia se limita a los casos descritos, no es una auditoría de una aplicación desplegada.
