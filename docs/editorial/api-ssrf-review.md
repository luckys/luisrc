# P030: dos entregas específicas para SSRF

Esta revisión conserva la evidencia del avance SSRF. La ampliación posterior de
consumo/cuota y el estado actual están en [api-admission-review.md](api-admission-review.md).

## Punto de partida y decisión editorial

Turno anterior clasificado como progreso: tres artículos, HTTP/SQLite ejecutados,
diagramas y visor contrastados. Se ha revalidado git: último commit ed7a5b3, cambios
P029/P030 sin commit. No se crean commits o push en esta continuación automática.

Las tres partes anteriores separan modelo, propiedades y SQL; no se fragmentan
por cada comprobación porque perderíamos el recorrido de una misma decisión.
SSRF sí se divide de forma preventiva en dos preguntas distintas:

1. API-THREATS-SSRF, contrato y redirects: quién elige scheme/host/ruta, referencias
   por tenant, origin exacto, credenciales de salida y autorización de cada destino.
2. API-THREATS-DNS, resolución y conexión: TOCTOU, IP aprobada fijada al socket,
   Host conservado y límites de TLS/proxy/pooling/egress. DNS no es una nota a pie
   de un tutorial de strings; necesita su propia evidencia y ejercicio.

Ambos son drafts españoles, sin traducción, audio o publicación. Fuentes primarias:
OWASP SSRF/API7:2023, Node HTTP/DNS/URL/HTTPS, RFC 9110/6761. No se afirma que los
fixtures equivalgan a una configuración general de producción. Las entregas
anteriores conservan URL e IDs y ahora enlazan la ampliación, sin inflar fichas.

## Código y TDD

Se escribieron primero tests/ssrf.test.mjs: rojo por destinations.mjs inexistente.
La primera implementación pasó once casos y falló tamaño: 200 en lugar de 502.
request.destroy no rechazaba inmediatamente la promesa y podía ganar el evento end.
Se añadió rechazo antes de destruir; se conserva la expectativa original. El test
de deadline inicial prueba también resolución tardía sin conexión posterior.

La revisión añadió URL blob con origin derivado del proveedor: el test de parser
falló por ausencia de rechazo y el HTTP del harness devolvió 500 en vez de 403.
Se exige protocol explícito además de origin, tanto en el parser de aplicación
como en la guardia del harness. Se conserva la sonda, sin debilitar expectativas.
La explicación del post cita la especificación WHATWG. No hubo salida externa.

https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats tiene 27 tests: trece iniciales, trece de SSRF y uno que vuelve
a ejecutar cinco escenarios y compara las trazas archivadas. HTTP de salida y
sockets reales; resolver programado, no DNS real. Dos servicios escuchan en
127.0.0.1 y 127.0.0.2 con el mismo puerto efímero. media.fixture.test solo usa el
lookup inyectado; no hay consultas DNS externas, cambios de hosts o metadata cloud.

POST /tenants/:tenant/imports se integra después de identidad y tenant en la API
existente, solo al inyectar importer. pnpm serve:ssrf monta los tres servicios;
pnpm serve mantiene el ejemplo anterior sin la integración de destinos.
Sin identidad/tenant apropiados no hay salidas; referencia ajena o body URL falla
antes de conectar. Cada tenant tiene un positivo. No se persiste el texto importado.

Variantes malas: URL directa, origin inicial sin política de redirect y resolución
comprobada seguida de otra no comprobada. La guardia del harness restringe todos los
orígenes e IP al propio sandbox incluso en ellas; no es un firewall ni la política
de producto cuya ausencia se reproduce. No se publica un endpoint vulnerable del blog.

Camino seguro: catálogo por tenant, todos los candidatos admitidos, IP fijada en
lookup y redirects rechazados. Host conserva nombre, no Authorization/Cookie de
usuario. Lista vacía, IP no admitida y mezcla de familias deniegan antes del socket.
1000 ms incluyendo espera inicial y 1024 bytes de respuesta. No cerrar T06 por esos
límites: faltan cuota, rate limiting, carga y concurrencia de consumidores hostiles.

## Gráficos y evidencia

Dos diagramas D2/SVG en vertical. Visor estático adicional en api-ssrf que representa
eventos ordenados y cuenta peticiones recibidas. record-ssrf.mjs obtiene datos de
cinco ejecuciones reales y comprueba expectativas. tests/ssrf-evidence.test.mjs
repite los sockets, no simplemente recalcula un modelo de la misma gráfica.

| Escenario            | HTTP | Consultas al resolver | Proveedor | Interno |
| -------------------- | ---- | --------------------- | --------- | ------- |
| URL directa          | 200  | 0                     | 0         | 1       |
| Redirect sin revisar | 200  | 1                     | 1         | 1       |
| Redirect rechazado   | 502  | 1                     | 1         | 0       |
| Doble resolución     | 200  | 2                     | 0         | 1       |
| IP aprobada fijada   | 200  | 1                     | 1         | 0       |

Son contadores del fixture, no tiempo, riesgo o tráfico del sitio. El visor solo
descarga un JSON estático; no ejecuta SSRF desde el navegador. Texto mediante DOM,
sin HTML inyectado o eval. Controles por teclado y error de carga con controles
desactivados. Los archivos públicos y el ZIP se sincronizan desde las mismas fuentes.

## Límites y continuación

T05 demostrado únicamente en ese alcance. Sin servidor DNS, TTL/cachés, HTTPS/SNI/
certificados, IPv6 del transporte, proxies, retries, pooling, infraestructura egress
o firewall. Loopback permitido solo como excepción explícita de fixtures. El destino
«interno» es un papel lógico, no una red inaccesible para el runner.

P030 parcial: T06 consumo/rate limiting y T07 secretos/broken auth abiertos. El modelo
actual refleja la importación, en vez de conservarla como función futura. Persistencia,
autenticación real y el refresh integrado de P026 siguen sin demostrar. Próximo
avance: dividir presupuesto/concurrencia y rate limiting en entregas propias; después
broken auth/secretos y P031 también por preguntas pequeñas y verificables.

## Verificación final

- `pnpm build` pasa. 48 rutas estáticas, 56 HTML contando recursos públicos; Pagefind
  conserva ocho páginas publicadas y 4104 palabras. No se modifica el calendario
  de GitHub ni se sustituye por datos falsos para construir.
- `node --test tests/*.test.mjs` después del build completo: 70 tests pasan.
  Ocho extractos reales de P030, cinco drafts con enlaces/figuras, riesgos
  pendientes/cubiertos y los bytes públicos se contrastan con fuentes.
- ZIP final extraído a una carpeta independiente, `pnpm test`: 27 tests pasan sin
  instalar librerías. Incluye el rechazo de protocolo blob y las cinco trazas
  reconstruidas con HTTP/sockets. No sumar ejecuciones repetidas como tests nuevos.
- El ZIP tiene 23 archivos allowlisted: fuentes, tests, README, lockfile del gestor,
  evidencia y visor; sin bases persistidas, claves, credenciales reales o instalaciones.
- Los 28 drafts API no se emiten como HTML de posts, Markdown de posts o entradas
  llms.txt. ZIP y cuatro archivos SSRF en dist idénticos a public tras el build final.
- Chromium completo: 56 vistas de 28 artículos a 1440 y 360 px, más cuatro visores.
  No overflow de página, errores JS/KaTeX, imágenes sin cargar o enlaces locales
  rotos; noindex conservado. Informe `/tmp/api-contracts-layout.enB1FM/report.json`.
- Tras añadir el caso blob y ajustar el singular de los contadores, se repitieron
  las cuatro vistas nuevas y los cuatro visores. Informe
  `/tmp/api-contracts-layout.CHVIEE/report.json`. El visor SSRF comprueba sus cinco
  recorridos, pasos/contadores/resultados, reset y range por teclado, y evidencia
  ausente con controles desactivados. La única interceptación nueva simula 404
  del JSON estático; no altera preflight o solicitudes de los laboratorios.
- Inspección visual de ambos SVG móviles y de las trazas de doble resolución y
  pin: legibles dentro del ancho; eventos y contadores explican por qué 200 con
  marcador interno es un fallo. No son benchmark o mediciones de riesgo.
- `pnpm serve:ssrf` arrancó los tres servicios. Petición legítima North devolvió
  NORTH-A1; Ctrl+C cerró limpiamente con exit 0. Servidor Astro temporal pid 1874531
  detenido tras la revisión; no queda un servidor de desarrollo ejecutándose.

Todos estos cambios siguen sin commit, sobre ed7a5b3, junto a los avances previos
P029/P030. Sin push, publicación, inglés o audio. Objetivo editorial completo activo,
no logrado: continuar T06/T07 y P031; conservar los límites anteriores de P026.
