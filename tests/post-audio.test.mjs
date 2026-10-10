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

test('narrates HTML disclosure text and tables without element attributes or image URLs', () => {
  const body = [
    '<div class="overflow-x-auto" role="region" aria-label="Example">',
    '',
    '| Property | Meaning |',
    '| --- | --- |',
    '| Atomicity | All or nothing |',
    '',
    '</div>',
    '',
    '<img src="/assets/diagram.svg" alt="A diagram" loading="lazy" />',
    '',
    '<details>',
    '<summary>Optional lab &amp; tests</summary>',
    '',
    'Read <strong>this explanation</strong>.',
    '',
    '```sql',
    'SELECT hidden_example;',
    '```',
    '',
    '</details>',
  ].join('\n')
  const text = narratePost('Title', body, 'en')
  assert.match(text, /Atomicity/)
  assert.match(text, /Optional lab & tests/)
  assert.match(text, /Read this explanation/)
  assert.match(text, /code example/)
  assert.doesNotMatch(
    text,
    /<|>|aria-label|overflow-x-auto|\/assets\/|hidden_example|&amp;/,
  )
})

test('omits HTML code listings and separates adjacent prose blocks', () => {
  const text = narratePost(
    'Title',
    '<details><summary>Optional lab</summary><p>Use <code>COMMIT</code>.</p><pre><code>SELECT hidden_example;</code></pre></details>',
    'en',
  )
  assert.match(text, /Optional lab\n\nUse COMMIT\./)
  assert.doesNotMatch(text, /SELECT|hidden_example/)
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
