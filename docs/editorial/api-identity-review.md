# Identidad web: revisión de P026/P027

Cuatro drafts españoles, autor Luis Ramírez Calle, como entregas 13–16 de Serie 03.
No se publica, traduce, genera audio o hace push. El commit cdea5a0 guarda la
división anterior; esta ampliación es posterior a ese commit.

## Alcance editorial

| Ficha | Entregas                                                                     | Distinción principal                                                      |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| P026  | sesiones-web-cookies-identidad; access-refresh-tokens-rotacion-reutilizacion | sesión stateful/cookie frente a formato de token y política de renovación |
| P027  | oauth-oidc-authorization-code-pkce; oidc-validar-id-token-jwks-claims        | recorrido OAuth/OIDC frente a comprobaciones antes de crear sesión        |

Incluye token opaco, JWT, access/refresh, rotación, revocación, replay,
HttpOnly/Secure/SameSite, fixation, MFA y sus límites; roles OAuth, scopes,
PKCE/state/nonce, claims, fronteras y explicación de M2M. Los cuatro diagramas
D2 son secuencias del mecanismo, no mediciones ni benchmarks de autenticación.
Los cuatro extractos JavaScript proceden exactamente de las fuentes probadas.

## Laboratorio y evidencia

`examples/api-identidad`: Node 24.19.0, OpenSSL y dependencias propias instaladas
con pnpm. oidc-provider 9.12.2, openid-client 6.8.8, jose 6.2.12 y lockfile.

- TDD de código: tests escritos antes de módulos; fase roja por imports inexistentes.
  Después se implementan Sessions, RefreshFamilies, verificación y servidores.
- Seis tests de estado: secretos aleatorios/hash, fixation, TTL/reloj y logout;
  rotación, reutilización/revocación, dos tareas locales, access TTL/límite
  absoluto y aislamiento de familias. No hay espera temporal ni carrera SQL.
- Cuatro tests de protocolo con variantes: OP real en loopback, discovery,
  Authorization Code/PKCE, JWKS/firma; cookie RP HTTPS, logout/Origin y callback
  repetido; state/nonce/cookie ausente; verifier erróneo; firma/iss/aud/exp/iat/
  nonce/sub/azp adversariales. Los JWTs de fixture no sustituyen al flujo real.
- Chromium real: flujo completo, flags Secure/HttpOnly/Lax, cookie no visible
  en document.cookie, /me y logout que invalida una copia en otro contexto.
  Primera prueba detectó el password required del formulario de desarrollo;
  después detectó connect-src ausente en CSP. Corregidos y repetida en verde.
  Reporte: `/tmp/api-identity-browser.34lWyj/report.json`.
- ZIP por allowlist, byte a byte respecto a fuentes. Sin node_modules,
  certificados, claves privadas persistentes o variables de entorno.

## Garantías que no se deben atribuir

La sesión RP y el modelo RefreshFamilies **son ejercicios complementarios**.
El RP no pide offline_access, no conserva el access del OP ni renueva con él.
Se demuestra la política de rotación y replay, no su integración con la sesión
OIDC. Esto es un límite respecto al laboratorio completo de P026; mantenerlo
visible al revisar el DoD. P027 sí integra un OP de test real y verifica las
condiciones de aceptación citadas, sin demostrar una identidad de producción.

El OP usa devInteractions: un nombre y password ficticios sirven, el password
no se verifica. MFA y M2M se explican, no se implementan. No hay resource server
OAuth, autorización por objeto, cuentas reales o recuperación de acceso.
Logout termina solo el RP. Estado Map de un proceso, sin persistencia,
recolección completa o límites de memoria. No es un proveedor listo para operar.

RP HTTPS autofirmado local; OP HTTP solo en loopback. La excepción del cliente
se limita a ese OP; los tests HTTP confían en el certificado exacto. Chromium
usa un contexto local con ignoreHTTPSErrors, no un cambio global. La UI del OP
referencia una fuente externa y el test la bloquea. Cookies no se aíslan por
puerto; el driver Node simplifica por origin y no sustituye al navegador real.

Sin pruebas de rotación operativa de claves, fallo de JWKS, despliegue multiworker,
antiabuso o compatibilidad entre navegadores. No presentar estas omisiones como
controles completos de CSRF/XSS: pertenecen a entregas posteriores.

## Cierre de validación editorial

- 62 tests de la suite raíz y diez del laboratorio, todos en verde tras formato
  e instalación con frozen-lockfile. No se han reejecutado laboratorios antiguos
  que no cambiaron; sus fuentes, ZIP y mediciones siguen contrastados por regresión.
- Build correcto: 48 rutas Astro, 53 HTML contando visores y ocho páginas
  publicadas indexadas por Pagefind. No se han publicado los drafts nuevos.
- Las dieciséis entregas de APIs se revisan a 1440 y 360 px: 32 vistas,
  sin overflow global, errores JS o enlaces locales rotos; imágenes decodificadas
  y noindex presente. También pasan los cinco casos del visor de paginación.
  Reporte: `/tmp/api-contracts-layout.N9MldJ/report.json`.
- Inspección visual de las cuatro capturas de diagramas móviles: texto legible,
  secuencia clara y sin recorte interno. Las capturas son de viewport, no afirman
  que cualquier diagrama alto quepa entero en una sola pantalla.
- Verificación explícita: los 16 drafts no generan HTML/Markdown de post ni
  entrada en llms.txt. El ZIP copiado a dist coincide con el probado.
- El inventario registra 47 IDs con draft, 37 relacionados y 91 sin artículo;
  no es aceptación de las 175 fichas. No se da el objetivo global por terminado.

Fuentes primarias consultadas para redactar: RFC 6749/6750/7636/7009/7519/8725/9700,
OpenID Connect Core, documentación oficial de las tres librerías, MDN Set-Cookie y
guías OWASP de sesiones/MFA. Cada artículo enlaza las que apoyan su contenido.
