# P030: empezar por fronteras pequeñas, no agrupar todas las vulnerabilidades

Esta revisión conserva la evidencia del primer avance de P030. La ampliación
posterior de SSRF y el estado actual se documentan en [api-ssrf-review.md](api-ssrf-review.md).

## Decisión editorial

Se retoma el objetivo activo después de progreso verificable en P029, no de una
espera o bloqueo. Estado real: commit ed7a5b3; P029 continúa sin commit. No se crea
otro commit o push en esta reanudación automática del objetivo.

P029 ya separa DOM XSS, CSP, CSRF y CORS. Cada entrega desarrolla un mecanismo
distinto con observación y ejercicio; no se ve necesario fragmentarlas otra vez.
El artículo anterior API-SECURITY es un resumen relacionado, no prueba la ficha P030.
Se conserva su URL y se enlazan las nuevas profundizaciones.

P030 sí exige división preventiva. Este avance produce tres drafts españoles:

1. P030, threat modeling: activos/actores, fronteras, escenarios, STRIDE y vocabulario
   OWASP, prioridades cualitativas, responsables y conexión con evidencia/riesgo residual.
2. API-THREATS-ASSIGNMENT: permiso por propiedad, mezcla insegura, comando title-only,
   escritura de columna explícita, DTO y visor de cambios. Es una decisión de extremo
   a extremo; separarla en posts de parser/UPDATE ocultaría el mismo contrato.
3. API-THREATS-SQL: interpretación SQL real, bindings, ámbito de tenant y allowlist de
   ordenación. Los últimos dos puntos evitan concluir erróneamente que parametrizar
   autoriza cualquier consulta; pertenecen al mismo recorrido de búsqueda.

No se usa umbral de palabras como sustituto de claridad. Las próximas entregas
deben ser específicas de SSRF, consumo/rate limiting y broken auth/secretos. P031
también requerirá división propia. No se declara completado P030 ni la serie.

## Laboratorio y pruebas

https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats, Node 24.19.0 y SQLite 3.53.3 observado en ese runtime.
Sin dependencias que instalar. Tests escritos primero: rojo por lab.mjs inexistente.
Después trece tests verdes, con HTTP y SQLite reales, no parser SQL simulado.

El modelo amenaza por amenaza conserva control, propietario de seguimiento, prueba
y riesgo residual. T01 solo demuestra lookup de fixture. T02 lectura/escritura ajena,
ID repetido entre tenants y denegación sin efectos. T03 reproduce owner/state
indebidos, rechaza campos extra, futuros, anidados y `__proto__`, conserva estado y
permite title. UPDATE seguro exige owner/draft en el WHERE y no reescribe metadatos.
T04 divulga tres filas de dos tenants con concatenación, obtiene cero con binding,
guarda y busca literalmente la misma sonda y una comilla legítima, contrasta consulta
parametrizada sin tenant y rechaza sort arbitrario sin destruir la tabla.

Se prueban además JSON roto, media type, tamaño en bytes y método/modo desconocidos.
No son pruebas de carga. T05–T07 siguen pending con test null. No se transforma el
control parcial de body en una declaración de disponibilidad protegida.

Visor sin red comparte command.mjs, cuenta cambios en tres propiedades y escribe
texto, no HTML. El indicador no es una métrica de seguridad ni una ejecución SQL.
ZIP con doce archivos allowlisted, incluido el lockfile del propio pnpm, sin base,
instalación, clave real o dependencia de aplicación.
Los extractos se contrastan con los archivos ejecutados. El test detectó dos
extractos SQL desincronizados por formato; se actualizaron sin debilitar el check.

## Límites que permanecen

Solo loopback, datos falsos, variantes unsafe explícitas. HTTP sin TLS, identidad
pública sin expiración, no OIDC integrado ni memberships dinámicas, SQLite embebido
sin usuarios SQL/RLS/persistencia. Last write wins entre títulos válidos. No rich
PATCH, publicación o transferencia real. No demostrar prototype pollution por
rechazar la clave `__proto__`. No búsqueda LIKE o benchmark. Los endpoints vulnerables
se distribuyen en un ZIP de fuentes, no se montan en el blog.

No SSRF reproducido, cuotas/rate limiter, carga distribuida o secret manager.
P030 parcial. El gap previo P026 (refresh no integrado con sesión RP) continúa.
Sin inglés, audio, publicación o push.

## Verificación de entrega

- `node --test tests/*.test.mjs`: 69 tests pasan sobre el build final completo.
  Los dos nuevos comprueban metadatos, cuatro extractos reales, diagramas, enlaces,
  riesgos abiertos y bytes del ZIP/visor. No hay umbral artificial de palabras.
- ZIP final extraído a una carpeta temporal y `pnpm test`: trece tests pasan sin
  instalación de librerías. Incluye también Allow en 405 y sort con claves heredadas.
  No se suman ejecuciones repetidas para aumentar el recuento.
- `pnpm build`: pasa, 48 rutas, 55 HTML incluyendo assets públicos; Pagefind conserva
  ocho páginas publicadas y 4104 palabras. Un intento previo falló con EAI_AGAIN del
  servicio externo github-contributions-api.jogruber.de usado por la portada. Los
  reintentos normales pasaron sin modificar el calendario o falsear sus datos.
- Se llegó a ejecutar SEO contra una salida incompleta mientras se repetía el
  build. Dio archivos ausentes. Se repitió toda la suite después de terminar el build,
  con 69/69; no ejecutar ambos pasos en paralelo cuando los tests consumen dist.
- Los 26 drafts API no se emiten como HTML de posts, Markdown de posts o entradas
  de llms.txt. ZIP y los cuatro archivos públicos del visor en dist son idénticos.
- Revisión Chromium completa: 52 vistas, 26 artículos a 1440 y 360 px. Sin overflow
  de página, imágenes rotas, enlaces locales rotos, errores JS/KaTeX o pérdida de
  noindex. Tres visores comprobados. Informe `/tmp/api-contracts-layout.6qPHOU/report.json`.
- Tras corregir el formato Markdown de `__proto__`, se repitieron las seis vistas
  nuevas y los visores: `/tmp/api-contracts-layout.vvPHbM/report.json`.
  Tras ajustar el indicador para que cero cambios protegidos sea el óptimo, se
  repitieron las dos vistas de mass assignment y todos los visores:
  `/tmp/api-contracts-layout.HF3NcB/report.json`.
- Inspección visual de las tres figuras móviles y del visor con entrada protegida:
  legibles dentro del ancho. Variante vulnerable: tres propiedades cambiadas;
  variante segura: 422 y cero cambios. Hay texto y valor numérico, no solo color.
  Casos del visor: normal, protegido, campo futuro, anidado, JSON roto, HTML literal
  sin nodos img o ejecución, y reset mediante teclado.
- Servidor temporal pid 1754404 detenido y `astro dev status` confirma que no queda
  un servidor de desarrollo ejecutándose.

Los tres artículos nuevos, su código y recursos quedan sin commit, al igual que
el avance previo P029. Último commit ed7a5b3. No se hizo push o publicación.
