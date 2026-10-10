import { createHash } from 'node:crypto'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

const markdown = new MarkdownIt({ html: true })
export const voices = { es: 'es-ES-AlvaroNeural', en: 'en-US-AndrewNeural' }

// Narrate prose, not Markdown syntax, URLs or long code listings.
export function narratePost(title, body, locale) {
  const parts = [title]
  for (const token of markdown.parse(body, {})) {
    if (token.type === 'html_block') {
      parts.push(
        markdown.utils.unescapeAll(
          sanitizeHtml(
            token.content.replace(
              /<\/(?:summary|p|div|li|h[1-6])\s*>|<br\s*\/?>/gi,
              '$&\n\n',
            ),
            {
              allowedTags: [],
              allowedAttributes: {},
              nonTextTags: ['style', 'script', 'textarea', 'option', 'pre'],
            },
          ),
        ),
      )
    }
    if (token.type === 'inline') {
      parts.push(
        (token.children ?? [])
          .map((child) => {
            if (['text', 'code_inline', 'image'].includes(child.type))
              return child.content
            if (['softbreak', 'hardbreak'].includes(child.type)) return ' '
            return ''
          })
          .join(''),
      )
    }
    if (['fence', 'code_block'].includes(token.type)) {
      parts.push(
        locale === 'es'
          ? 'El ejemplo de código está disponible en la versión escrita del artículo.'
          : 'The code example is available in the written version of this article.',
      )
    }
  }
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/[.!?:;]$/.test(part) ? part : `${part}.`))
    .join('\n\n')
}

export function audioFingerprint(title, body, locale) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        voice: voices[locale],
        text: narratePost(title, body, locale),
      }),
    )
    .digest('hex')
}

export function splitNarration(text, limit = 1000) {
  if (!Number.isInteger(limit) || limit < 2) throw new Error('Invalid chunk limit')
  const chunks = []
  let remaining = text.trim()
  while (remaining.length > limit) {
    let end = remaining.lastIndexOf(' ', limit)
    if (end < limit / 2) end = limit
    // Avoid splitting a UTF-16 surrogate pair.
    if (
      /\p{Surrogate}/u.test(remaining[end - 1]) &&
      /\p{Surrogate}/u.test(remaining[end])
    )
      end--
    chunks.push(remaining.slice(0, end).trim())
    remaining = remaining.slice(end).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

export function selectAudio(manifest, post) {
  const audio = manifest[post.translationKey]?.[post.locale]
  return audio?.fingerprint === audioFingerprint(post.title, post.body ?? '', post.locale)
    ? audio.src
    : undefined
}
