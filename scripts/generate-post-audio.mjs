import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  mkdtemp,
  rename,
  rm,
  stat,
} from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { parse } from 'yaml'
import {
  voices,
  narratePost,
  splitNarration,
  audioFingerprint,
} from '../src/lib/post-audio.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

export function chunkFingerprint(text, voice) {
  return createHash('sha256').update(JSON.stringify({ text, voice })).digest('hex')
}

export function synthesizeSpeech(text, voice) {
  // https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback
  return new Promise((resolve, reject) => {
    const worker = fileURLToPath(new URL('./synthesize-speech.mjs', import.meta.url))
    const child = execFile(
      process.execPath,
      [worker, voice],
      {
        timeout: 120_000,
        killSignal: 'SIGKILL',
        maxBuffer: 10_000_000,
        encoding: 'buffer',
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    )
    child.stdin.on('error', reject)
    child.stdin.end(text)
  })
}

export function readPost(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source)
  if (!match) throw new Error('Missing frontmatter')
  return { ...parse(match[1]), body: match[2].trim() }
}

export function approvedPair(posts, key, { includeDrafts = false } = {}) {
  const pair = ['es', 'en'].map((locale) => {
    const matches = posts.filter(
      (post) => post.translationKey === key && post.locale === locale,
    )
    if (matches.length !== 1)
      throw new Error(`Expected one ${locale} translation for ${key}`)
    const post = matches[0]
    if (!post.title || !post.body || (post.draft === true && !includeDrafts))
      throw new Error(`Post ${locale} must be complete and not a draft`)
    return post
  })
  return pair
}

export async function generatePair(
  pair,
  manifest,
  directory = root,
  synthesize = synthesizeSpeech,
) {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  const temporary = await mkdtemp(join(tmpdir(), 'blog-narration-'))
  const cache = join(directory, '.cache/post-audio')
  await mkdir(cache, { recursive: true })
  const updates = {}
  try {
    for (const post of pair) {
      const fingerprint = audioFingerprint(post.title, post.body, post.locale)
      const src = `/assets/audio/${post.locale}-${fingerprint}.mp3`
      const destination = join(directory, 'public', src)
      const previous = manifest[post.translationKey]?.[post.locale]
      if (
        previous?.fingerprint === fingerprint &&
        previous.src === src &&
        (await stat(destination)
          .then((file) => file.size > 0)
          .catch(() => false))
      ) {
        updates[post.locale] = previous
        console.log(`${post.locale}: audio up to date`)
        continue
      }
      const chunks = splitNarration(narratePost(post.title, post.body, post.locale))
      const files = []
      for (const [index, text] of chunks.entries()) {
        console.log(`${post.locale}: ${index + 1}/${chunks.length}`)
        const cachedFile = join(
          cache,
          `${chunkFingerprint(text, voices[post.locale])}.mp3`,
        )
        let bytes = await readFile(cachedFile).catch(() => undefined)
        if (!bytes?.length) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              bytes = await synthesize(text, voices[post.locale])
              break
            } catch (error) {
              if (attempt === 2) throw error
              console.warn(
                `${post.locale}: retrying fragment ${index + 1} after speech failure`,
              )
            }
          }
        }
        if (!bytes?.length) throw new Error('Speech service returned empty audio')
        await writeFile(`${cachedFile}.tmp`, bytes)
        await rename(`${cachedFile}.tmp`, cachedFile)
        const name = `${post.locale}-${index}.mp3`
        await writeFile(join(temporary, name), bytes)
        files.push(`file '${name}'`)
      }
      const list = join(temporary, `${post.locale}.txt`)
      const merged = join(temporary, `${post.locale}.mp3`)
      await writeFile(list, files.join('\n'))
      // Remux instead of concatenating bytes: valid duration and seeking metadata.
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        list,
        '-c:a',
        'copy',
        merged,
      ])
      execFileSync('ffmpeg', ['-v', 'error', '-i', merged, '-f', 'null', '-'], {
        stdio: 'pipe',
      })
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(`${destination}.tmp`, await readFile(merged))
      await rename(`${destination}.tmp`, destination)
      updates[post.locale] = { src, fingerprint, voice: voices[post.locale] }
    }
    // Publish the manifest only once both translations have succeeded.
    return { ...manifest, [pair[0].translationKey]: updates }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function main() {
  const [key, ...flags] = process.argv.slice(2)
  if (
    !key ||
    !flags.includes('--approved') ||
    flags.some((flag) => !['--approved', '--include-drafts'].includes(flag))
  ) {
    throw new Error(
      'Usage: pnpm audio:generate <translationKey> --approved [--include-drafts] (only after author approval)',
    )
  }
  const posts = []
  for (const locale of ['es', 'en']) {
    const directory = join(root, 'src/content/posts', locale)
    for (const name of await readdir(directory)) {
      if (name.endsWith('.md'))
        posts.push(readPost(await readFile(join(directory, name), 'utf8')))
    }
  }
  const pair = approvedPair(posts, key, {
    includeDrafts: flags.includes('--include-drafts'),
  })
  const manifestPath = join(root, 'src/data/post-audio.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const updated = await generatePair(pair, manifest)
  await writeFile(`${manifestPath}.tmp`, `${JSON.stringify(updated, null, 2)}\n`)
  await rename(`${manifestPath}.tmp`, manifestPath)
  console.log('Both recordings saved in public/assets/audio/')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
