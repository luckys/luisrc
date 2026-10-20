# Seguridad del navegador, solo en loopback

Sandbox educativo **intencionadamente vulnerable** para cuatro artículos españoles
de P029. No desplegar, no publicar mediante túneles, no utilizar usuarios o datos
reales. Todos los servidores escuchan únicamente en 127.0.0.1 y puertos efímeros.
El test usa también localhost para observar un cambio de site.

## Ejecutar

Node 24.19.0 o posterior y pnpm 12.8.1:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --only-shell
pnpm test
pnpm serve
```

La instalación de Chromium requiere red y dependencias del sistema compatibles.
Si el navegador ya está en otra carpeta, configura `PLAYWRIGHT_BROWSERS_PATH` con
esa ruta antes de instalar o ejecutar. No se requiere una cuenta o servicio externo.
`pnpm test` necesita el navegador; para los siete tests HTTP únicamente:

```bash
node --test tests/http.test.mjs
```

`serve` imprime las URL y permanece activo hasta Ctrl+C. Visita primero `/session`
en la aplicación para crear una sesión pública ficticia. No hay login real.
Para la sonda XSS, construye q con URLSearchParams o encodeURIComponent; no pegues
HTML sin codificar dentro de una URL. Desde la consola del navegador, abierta en
la página de sesión de la aplicación:

```javascript
const url = new URL('/xss', location.origin)
url.searchParams.set('mode', 'unsafe')
url.searchParams.set(
  'q',
  '<img src="/missing" onerror="document.body.dataset.executed=\'yes\'">',
)
console.log(url.href)
```

## Artículos y evidencia

| Parte            | Archivos                            | Observación comprobada                                                                                        |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| P029. DOM XSS    | render.mjs, browser.test.mjs        | innerHTML ejecuta el marcador; textContent muestra texto sin img                                              |
| API-BROWSER-CSP  | contentPolicy en lab.mjs            | nonce diferente por respuesta, módulo autorizado, handler bloqueado en enforce y ejecutado en report          |
| API-BROWSER-CSRF | validMutation y formBody en lab.mjs | formulario same-site con Lax; rechazo protegido sin efecto; POST cross-site sin cookie; positivo legítimo     |
| API-BROWSER-CORS | cors y rutas preflight en lab.mjs   | lectura cerrada/permitida, wildcard inválido con include, POST con efecto sin lectura, OPTIONS antes de PATCH |

15 tests: siete HTTP de Node y ocho de Chromium. Cada test crea sus servidores
y datos, usa puertos efímeros y los cierra. No hay dependencias de ejecución del
servidor, solo Playwright fijado para pruebas. No se necesita instalar nada con pip.

## Límites que importan

- `/session` no autentica: crea una fixture accesible a cualquiera con URL local.
  Cookie aleatoria opaca de 24 bytes, HttpOnly, SameSite=Lax explícito, Path=/ y
  sin Domain; sesión de 30 minutos en Map. No hay contraseña, OIDC, refresh, logout
  completo o recolección periódica de sesiones expiradas.
- HTTP de loopback, **sin Secure ni garantías TLS**. No copiar la configuración
  como plantilla de producción. No hay proxy ni cache compartida.
- Los puertos separan orígenes, **no aíslan cookies por puerto**. Los tres servidores
  principales comparten host y son controlados por el test; no registran ni explotan
  cookies recibidas. No se demuestra confidencialidad frente a un servidor hostil
  en otro puerto del mismo host. localhost frente a 127.0.0.1 es otro site en el
  flujo probado, no una configuración de dominios de producción.
- Rutas unsafe, report y enforce conservan innerHTML. La corrección del sink es
  safe. CSP es capa adicional: en enforce queda la imagen inyectada, no se ejecuta
  el handler. No hay sanitizador de rich text, Trusted Types o SRI implementados.
- Eventos securitypolicyviolation, no colector remoto de informes ni Reporting API.
- El test XSS cambia un dataset y un título ficticio. Lee solo storage ficticio.
  No exfiltra datos, no accede a terceros ni ejecuta instrucciones del sistema.
- El token CSRF es independiente del ID de sesión; se valida Origin exacto y token
  hexadecimal antes de comparar buffers. No hay API no navegador equivalente ni
  autorización por recurso. El laboratorio anterior de permisos es independiente.
- Preflight no requiere sesión; la petición PATCH real sí. PATCH no modifica estado,
  únicamente confirma recepción. No tratar CORS como autorización.
- Tests de navegador sin routing/interceptación de red para conservar el protocolo
  nativo. Se observan las URL solicitadas y se exige que todas sean locales. Esto
  no es un aislamiento de red del sistema. No hay peticiones a dominios externos
  en las sondas y fixtures distribuidas.
- Solo Chromium probado. No cubre cookies de terceros, Private Network Access,
  navegadores alternativos, SQL, múltiples procesos, proveedores o despliegue real.

Los módulos no usan credenciales ni claves de servicios. El ZIP es de fuentes,
no incluye node_modules, navegador descargado, perfiles o resultados de tests.
