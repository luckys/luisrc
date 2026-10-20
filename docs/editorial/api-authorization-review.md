# Autorización por objeto: revisión de P028

Tres drafts españoles como entregas 17–19 de Serie 03. Autor Luis Ramírez Calle.
No traducción, audio, publicación ni push. El commit `09fe2e5` guarda identidad;
esta ampliación es posterior y queda sin commit para la siguiente revisión.

## Por qué dividir P028 en tres entregas

1. **P028:** definir permisos con RBAC, ABAC, ownership y least privilege.
   Una política pura y una matriz permiten discutir la regla sin detalles de HTTP.
2. **API-AUTHZ-TENANT:** conservar el contexto verificado hasta acceder a datos.
   Membership por tenant, búsqueda scoped, listas, proyección y escritura limitada.
3. **API-AUTHZ-TESTS:** demostrar controles por HTTP y observar efectos posteriores.
   BOLA frente a función, controles positivos, IDs conocidos y variantes negativas.

Son partes de una ficha, no tres IDs del catálogo. El manifiesto tiene 19 partes
para nueve fichas P020–P028, sin renumerar contenido previo. Se preservan las URLs.

## Laboratorio ejecutado y desarrollo

`https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-authorization` no tiene dependencias externas. Node 24.19.0 y pnpm.
Servidor propio en loopback y puerto efímero, fixtures nuevas por test.

- Tests escritos antes de implementar módulos; fase roja por imports inexistentes.
- Cinco tests de política: rol/ownership, estado/tenant incluso para admin,
  lectura published restringida a miembros, casos desconocidos y matriz explícita
  de diez filas con expectativas de lectura/escritura independientes del código.
- Un caso adicional de contexto incompleto falló con true en lugar de false.
  Se corrigió exigiendo tenant, owner y estado conocido antes de evaluar reglas.
- Trece tests HTTP: identidad ausente/desconocida, control positivo, GET/PATCH ajenos,
  membership/headers, IDs fuera de tenant y repetidos entre tenants, listas/total,
  campos prohibidos, rebaja/revocación con mismo token, admin limitado, verbo
  no definido, error público y entradas inválidas/límite de bytes.
- Se verifica que los documentos ajenos conservan el título tras los rechazos.
  No se confunde un status negativo con una escritura que nunca ocurrió.
- Comprobación negativa en una copia temporal: adelantar rename antes del control
  write conserva el 403 pero provoca un fallo de título posterior en el test de
  admin/estados inmutables. Resultado observado: 17 pasan y uno falla. La copia
  se restauró y el laboratorio del repo nunca recibió ese defecto.
- ZIP con allowlist de once archivos, comparado byte a byte con fuentes. Sin
  secretos, claves, dependencias instaladas o credenciales de terceros.
- Cinco extractos de artículos contrastados contra fuentes del laboratorio.
- Tres diagramas D2 y visor estático que importa exactamente policy.mjs.
  El visor no autentica, no hace fetch y no concede permisos al cambiar selects.

## Límites que deben permanecer visibles

Autenticación **de fixture**, separada de api-identidad. Tokens públicos alice-demo,
bob-demo y demás no son sesiones ni JWT de producción. No se ha añadido integración
OIDC/refresh: el límite pendiente de P026 no se da por resuelto con este bloque.

Estado Map de un proceso, sin SQL, RLS, réplicas o caché. Lectura del body antes de
consultar permisos; tramo posterior síncrono, sin await entre decisión y escritura.
No se afirma transacción SQL o revocación inmediata en un sistema distribuido.

Admin es local y solo edita drafts. PATCH solo cambia title, no owner/tenant/estado.
Las reglas pertenecen al ejemplo, no describen cualquier producto. No hay publicar,
exportación, adjuntos, jobs, búsquedas externas, auditoría persistente o cuotas.

401 con challenge; 404 para objeto ausente/invisible o membership ausente, y 403
para una edición prohibida sobre un objeto ya legible. Mismo JSON no implica misma
latencia. No se demuestra aislamiento de infraestructura ni defensa completa DoS.

## Comprobaciones de entrega

- 65 tests de la suite raíz y 18 del laboratorio en verde. No se afirma que se
  hayan reejecutado todos los laboratorios anteriores; sus paquetes y extractos
  se siguen contrastando mediante las regresiones editoriales.
- Build correcto: 48 rutas Astro y 54 HTML contando visores. Pagefind mantiene
  ocho páginas publicadas y 4104 palabras, sin añadir los drafts al índice.
- Verificación explícita: los 19 drafts no tienen salida HTML/Markdown de post
  ni entrada en llms.txt; el ZIP copiado a dist coincide con el probado.
- Chromium a 1440 y 360 px: 38 vistas, noindex, imágenes decodificadas, enlaces
  locales existentes, sin overflow de página ni errores JS/KaTeX. Tablas de P028
  y tests enfocables con teclado, y controles del nuevo visor etiquetados.
  Cinco casos del visor de paginación y siete del de autorización en verde.
- Reporte final: `/tmp/api-contracts-layout.jMnac2/report.json`. El primer pase
  verde está en `/tmp/api-contracts-layout.9NV1T4/report.json`. La inspección visual
  de ese primer pase motivó reorganizar el diagrama multi-tenant en vertical;
  después se repitió toda la comprobación. Capturas móviles legibles, sin recorte
  interno del SVG; un diagrama alto requiere scroll y no cabe en un solo viewport.
- Chromium no estaba instalado en la ruta por defecto. Se preparó temporalmente
  con `PLAYWRIGHT_BROWSERS_PATH=/tmp/luisrc-blog-playwright pnpm --dir
https://github.com/luckys/luisrc-blog-examples/blob/main/packages/realtime-frontend exec playwright install chromium --only-shell`.
  La revisión se ejecuta con la misma variable y el script existente. No se han
  modificado dependencias del blog. El servidor Astro temporal se ha cerrado.
- Inventario: 48 IDs exactos, 36 fichas relacionadas y 91 sin artículo propio;
  completionProven sigue false. P029–P031 y el límite de P026 permanecen pendientes.

El resumen previo `autenticacion-autorizacion-tenant.md` se conserva y enlaza al
nuevo bloque. Estas entregas lo amplían con roles locales, estados, listas y
HTTP adversarial; no se renombra su ID para aparentar otra ficha terminada.

Las fuentes primarias enlazadas en los posts son NIST SP 800-162, OWASP API1:2023,
Authorization/Multi-Tenant Security Cheat Sheets, RFC 9110 y documentación Node.
