import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approvedPair, readPost } from '../scripts/generate-post-audio.mjs'
import { generatePair } from '../scripts/generate-post-audio.mjs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

test('reads YAML frontmatter without including metadata in narration', () => {
  assert.deepEqual(readPost('---\ntitle: Title\nlocale: es\n---\n\nText'), {
    title: 'Title',
    locale: 'es',
    body: 'Text',
  })
})

test('requires a complete non-draft pair before calling the service', () => {
  const posts = ['es', 'en'].map((locale) => ({
    locale,
    title: 'Title',
    body: 'Text',
    translationKey: 'test',
    draft: false,
  }))
  assert.equal(approvedPair(posts, 'test').length, 2)
  assert.throws(() => approvedPair(posts.slice(0, 1), 'test'), /translation/)
  assert.throws(
    () => approvedPair([{ ...posts[0], draft: true }, posts[1]], 'test'),
    /draft/,
  )
  assert.throws(() => approvedPair([...posts, posts[0]], 'test'), /translation/)
})

test('allows explicitly requested draft narration without publishing the posts', () => {
  const posts = ['es', 'en'].map((locale) => ({
    locale,
    title: 'Title',
    body: 'Text',
    translationKey: 'test',
    draft: true,
  }))
  assert.throws(() => approvedPair(posts, 'test'), /draft/)
  const pair = approvedPair(posts, 'test', { includeDrafts: true })
  assert.ok(pair.every((post) => post.draft === true))
  assert.throws(
    () =>
      approvedPair([{ ...posts[0], body: '' }, posts[1]], 'test', {
        includeDrafts: true,
      }),
    /complete/,
  )
})

test('saves both MP3s, reuses current files, and leaves manifest unchanged on failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blog-audio-test-'))
  try {
    const fixture = join(directory, 'fixture.mp3')
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=24000:cl=mono',
      '-t',
      '1',
      fixture,
    ])
    const bytes = await readFile(fixture)
    const pair = ['es', 'en'].map((locale) => ({
      locale,
      title: 'Title',
      body: 'Text',
      translationKey: 'test',
    }))
    const calls = []
    const manifest = await generatePair(pair, {}, directory, async (_, voice) => {
      calls.push(voice)
      return bytes
    })
    assert.deepEqual(calls, ['es-ES-AlvaroNeural', 'en-US-AndrewNeural'])
    for (const entry of Object.values(manifest.test)) {
      assert.ok((await readFile(join(directory, 'public', entry.src))).length > 0)
    }
    await generatePair(pair, manifest, directory, () => {
      throw new Error('Should reuse files')
    })
    const before = JSON.stringify(manifest)
    await assert.rejects(
      generatePair(
        pair.map((post) => ({ ...post, body: 'Changed' })),
        manifest,
        directory,
        async () => Buffer.alloc(0),
      ),
      /empty/,
    )
    assert.equal(JSON.stringify(manifest), before)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('retries transient failures and resumes completed chunks after an interrupted pair', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blog-audio-resume-test-'))
  try {
    const fixture = join(directory, 'fixture.mp3')
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=24000:cl=mono',
      '-t',
      '1',
      fixture,
    ])
    const bytes = await readFile(fixture)
    const pair = ['es', 'en'].map((locale) => ({
      locale,
      title: 'Title',
      body: 'Text',
      translationKey: 'resume',
    }))
    let failures = 0
    await assert.rejects(
      generatePair(pair, {}, directory, async (_, voice) => {
        if (voice.startsWith('en-')) {
          failures++
          throw new Error('Speech unavailable')
        }
        return bytes
      }),
      /unavailable/,
    )
    assert.equal(failures, 2)
    const resumedCalls = []
    const manifest = await generatePair(pair, {}, directory, async (_, voice) => {
      resumedCalls.push(voice)
      return bytes
    })
    assert.deepEqual(resumedCalls, ['en-US-AndrewNeural'])
    assert.equal(Object.keys(manifest.resume).length, 2)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
