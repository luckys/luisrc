---
id: P030
title: 'Threat modeling de una API: convertir amenazas en decisiones y pruebas'
published: 2026-10-18T04:23:00Z
locale: es
translationKey: threat-model-api-multi-tenant-pruebas
slug: threat-model-api-multi-tenant-pruebas
draft: true
status: draft
level: intermedio
prerequisites: [P022, P026, P028, P029]
description: 'Construye un threat model pequeño para una API multi-tenant: activos, actores, fronteras, escenarios, controles y pruebas. Distingue evidencia de riesgos pendientes.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, api, threat-modeling, multi-tenant, testing]
---

Alice puede editar su documento, pero no publicarlo ni cambiarle el propietario. Si el endpoint acepta esas propiedades en el mismo JSON del título, comprobar que Alice es la propietaria no basta: hemos autorizado una operación pequeña y ejecutado otra más amplia.

Antes de añadir otro middleware, necesitamos describir qué queremos impedir y en qué punto puede ocurrir. Un **threat model** sirve para hacer explícitas esas decisiones y relacionarlas con pruebas. No es una lista de herramientas que el proyecto tiene instaladas.

Venimos de [separar CORS de autorización](/posts/cors-sop-preflight-no-autorizacion). Ahora cambiaremos la escala: seguiremos una petición por las fronteras del backend. Este artículo prepara el mapa; los siguientes profundizan por separado en mass assignment y SQL injection.

## El alcance empieza por una operación concreta

Nuestro sistema de ejemplo guarda documentos de dos organizaciones, North y South. Un miembro puede leer documentos de su tenant. Solo el propietario puede cambiar el título de uno que siga en estado draft. Publicar, transferir propiedad y mover documentos entre tenants no forman parte de esa operación.

Un **tenant** es el ámbito organizativo cuyos datos debemos separar. No equivale a una base de datos independiente: en el laboratorio ambos comparten una tabla. La clave incluye tenant e identificador, de modo que North y South pueden tener cada uno un documento d1.

Los **assets** son lo que tiene valor y queremos proteger. Aquí importan la confidencialidad de los títulos, la integridad del propietario y del estado, las notas internas y la disponibilidad del servicio. Decir «proteger la base de datos» no distingue qué daño nos preocupa.

Los **actors** incluyen personas legítimas y clientes hostiles. Alice pertenece a North; Bob, a South. También consideramos un cliente sin identidad y uno con credenciales válidas que modifica el JSON a mano. No presupongas que un usuario autenticado siempre utiliza tu interfaz.

El alcance inicial excluye pagos, subida de archivos y llamadas a proveedores. El [bloque posterior de SSRF](/posts/ssrf-destinos-permitidos-redirecciones) amplía explícitamente el modelo con una importación y nuevos destinos. No podemos dar por revisada una función solo porque el diseño anterior estuviera comprobado.

## Una trust boundary aparece cuando cambia lo que podemos creer

Una **trust boundary** es una frontera donde un dato o una acción pasa entre ámbitos con distinta confianza. No necesita coincidir con un microservicio.

El body procede del cliente. El subject reconocido por el adaptador de identidad tiene otra procedencia. Copiar un tenantId del body al contexto de autorización mezcla ambos niveles sin una justificación válida.

La siguiente frontera está entre el JSON y el comando que aceptamos ejecutar. Un objeto puede ser JSON válido y contener propiedades que esa persona no debe modificar. Otra aparece al construir SQL: un título debe ser un valor, no una parte de la gramática de la consulta.

<img src="/assets/visuals/api-contracts/P030.svg" alt="El cliente cruza cuatro fronteras: identificación mediante fixture, tenant verificado frente a ruta, JSON convertido en comando limitado y valores enlazados en SQL. Cada frontera se asocia a una amenaza y una prueba distinta." width="331" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/P030.svg).

No son cuatro implementaciones alternativas de seguridad. Una consulta parametrizada no identifica a Alice; una identidad válida no transforma cualquier campo del body en una operación autorizada.

## Describe una amenaza como una acción y su consecuencia

«Falta validación» es demasiado ambiguo para decidir qué hacer. «Alice envía state=published al editar el título y publica sin permiso» identifica actor, entrada, acción y daño.

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats/threat-model.json) guarda esos escenarios en `threat-model.json`. Cada registro incluye responsable del seguimiento, prioridad, control, prueba y riesgo residual. El responsable es el mantenimiento de esta demo; en un equipo tendría que corresponder a alguien capaz de actuar, no a una etiqueta decorativa.

Estos cuatro escenarios del bloque inicial tienen evidencia ejecutable:

1. **T01:** un cliente inventa o prolonga un token de fixture para obtener identidad. El lookup exacto lo rechaza. Esto solo prueba el adaptador ficticio.
2. **T02:** Alice intenta leer South o modificar un documento de Bob en North. Tenant y ownership atienden permisos diferentes.
3. **T03:** Alice altera owner o state de su propio documento mediante campos adicionales. Se necesita limitar las propiedades editables.
4. **T04:** una búsqueda convierte el texto recibido en una expresión SQL que alcanza datos de South. Hace falta separar sintaxis y valores, sin perder el filtro de tenant.

Cada escenario permite escribir una expectativa observable. Para T02 no basta con recibir 404: después consultamos el documento como Bob y verificamos que conserva su título.

## STRIDE ayuda a preguntar, no decide por nosotros

**STRIDE** agrupa preguntas sobre suplantación, manipulación, repudio, divulgación, denegación de servicio y elevación de privilegios. Podemos recorrer el diagrama y preguntarnos qué variante de cada problema tiene sentido en esa frontera.

Por ejemplo, T01 pregunta por suplantación; T03, por manipulación y privilegios; T04, por divulgación. Una misma amenaza puede encajar en más de una categoría. Clasificarla no demuestra que el control funcione.

El **OWASP API Security Top 10**, edición 2023, aporta otro vocabulario: permisos por objeto y propiedad, autenticación rota, consumo de recursos, permisos por función, abuso de flujos de negocio, SSRF, configuración, inventario y consumo inseguro de APIs. Es una guía para revisar riesgos, no una certificación automática ni el universo completo de vulnerabilidades.

SQL injection sigue importando aunque no tenga una categoría independiente en esa lista de diez. Elegimos amenazas por el sistema y sus datos, no por la necesidad de completar casillas de un ranking.

## Prioriza sin inventar una precisión que no tienes

En la demo asignamos P1 al acceso cruzado y a la modificación de propiedades protegidas: contradicen directamente las reglas que acabamos de definir. P2 identifica el trabajo pendiente de disponibilidad. Son prioridades editoriales del ejercicio, no probabilidades calculadas ni un orden universal.

En un servicio real preguntaría qué datos quedan expuestos, quién puede alcanzar la ruta, qué coste tiene explotar el problema y qué controles ya se han comprobado. Si no conocemos la exposición de un endpoint, esa incertidumbre necesita investigación; multiplicar dos números elegidos a ojo no la resuelve.

También hay alternativas al control en código. Podemos eliminar una función innecesaria, limitarla operativamente o aceptar un riesgo con responsable y revisión. Aceptar no significa marcarlo como corregido. Si una importación arbitraria no es un requisito, no construirla evita una superficie que de otro modo habría que defender.

## Del escenario al test: positivo, adversarial y estado posterior

Desde la carpeta extraída, con Node 24.19.0 o posterior:

```bash
pnpm test
```

No hay librerías de aplicación que instalar. Las trece pruebas del bloque inicial ejecutan HTTP y SQLite en memoria; el laboratorio compartido añade después las de SSRF. Cada prueba crea sus propios fixtures y los cierra al terminar. Las rutas vulnerables solo existen para comparar comportamientos locales: no publiques el servidor ni abras un túnel.

Los tests combinan caminos legítimos y hostiles. Un título permitido cambia; un token inventado devuelve 401; una ruta de otro tenant devuelve 404; una propiedad extra devuelve 422 sin escritura. La consulta vulnerable expone tres filas ficticias de dos tenants; la parametrizada trata la misma entrada como texto.

El control positivo es importante. Un servicio que devuelve error a todo puede pasar muchos tests negativos y no cumplir ninguna función útil. La lectura posterior, a su vez, detecta el fallo contrario: devolver un error después de haber modificado datos.

## Un riesgo pendiente debe seguir siendo visible

Al escribir este bloque inicial dejamos T05, T06 y T07 abiertos. Las [dos entregas de SSRF](/posts/ssrf-destinos-permitidos-redirecciones) añaden después evidencia de T05; [concurrencia](/posts/consumo-recursos-concurrencia-bulkheads) y [token bucket](/posts/rate-limiting-token-bucket-tenant), de T06. Las entregas de [credenciales de clientes](/posts/api-keys-credenciales-clientes-permisos) y [rotación de secretos](/posts/secretos-rotacion-recarga-revocacion) desarrollan T07. Se limitan a sus fixtures, sin certificar toda una infraestructura. El límite de body por sí solo no demuestra cuotas o resistencia a carga.

T01 tampoco certifica autenticación de personas. Los tokens demo-alice y demo-bob del modo inicial son públicos, estáticos y sin expiración. El adaptador de credenciales posterior sí verifica caducidad y revocación de clientes de servicio, pero no reemplaza OIDC o MFA para usuarios.

La próxima revisión del modelo debería ocurrir cuando cambie una frontera o un supuesto: otra vía de escritura, un proveedor externo, un rol nuevo o una caché compartida. También después de un incidente que contradiga nuestras expectativas. El archivo es útil mientras refleja lo que el sistema hace y lo que todavía no sabemos.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p030/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-threats
```

## Garantías y límites

El laboratorio demuestra casos concretos de aislamiento, mass assignment y SQL injection con datos ficticios. No audita una infraestructura desplegada ni integra el RP OIDC anterior. Usa SQLite síncrono en memoria y HTTP de loopback, sin TLS, persistencia, RLS o cuotas distribuidas.

Las variantes unsafe son deliberadamente vulnerables. La existencia del archivo P030 no certifica una plataforma desplegada: SSRF, consumo y ciclo de secretos se prueban en fixtures, sin secret manager, TLS o coordinación de réplicas. El modelo conserva esas diferencias en lugar de ocultarlas detrás de un build verde. El laboratorio pedido es local; desplegar infraestructura de producción sería otro alcance.

## Ejercicio: una amenaza que obligue a cambiar el contrato

Añade el requisito de publicar documentos. Escribe primero quién puede hacerlo, desde qué estado y qué debe conservarse. Define un escenario donde Alice intenta saltarse esa transición y otro donde la persona autorizada publica correctamente.

Decide después si necesitas un comando distinto del cambio de título. El [siguiente artículo sobre mass assignment](/posts/mass-assignment-comandos-propiedades-autorizadas) desarrolla por qué esa separación puede ser más clara que permitir cualquier propiedad del modelo.

## Referencias

- [OWASP: Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html).
- [Microsoft: categorías STRIDE](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats).
- [OWASP: API Security Top 10, edición 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/).

Fuentes consultadas el 19 de octubre de 2026. Los resultados descritos son del laboratorio local, no una evaluación de riesgo de un producto real.
