import type { SiteConfig } from '~/types'

const config: SiteConfig = {
  // Absolute URL to the root of your published site, used for generating links and sitemaps.
  site: 'https://luisrc.dev',
  // The name of your site, used in the title and for SEO.
  title: 'luisrc',
  // The description of your site, used for SEO and RSS feed.
  description:
    'Personal website and blog of Luis Ramírez Calle, about software development, technology, and learning.',
  // The author of the site, used in the footer, SEO, and RSS feed.
  author: 'Luis Ramírez Calle',
  // Keywords for SEO, used in the meta tags.
  tags: ['Luis Ramírez Calle', 'Software development', 'Technology', 'Learning'],
  // Path to the square image used for generating social media previews.
  // WebP is converted to JPEG when the social cards are generated.
  socialCardAvatarImage: './src/content/avatar.webp',
  // Font imported from @fontsource or elsewhere, used for the entire site.
  // To change this see src/styles/global.css and import a different font.
  font: 'JetBrains Mono Variable',
  // For pagination, the number of posts to display per page.
  // The homepage will display half this number in the "Latest Posts" section.
  pageSize: 6,
  // Whether Astro should resolve trailing slashes in URLs or not.
  // This value is used in the astro.config.mjs file and in the "Search" component to make sure pagefind links match this setting.
  // It is not recommended to change this, since most links existing in the site currently do not have trailing slashes.
  trailingSlashes: false,
  // The navigation links to display in the header.
  navLinks: [
    {
      name: 'GitHub',
      url: 'https://github.com/luckys',
      external: true,
    },
    {
      name: 'LinkedIn',
      url: 'https://www.linkedin.com/in/luis-ramirez-calle/',
      external: true,
    },
  ],
  // The theming configuration for the site.
  themes: {
    // The theming mode. One of "single" | "select" | "light-dark-auto".
    mode: 'light-dark-auto',
    // The default theme identifier, used when themeMode is "select" or "light-dark-auto".
    // Make sure this is one of the themes listed in `themes` or "auto" for "light-dark-auto" mode.
    default: 'tokyo-night',
    // Shiki themes to bundle with the site.
    // https://expressive-code.com/guides/themes/#using-bundled-themes
    // These will be used to theme the entire site along with syntax highlighting.
    // To use light-dark-auto mode, only include a light and a dark theme in that order.
    // include: [
    //   'github-light',
    //   'github-dark',
    // ]
    include: ['tokyo-night-light', 'tokyo-night'],
    overrides: {
      'tokyo-night': {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        accent: '#7aa2f7',
        heading1: '#7aa2f7',
        heading2: '#bb9af7',
        heading3: '#7dcfff',
        heading4: '#9ece6a',
        heading5: '#e0af68',
        heading6: '#f7768e',
        list: '#7aa2f7',
        italic: '#bb9af7',
        link: '#7dcfff',
        separator: '#3b4261',
        note: '#7aa2f7',
        tip: '#9ece6a',
        important: '#bb9af7',
        caution: '#e0af68',
        warning: '#f7768e',
        blue: '#7aa2f7',
        green: '#9ece6a',
        red: '#f7768e',
        yellow: '#e0af68',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
      },
      'tokyo-night-light': {
        background: '#f5f6fb',
        foreground: '#343b58',
        accent: '#34548a',
        heading1: '#1a1b26',
        heading2: '#283457',
        heading3: '#34548a',
        heading4: '#565f89',
        heading5: '#7847a8',
        heading6: '#98546a',
        list: '#34548a',
        italic: '#565f89',
        link: '#2463c8',
        separator: '#c7cce0',
        note: '#34548a',
        tip: '#587539',
        important: '#7847a8',
        caution: '#805d00',
        warning: '#b83f55',
        blue: '#34548a',
        green: '#587539',
        red: '#b83f55',
        yellow: '#805d00',
        magenta: '#7847a8',
        cyan: '#007c9e',
      },
    },
  },
  // Social links to display in the footer.
  socialLinks: {
    github: 'https://github.com/luckys',
    linkedin: 'https://www.linkedin.com/in/luis-ramirez-calle/',
    email: 'luis.ramirezcalle@outlook.com',
  },
  // Configuration for Giscus comments.
  // To set up Giscus, follow the instructions at https://giscus.app/
  // You'll need a GitHub repository with discussions enabled and the Giscus app installed.
  // Take the values from the generated script tag at https://giscus.app and fill them in here.
  // IMPORTANT: Update giscus.json in the root of the project with your own website URL
  // If you don't want to use Giscus, set this to undefined.
  giscus: {
    repo: 'stelcodes/multiterm-astro',
    repoId: 'R_kgDOPNnBig',
    category: 'Giscus',
    categoryId: 'DIC_kwDOPNnBis4CteOc',
    reactionsEnabled: true, // Enable reactions on post itself
  },
  // These are characters available for the character chat feature.
  // To add your own character, add an image file to the top-level `/public` directory
  // Make sure to compress the image to a web-friendly size (<100kb)
  // Try using the excellent https://squoosh.app web app for creating small webp files
  characters: {
    owl: '/owl.webp',
    unicorn: '/unicorn.webp',
    duck: '/duck.webp',
  },
}

export default config
