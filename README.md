# luisrc-blog

Personal website and blog of Luis Ramírez Calle, built with Astro. The site is bilingual (Spanish and English) and uses Tokyo Night dark and light themes.

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

## 📄 License

This project is licensed under the [MIT License](LICENSE.txt).

## Inspiration

- https://github.com/panr/hugo-theme-terminal
- https://github.com/chrismwilliams/astro-theme-cactus
