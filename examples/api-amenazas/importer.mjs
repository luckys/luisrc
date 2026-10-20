import { get } from 'node:http'
import { invalidInput } from './command.mjs'

const forbidden = () =>
  Object.assign(new Error('destination_not_allowed'), { status: 403 })
const upstream = (status = 502) =>
  Object.assign(new Error('upstream_failure'), { status })
const catalog = {
  north: {
    a1: '/asset/north/a1',
    redirect: '/redirect',
    large: '/large',
    silent: '/silent',
  },
  south: { b1: '/asset/south/b1' },
}

export function destinationForReference(tenantId, input, providerOrigin) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidInput()
  if (Object.keys(input).length !== 1 || typeof input.reference !== 'string')
    throw invalidInput()
  if (!/^[a-z0-9-]{1,32}$/.test(input.reference)) throw invalidInput()
  if (
    !Object.hasOwn(catalog, tenantId) ||
    !Object.hasOwn(catalog[tenantId], input.reference)
  )
    throw forbidden()
  return new URL(catalog[tenantId][input.reference], providerOrigin)
}

export function parseProviderUrl(value, providerOrigin) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw forbidden()
  }
  if (
    url.protocol !== new URL(providerOrigin).protocol ||
    url.origin !== providerOrigin ||
    url.username ||
    url.password ||
    url.hash
  )
    throw forbidden()
  return url
}

function abortable(task, signal) {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(task)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort))
  })
}

export async function approvedAddress(url, resolve, signal) {
  const records = await abortable(resolve(url.hostname), signal)
  // Política exclusiva del fixture. En producción no se permite este loopback.
  if (
    !records.length ||
    records.some((row) => row.family !== 4 || row.address !== '127.0.0.1')
  )
    throw forbidden()
  return { ...records[0] }
}

function nodeLookup(resolve) {
  return (hostname, options, callback) => {
    Promise.resolve()
      .then(() => resolve(hostname))
      .then((records) => {
        // Guardia del sandbox: ni los clientes vulnerables salen de estas dos IP.
        if (
          !records.length ||
          records.some(
            (row) =>
              row.family !== 4 || !['127.0.0.1', '127.0.0.2'].includes(row.address),
          )
        )
          throw forbidden()
        if (options.all) callback(null, records)
        else callback(null, records[0].address, records[0].family)
      })
      .catch(callback)
  }
}

function readResponse(url, lookup, signal) {
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        lookup,
        signal,
        agent: false,
        family: 4,
        autoSelectFamily: false,
        headers: { accept: 'text/plain' },
      },
      (response) => {
        const chunks = []
        let bytes = 0
        response.on('data', (chunk) => {
          bytes += chunk.length
          if (bytes > 1024) {
            const error = upstream()
            reject(error)
            request.destroy(error)
            return
          }
          chunks.push(chunk)
        })
        response.once('error', () => reject(signal.aborted ? signal.reason : upstream()))
        response.once('end', () =>
          resolve({
            status: response.statusCode,
            location: response.headers.location,
            text: Buffer.concat(chunks).toString('utf8'),
          }),
        )
      },
    )
    request.once('error', (error) =>
      reject(signal.aborted ? signal.reason : error.status ? error : upstream()),
    )
  })
}

export function createImporter({ providerOrigin, internalOrigin, resolve }) {
  const provider = new URL(providerOrigin)
  const internal = new URL(internalOrigin)
  if (
    provider.hostname !== 'media.fixture.test' ||
    internal.hostname !== '127.0.0.2' ||
    provider.port !== internal.port ||
    provider.protocol !== 'http:' ||
    internal.protocol !== 'http:'
  )
    throw forbidden()
  const harnessOrigins = new Set([providerOrigin, internalOrigin])
  const checkHarness = (url) => {
    // No es una defensa de producto: hace seguro ejecutar las variantes malas.
    if (
      url.protocol !== provider.protocol ||
      !harnessOrigins.has(url.origin) ||
      url.username ||
      url.password
    )
      throw forbidden()
  }
  const exchange = async (url, lookup, signal, follow) => {
    for (let hop = 0; hop < 3; hop++) {
      checkHarness(url)
      const response = await readResponse(url, lookup, signal)
      if (response.status >= 300 && response.status < 400) {
        if (!follow || !response.location) throw upstream()
        url = new URL(response.location, url)
        continue
      }
      if (response.status !== 200) throw upstream()
      return { text: response.text }
    }
    throw upstream()
  }
  return async ({ tenantId, mode, input }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(upstream(504)), 1000)
    const signal = controller.signal
    try {
      if (['unsafe-url', 'allowlist-only'].includes(mode)) {
        if (!input || typeof input.url !== 'string' || Object.keys(input).length !== 1)
          throw invalidInput()
        let url
        if (mode === 'allowlist-only') url = parseProviderUrl(input.url, providerOrigin)
        else {
          try {
            url = new URL(input.url)
          } catch {
            throw forbidden()
          }
        }
        return await exchange(url, nodeLookup(resolve), signal, true)
      }
      if (!['safe', 'check-then-resolve'].includes(mode)) throw invalidInput()
      const url = destinationForReference(tenantId, input, providerOrigin)
      const address = await approvedAddress(url, resolve, signal)
      if (mode === 'check-then-resolve')
        return await exchange(url, nodeLookup(resolve), signal, false)
      const pinned = nodeLookup(async (hostname) => {
        if (hostname !== url.hostname) throw forbidden()
        return [address]
      })
      return await exchange(url, pinned, signal, false)
    } finally {
      clearTimeout(timer)
    }
  }
}
