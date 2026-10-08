import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  narratePost,
  splitNarration,
  audioFingerprint,
  selectAudio,
} from '../src/lib/post-audio.mjs'

test('narrates prose and inline code without links, markup or code blocks', () => {
  const text = narratePost(
    'Title',
    '## Heading\n\n**Python** and `int` [docs](https://example.com).\n\n```py\nsecret_code()\n```',
    'en',
  )
  assert.match(text, /Python and int docs/)
  assert.match(text, /code example/)
  assert.doesNotMatch(text, /https|secret_code|\*\*|##/)
})

test('splits long narration without losing words or breaking Unicode', () => {
  const text = 'Una frase con palabras. '.repeat(200).trim()
  const chunks = splitNarration(text)
  assert.ok(chunks.every((chunk) => chunk.length <= 1000))
  assert.equal(chunks.join(' '), text)
  assert.deepEqual(splitNarration(''), [])
  assert.equal(splitNarration('abc😀def', 4).join(''), 'abc😀def')
})

test('uses only matching language audio and hides stale recordings', () => {
  const post = { title: 'Title', body: 'Text', locale: 'es', translationKey: 'test' }
  const manifest = {
    test: {
      es: {
        src: '/assets/audio/es.mp3',
        fingerprint: audioFingerprint(post.title, post.body, post.locale),
      },
    },
  }
  assert.equal(selectAudio(manifest, post), '/assets/audio/es.mp3')
  assert.equal(selectAudio(manifest, { ...post, locale: 'en' }), undefined)
  assert.equal(selectAudio(manifest, { ...post, body: 'Changed' }), undefined)
})
