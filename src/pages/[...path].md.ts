import type { APIRoute, GetStaticPaths } from 'astro'
import type { CollectionEntry } from 'astro:content'
import { getPostUrl, getSortedPosts } from '~/utils'
import siteConfig from '~/site.config'

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = (
    await Promise.all(['es', 'en'].map((locale) => getSortedPosts(locale as 'es' | 'en')))
  ).flat()
  return posts
    .filter((post) => !post.data.draft)
    .map((post) => ({
      params: { path: getPostUrl(post).replace(/^\//, '') },
      props: { post },
    }))
}

export const GET: APIRoute = ({ props }) => {
  const post = props.post as CollectionEntry<'posts'>
  const canonical = new URL(getPostUrl(post), siteConfig.site).href
  const content = [
    `# ${post.data.title}`,
    '',
    post.data.description || '',
    '',
    `Author: ${post.data.author || siteConfig.author}`,
    `Published: ${post.data.published.toISOString().slice(0, 10)}`,
    `Language: ${post.data.locale}`,
    `Canonical: ${canonical}`,
    `Topics: ${post.data.tags.join(', ')}`,
    '',
    `Relative links and images resolve against ${canonical}.`,
    '',
    post.body || '',
  ].join('\n')

  return new Response(`${content}\n`, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: `<${canonical}>; rel="canonical", </llms.txt>; rel="describedby"`,
    },
  })
}
