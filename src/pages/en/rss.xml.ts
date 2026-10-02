import type { APIRoute } from 'astro'
import { createRssFeed } from '~/utils/rss-feed'

export const GET: APIRoute = () => createRssFeed('en')
