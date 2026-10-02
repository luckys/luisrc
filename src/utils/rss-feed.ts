import rss from '@astrojs/rss'
import sanitizeHtml from 'sanitize-html'
import MarkdownIt from 'markdown-it'
import siteConfig from '~/site.config'
import { getPostUrl, getSortedPosts } from '~/utils'
import { getUi, type Locale } from '~/i18n/ui'

const parser = new MarkdownIt()

export async function createRssFeed(locale: Locale) {
  if (!siteConfig.site) {
    throw new Error('Site URL is required for RSS feed generation.')
  }

  const copy = getUi(locale)
  const posts = await getSortedPosts(locale)
  return rss({
    stylesheet: '/rss.xsl',
    title: `${siteConfig.title} — ${locale === 'es' ? 'Español' : 'English'}`,
    description: copy.siteDescription,
    site: siteConfig.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.published,
      description: post.data.description,
      author: post.data.author || siteConfig.author,
      link: getPostUrl(post),
      content: sanitizeHtml(parser.render(post.body || ''), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      }),
    })),
    trailingSlash: false,
  })
}
