# Código de los artículos en un repositorio independiente

El código fuente de los posts vive en
[luckys/luisrc-blog-examples](https://github.com/luckys/luisrc-blog-examples).
La carpeta local inicial es `/home/luckys/Projects/Frontend/luisrc-blog-examples`.
El repositorio remoto todavía debe crearse y subirse; hasta entonces los enlaces
de GitHub no estarán disponibles.

## Responsabilidades de cada repositorio

- **Blog**: artículos, diagramas, audio, interfaz, SVG, visores estáticos y datos
  editoriales que permiten construir el sitio sin un checkout de ejemplos.
- **Ejemplos**: 40 laboratorios en `packages/`, índice por post en `posts/`, tests,
  fixtures, experimentos y resultados originales. Un workspace pnpm y un lockfile.

Se han retirado `examples/`, `public/assets/examples/`, los manifiestos de ZIP y
los scripts de empaquetado. Los archivos originales se conservaron en el nuevo
repositorio. Los ZIP retirados tienen una copia local recuperable en
`/tmp/luisrc-blog-retired-archives-20261020`; el historial Git también los conserva.
No se ha reescrito el historial del blog: esta separación afecta a la revisión actual.

Las pruebas editoriales que comparan snippets con fuentes se ejecutan en el
monorepo. Las pruebas locales del blog comprueban enlaces, metadatos, recursos y
proveniencia sin depender de un directorio hermano. Los resultados de revisión
anteriores en `docs/editorial/` son históricos; sus comandos de empaquetado ZIP
ya no representan el flujo actual.

## Flujo de trabajo

1. Modifica y prueba el ejemplo en el monorepo.
2. Actualiza el post y su índice de archivos. Enlaza el archivo concreto en
   `https://github.com/luckys/luisrc-blog-examples/blob/main/packages/...`.
3. Si cambian visores o resultados, ejecuta desde el monorepo:

   ```bash
   BLOG_ROOT=../luisrc-blog pnpm blog:sync
   BLOG_ROOT=../luisrc-blog pnpm test:editorial
   ```

4. Desde el blog, ejecuta `pnpm build` y después `node --test tests/*.test.mjs`.
5. Revisa y comitea ambos proyectos. Sube primero los ejemplos para que los
   enlaces del blog apunten a archivos disponibles.

`assets/examples-migration/provenance.json` registra las fuentes de los recursos
estáticos y sus SHA-256. `assets/evidence/` contiene únicamente JSON de mediciones,
no implementaciones ejecutables. Las herramientas de diagramas y layout permanecen
en el blog; Playwright es ahora una dependencia explícita suya.

Para un artículo nuevo, añade la relación artículo/laboratorio a los inventarios
de ambos repositorios y los recursos nuevos a la allowlist de exportación. No
vuelvas a añadir laboratorios ni ZIPs a este proyecto.

## Verificación de la migración

Verificado el 20 de octubre de 2026 con Node.js 24.19.0 y pnpm 12.8.1:

- Build del blog y sus 19 pruebas, sin laboratorios locales.
- Cuatro comprobaciones estructurales del monorepo y 44 pruebas cruzadas con los posts.
- Doce suites locales de laboratorios, incluida la parte HTTP de seguridad del navegador.
- Instalación con lockfile congelado y las suites locales repetidas desde un clon
  limpio en `/tmp/luisrc-examples-clean.n3Wixk/repository`, sin el blog como hermano.
- Chromium: ocho pruebas de seguridad del navegador y catorce del frontend, además
  de los checkers trasladados de OIDC y redes.
- Seis vistas de tres artículos API, en 1440 y 360 px, y los cinco visores estáticos.
  Evidencia local: `/tmp/api-contracts-layout.OmWnHX/report.json`.
- Conservación SHA-256 de las fuentes ejecutables del inventario original de 258
  archivos; los metadatos de paquetes, README y lockfiles cambian intencionadamente.
- Los enlaces GitHub se contrastan con archivos locales del monorepo. No se afirma
  disponibilidad HTTP del repositorio remoto, que todavía no existe.

No se han repetido las integraciones Docker/PostgreSQL/Redis ni los experimentos
de la imagen científica: esta tarea cambia ubicación y herramientas, no sus
implementaciones. Los resultados anteriores se mantienen como evidencia archivada,
no como nuevas ejecuciones de esas integraciones.
