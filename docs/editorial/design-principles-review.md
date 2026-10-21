# Revisión: principios de diseño sin sobreingeniería

Fecha: 21 de octubre de 2026. Entrega posterior a `a7b4e69` (blog) y `9316534`
(ejemplos), commits creados al comenzar este encargo. Sin push.

## Alcance editorial

Siete drafts españoles, autor Luis Ramírez Calle. Ver ruta-principios-diseno.md
y design-principles-series.json. P043 obtiene desarrollo específico; los otros
seis IDs son partes de esa ficha, no seis fichas nuevas del roadmap.

Cohesión/SRP, OCP/composición, LSP, ISP, DIP/DI, KISS/YAGNI y DRY tienen problema,
mecanismo, ejemplo, alternativas, límites y ejercicio. Entre 1200 y 1500 palabras
aproximadas por archivo contando código y metadatos. La división evita confundir
capacidad, comportamiento y construcción. No se obliga a utilizar clases o DDD.

La guía de escritura motivó problemas concretos, párrafos breves, decisiones
explicadas y casos que contradicen interpretaciones demasiado generales. No hay
anécdotas, cifras de productividad o benchmarks inventados. Los diagramas son
relaciones y recorridos del fixture, no infraestructura desplegada.

## Código y evidencia

Laboratorio completo en `luisrc-blog-examples/packages/design-principles`, con
carpetas en inglés. Los posts conservan dieciséis extractos ejecutables y enlazan
fuentes, imports y tests. Índices de ambos repositorios sincronizados: 153 posts,
19 paquetes, los mismos 48 exports estáticos previos. No se copia código de
laboratorio al blog ni se recrean ZIPs.

Node 24.19.0, TypeScript 5.9.2 estricto, pnpm 12.8.1. Instalación offline y después
lockfile congelado verificadas. El primer rojo fue por módulos ausentes. Con los
módulos y la tarifa pendiente, ocho de los dieciséis tests iniciales fallaron;
implementar la tarifa los llevó a verde. Después se amplían cuatro casos más,
sin atribuirles un ciclo red/green que no se registró. Total: veinte tests locales.

Se prueba caracterización en ocho entradas, presentación independiente, parser,
recargo y límites, contratos de dos tarifas con 24 combinaciones cada una, candidatos
malos detectados, tipos estructurales, espera de confirmación, error sin retry,
duplicados, copias defensivas e instancias aisladas. Políticas DRY son ficticias.
`lightOnly` compila como RateRule y falla la suite conductual: se ejecuta el mismo
candidato que aparece en el post, no una copia de su implementación.

Typecheck independiente del borrado de tipos de Node; asignación inválida esperada
con `@ts-expect-error`. Demo devuelve portes 7.00 EUR y una cotización de 700.
La espera usa una promesa controlada y un turno de event loop, no un timeout que
pretenda medir velocidad. No se afirma que el helper demuestre pureza o LSP formal.

## Verificación

- Veinte tests del laboratorio y tipos estrictos pasan, repetidos tras formato.
- Cuatro tests estructurales y 54 editoriales cruzados pasan.
- Los dieciséis snippets coinciden con fuentes ejecutadas, ignorando únicamente
  formato de espacios, comillas, separadores y comas finales.
- Siete D2/SVG, alt descriptivo y dimensiones reales contrastadas.
- Build de producción y 19 tests del blog pasan; cincuenta rutas, diez páginas
  anteriormente publicadas indexadas. Los nuevos artículos siguen en draft.
- Chromium: siete artículos en 1440 y 360, catorce vistas, con H1, noindex,
  ausencia de overflow, imágenes decodificadas, enlaces internos 200 y capturas.
  Primer informe completo: `/tmp/design-principles-layout.8EoUJu/report.json`.
  La inspección móvil detectó un SRP demasiado ancho y etiquetas solapadas en LSP;
  se compactan SRP/LSP/DRY y se repite el recorrido: informe final
  `/tmp/design-principles-layout.GkNRog/report.json`, catorce vistas pasan.
  Se inspeccionan las capturas finales de los tres y de DIP. No se suman repeticiones como
  pruebas nuevas. El primer intento del harness se corrigió para esperar lazy-load
  antes de decode; no se debilitó la condición de imagen cargada.

Build final y 19 tests repetidos tras los ajustes; servidor temporal detenido.
Se revierte únicamente la actualización/pruning automática del lockfile del blog
producida por pnpm durante las comprobaciones, sin cambios de dependencias solicitados.

No se repiten Docker, PostgreSQL, Redis, ML o todos los laboratorios no modificados.
Los enlaces GitHub se contrastan con archivos locales; el repositorio de ejemplos
todavía debe existir y subirse para que esos enlaces estén disponibles online.

## Límites y continuación

Sin proveedor, SQL, identidad, durabilidad, FX, impuestos o internacionalización
completa. Memoria por instancia, síncrona antes de resolver save, no transacción
distribuida. LSP muestreado, no demostrado para todos los valores o efectos. Los
plazos de devolución no son normativa y no calculan fechas. Interfaces no son permisos.

El laboratorio prepara P045; no cumple su sustitución Stripe sandbox/fake porque
esa integración todavía no existe. P046 tampoco se considera completo. Siguiente
bloque: puertos/adaptadores y Clean Architecture, ownership modular y costes de
despliegue/consistencia/CQRS, en entregas específicas. Después revisar P048/P051.

El usuario pide commit tras la revisión y continuar el bloque siguiente; no push,
publicación, traducciones o audio. El inventario 54 exactos/32 relacionados/89 sin
artículo identificado sigue siendo inventario, no aceptación de las 175 fichas.
