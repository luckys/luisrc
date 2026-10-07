# luisrc-blog

Personal website and blog of Luis Ramírez Calle, built with Astro. The site is bilingual (Spanish and English) and uses Tokyo Night dark and light themes.

The site publishes `/llms.txt` as a concise index for AI search crawlers and allows OAI Search, Claude Search, and Perplexity crawlers in `robots.txt`.

## ✨ Features

- **Tokyo Night Dark/Light**: Tokyo Night Dark is the default. Its palette also powers a custom light theme, and readers can toggle between the two modes.
- **GitHub Comment Section**: Allow readers to respond, discuss, and react with a comment section powered by GitHub and [Giscus](https://giscus.app). Painstakingly themed to match your site perfectly.
- **GitHub Activity Widget**: Optionally include a statically generated GitHub activity calendar on the homepage that (of course) matches the active color scheme perfectly.
- **Markdown Extensions**: Admonitions, auto-generated TOC that sticks to the side on large screens, emoji shortcodes, KaTeX math, MDX, and reading time estimates.
- **RSS Feed and Sitemap**: Built-in support for RSS feeds and sitemap with no extra configuration.
- **Social Links**: Link to GitHub, LinkedIn, and email from the footer.
- **Responsive Design**: Optimized for all devices from desktops to mobile phones. Built with [Tailwind v4](https://tailwindcss.com/).
- **SEO Optimized**: Boost your site's visibility with built-in SEO best practices and automatically generated social card images for every page via [Satori](https://github.com/vercel/satori).
- **Customizable Build**: Powered by [Astro](https://astro.build/), render as a static site (the default) or generate content dynamically.

## 🚀 Getting Started

**Install Dependencies**:

```bash
pnpm install
```

**Start the Development Server**:

```bash
pnpm dev
```

**Build Your Site and View the Results**:

```bash
pnpm build && pnpm preview
```

## Deploy with Cloudflare Pages

Connect `luckys/luisrc-blog` to Cloudflare Pages and choose the **Astro** framework preset. Use these build settings:

- Build command: `pnpm build`
- Build output directory: `dist`
- Root directory: repository root (the default)

In the Pages project settings, add `PNPM_VERSION=12.8.1` for both production and preview builds. The `.node-version` file pins the Node.js version to `22.12.0`. The `wrangler.jsonc` file sets the Pages project name and build output directory. Since Astro builds this site as static HTML, it does not need the Cloudflare adapter.

## 🛠️ Configuration

Site configuration lives in `src/site.config.ts`.

Please take a look at `src/site.config.ts` for more information about the configuration options.

To add your own content, check out the `src/content` directory. Feel free to remove all the example content and replace it with your own!

## Idiomas / Languages

El sitio usa español como idioma principal: `/`, `/curriculum` y `/posts`. Las páginas en inglés llevan el prefijo `/en/`, por ejemplo `/en/`, `/en/curriculum` y `/en/posts`.

Los artículos se guardan en `src/content/posts/es/` y `src/content/posts/en/`. Para enlazar una traducción, usa el mismo `translationKey` en ambos archivos y un `slug` propio para cada idioma:

```yaml
---
title: 'Título del artículo'
published: 2026-10-01
locale: es
translationKey: 'mi-primer-articulo'
slug: 'mi-primer-articulo'
description: 'Resumen del artículo.'
tags: ['javascript']
---
```

En la traducción inglesa usa `locale: en` y conserva `translationKey`; el selector de idioma llevará a la versión correspondiente. El contenido de inicio y el addendum también están separados en `src/content/es/` y `src/content/en/`.

Para usar fórmulas KaTeX en un artículo, añade `math: true` a su frontmatter; la hoja de estilos matemática solo se carga en esos artículos.

## Conectar los comentarios con GitHub (Giscus)

Los comentarios usan GitHub Discussions. La configuración de la plantilla se ha retirado:
el blog apunta a `luckys/luisrc` y no carga el widget hasta que se complete la categoría.
El aviso de configuración aparece en desarrollo; los lectores ven un mensaje breve mientras
los comentarios no están disponibles.

1. En el repositorio público que almacenará los comentarios, abre **Settings → General → Features** y activa **Discussions**. Para este proyecto: [configuración de luckys/luisrc](https://github.com/luckys/luisrc/settings).
2. Instala la [aplicación Giscus](https://github.com/apps/giscus) y concédele acceso únicamente al repositorio elegido. Esta autorización se hace en GitHub; no requiere añadir tokens al blog.
3. En **Discussions**, crea una categoría llamada `Comentarios` de tipo **Announcements**, o selecciona una categoría existente de ese tipo. Giscus recomienda este formato para que solo los mantenedores y la aplicación creen nuevas discusiones.
4. Abre [giscus.app](https://giscus.app/es), escribe `luckys/luisrc`, selecciona la categoría y deja el mapeo en **pathname**. Copia los valores del script generado a `src/site.config.ts`:

   ```typescript
   giscus: {
     repo: 'luckys/luisrc', // data-repo
     repoId: 'R_kgDOU5aEGw', // data-repo-id; compruébalo en el generador
     category: 'Comentarios', // data-category; nombre exacto de tu categoría
     categoryId: 'COPIA_AQUI_DATA_CATEGORY_ID', // data-category-id; sustituye este texto
     reactionsEnabled: true,
   },
   ```

   No reutilices IDs de otro repositorio o categoría. Si eliges un repositorio diferente,
   copia sus cuatro valores, no solo el nombre. Los IDs no son secretos.

5. `giscus.json` permite cargar comentarios desde `https://luisrc.pages.dev`. Este archivo debe estar en la raíz de la **rama predeterminada del repositorio de discusiones**. Si usas otro repositorio, copia allí el archivo. Para pruebas locales, añade explícitamente el origen que utilices, por ejemplo `http://localhost:4321`, a `origins`. `localhost` y `127.0.0.1` son orígenes diferentes, al igual que dos puertos distintos.
6. Ejecuta `npm run build` y despliega los cambios. Reinicia el servidor de desarrollo si no recoge la nueva configuración. Comprueba un artículo y autoriza Giscus con tu cuenta de GitHub para comentar. La discusión se crea cuando llega el primer comentario o reacción; no hace falta crear una discusión por artículo manualmente.

Con `pathname`, las versiones española e inglesa tienen discusiones separadas. Cambiar el
slug de un artículo cambia su asociación. Mantén las URLs estables después de publicar.
Los artículos con `draft: true` solo aparecen en desarrollo, no en la web publicada.

Si no carga el widget, comprueba que Discussions siga activado, que la aplicación tenga
acceso al repositorio, que ambos IDs sean correctos y que el origen esté permitido.
Un bloqueador de contenido o un fallo de red también puede impedir la carga.

Documentación oficial: [configuración de Giscus](https://giscus.app/es) y
[restricciones de origen y uso avanzado](https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md).

## 📄 License

This project is licensed under the [MIT License](LICENSE.txt).

## Inspiration

- https://github.com/panr/hugo-theme-terminal
- https://github.com/chrismwilliams/astro-theme-cactus
