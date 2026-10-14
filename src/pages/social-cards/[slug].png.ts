import siteConfig from '~/site.config'
import { Resvg } from '@resvg/resvg-js'
import type { APIContext, InferGetStaticPropsType } from 'astro'
import satori, { type SatoriOptions } from 'satori'
import { html } from 'satori-html'
import { getPostSlug, getSortedPosts, resolveThemeColorStyles } from '~/utils'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import type { ReactNode } from 'react'

// Load the font file as binary data
const fontPath = path.resolve(
  './node_modules/@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf',
)
const fontData = fs.readFileSync(fontPath) // Reads the file as a Buffer

const avatarPath = path.resolve(siteConfig.socialCardAvatarImage)
let avatarData: Buffer | undefined
let avatarBase64: string | undefined
const avatarExtension = path.extname(avatarPath).toLowerCase()
if (fs.existsSync(avatarPath) && ['.jpg', '.jpeg', '.webp'].includes(avatarExtension)) {
  const sourceAvatar = fs.readFileSync(avatarPath)
  avatarData =
    avatarExtension === '.webp'
      ? await sharp(sourceAvatar)
          .resize({ width: 512, height: 512, fit: 'cover' })
          .jpeg({ quality: 65 })
          .toBuffer()
      : sourceAvatar
  avatarBase64 = `data:image/jpeg;base64,${avatarData.toString('base64')}`
}

const defaultTheme =
  siteConfig.themes.default === 'auto'
    ? siteConfig.themes.include[0]
    : siteConfig.themes.default

const themeStyles = await resolveThemeColorStyles(
  [defaultTheme],
  siteConfig.themes.overrides,
)
const bg = themeStyles[defaultTheme]?.background
const fg = themeStyles[defaultTheme]?.foreground
const accent = themeStyles[defaultTheme]?.accent

if (!bg || !fg || !accent) {
  throw new Error(`Theme ${defaultTheme} does not have required colors`)
}

const ogOptions: SatoriOptions = {
  // debug: true,
  fonts: [
    {
      data: fontData,
      name: 'JetBrains Mono',
      style: 'normal',
      weight: 400,
    },
  ],
  height: 630,
  width: 1200,
}

const markup = (title: string, pubDate: string | undefined, author: string) =>
  html(`<div tw="flex flex-col max-w-full justify-center h-full bg-[${bg}] text-[${fg}] p-12">
    <div style="border-width: 12px; border-radius: 80px;" tw="flex items-center w-full h-full p-8 border-[${accent}]/30">
      ${
        avatarBase64
          ? `<div tw="flex flex-col justify-center items-center w-1/3 h-100">
            <img src="${avatarBase64}" tw="flex w-full rounded-full border-[${accent}]/30" />
        </div>`
          : ''
      }
      <div tw="flex flex-1 flex-col max-w-full justify-center items-center">
        ${pubDate ? `<p tw="text-3xl max-w-full text-[${accent}]">${pubDate}</p>` : ''}
        <h1 style="font-size: ${title.length > 100 ? 36 : title.length > 60 ? 42 : 52}px;" tw="my-6 text-center leading-snug">${title}</h1>
        ${author !== title ? `<p tw="text-2xl text-[${accent}]">${author}</p>` : ''}
      </div>
    </div>
  </div>`)

type Props = InferGetStaticPropsType<typeof getStaticPaths>

export async function GET(context: APIContext) {
  const { pubDate, title, author } = context.props as Props
  const svg = await satori(markup(title, pubDate, author) as ReactNode, ogOptions)
  const png = new Resvg(svg).render().asPng()
  return new Response(png, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/png',
    },
  })
}

export async function getStaticPaths() {
  const posts = (await Promise.all([getSortedPosts('es'), getSortedPosts('en')])).flat()
  return posts
    .map((post) => ({
      params: {
        slug: post.data.locale === 'en' ? `en-${getPostSlug(post)}` : getPostSlug(post),
      },
      props: {
        pubDate: post.data.published.toLocaleDateString(
          post.data.locale === 'en' ? 'en-US' : 'es-ES',
          { dateStyle: 'long', timeZone: 'UTC' },
        ),
        title: post.data.title,
        author: post.data.author || siteConfig.author,
      },
    }))
    .concat([
      {
        params: { slug: '__default' },
        props: { pubDate: undefined, title: siteConfig.title, author: siteConfig.author },
      },
    ])
}
