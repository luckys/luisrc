import type { APIRoute } from 'astro'
import { getPostUrl, getSortedPosts } from '~/utils'
import siteConfig from '~/site.config'

const locales = ['es', 'en'] as const

function formatPostLink(
  post: Awaited<ReturnType<typeof getSortedPosts>>[number],
): string {
  const title = post.data.title.replaceAll('[', '\\[').replaceAll(']', '\\]')
  const description = post.data.description?.replace(/\s+/g, ' ').trim()
  const url = new URL(getPostUrl(post), siteConfig.site).href
  const date = post.data.published.toISOString().slice(0, 10)

  return `- [${title}](${url})${description ? `: ${description}` : ''} (${date})`
}

export const GET: APIRoute = async () => {
  const postsByLocale = await Promise.all(
    locales.map(async (locale) => [locale, await getSortedPosts(locale)] as const),
  )

  const sections = postsByLocale.map(([locale, posts]) => {
    const heading = locale === 'es' ? 'Artículos en español' : 'Articles in English'
    return [`## ${heading}`, '', ...posts.map(formatPostLink)].join('\n')
  })

  const content = [
    `# ${siteConfig.title} — Luis Ramírez Calle`,
    '',
    `> Sitio personal y blog bilingüe sobre desarrollo de software, tecnología y aprendizaje.`,
    '',
    '## Páginas principales',
    '',
    `- [Inicio (español)](${new URL('/', siteConfig.site).href})`,
    `- [Home (English)](${new URL('/en/', siteConfig.site).href})`,
    `- [Curriculum](${new URL('/curriculum', siteConfig.site).href})`,
    `- [Artículos](${new URL('/posts', siteConfig.site).href})`,
    `- [Articles (English)](${new URL('/en/posts', siteConfig.site).href})`,
    `- [GitHub](${siteConfig.socialLinks.github})`,
    `- [LinkedIn](${siteConfig.socialLinks.linkedin})`,
    '',
    ...sections,
  ].join('\n')

  return new Response(`${content}\n`, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
