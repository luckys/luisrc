import http from 'node:http'
import https from 'node:https'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import Provider from 'oidc-provider'
import * as oidc from 'openid-client'
import { generateKeyPair, exportJWK, createRemoteJWKSet } from 'jose'
import { Sessions, secret, digest } from './state.mjs'
import { verifyIdentityToken } from './identity.mjs'

const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
const cookies = (header = '') =>
  Object.fromEntries(
    header.split(';').map((part) => {
      const [name, ...value] = part.trim().split('=')
      return [name, value.join('=')]
    }),
  )
const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
const stop = (server) =>
  new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections()
  })

export async function startLab({ signingJwk } = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'api-identity-'))
  const keyPath = join(folder, 'key.pem')
  const certPath = join(folder, 'cert.pem')
  let rp
  let op
  const close = async () => {
    if (rp) await stop(rp)
    if (op) await stop(op)
    for (const file of [keyPath, certPath]) await unlink(file).catch(() => {})
    await rmdir(folder)
  }
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-days',
        '1',
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
      ],
      { stdio: 'ignore', timeout: 10000 },
    )
    const certificate = await readFile(certPath)
    const sessions = new Sessions()
    const pending = new Map()
    let handler
    rp = https.createServer(
      { key: await readFile(keyPath), cert: certificate },
      (req, res) => handler(req, res),
    )
    await listen(rp)
    const origin = `https://127.0.0.1:${rp.address().port}`
    let providerHandler
    op = http.createServer((req, res) => providerHandler(req, res))
    await listen(op)
    const issuer = `http://127.0.0.1:${op.address().port}`
    if (!signingJwk) {
      const { privateKey } = await generateKeyPair('RS256', { extractable: true })
      signingJwk = {
        ...(await exportJWK(privateKey)),
        kid: 'ephemeral',
        use: 'sig',
        alg: 'RS256',
      }
    }
    const provider = new Provider(issuer, {
      clients: [
        {
          client_id: 'blog-lab',
          redirect_uris: [`${origin}/callback`],
          response_types: ['code'],
          grant_types: ['authorization_code'],
          token_endpoint_auth_method: 'none',
          id_token_signed_response_alg: 'RS256',
        },
      ],
      jwks: { keys: [signingJwk] },
      cookies: { keys: [secret()] },
      pkce: { required: () => true },
      claims: { openid: ['sub'] },
      findAccount: async (_ctx, id) => ({
        accountId: id,
        claims: async () => ({ sub: id }),
      }),
      features: { devInteractions: { enabled: true } },
    })
    providerHandler = provider.callback()
    const config = await oidc.discovery(
      new URL(issuer),
      'blog-lab',
      undefined,
      oidc.None(),
      {
        execute: [oidc.allowInsecureRequests], // Solo OP privado HTTP en loopback.
      },
    )
    const jwks = createRemoteJWKSet(new URL(config.serverMetadata().jwks_uri))
    handler = async (req, res) => {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      const url = new URL(req.url, origin)
      const jar = cookies(req.headers.cookie)
      const reply = (status, data = '') => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(data ? JSON.stringify(data) : '')
      }
      try {
        if (url.pathname === '/login' && req.method === 'GET') {
          for (const [id, flow] of pending)
            if (flow.expiresAt <= Date.now()) pending.delete(id)
          pending.delete(digest(jar['__Host-login']))
          const handle = secret()
          const verifier = oidc.randomPKCECodeVerifier()
          const flow = {
            verifier,
            state: oidc.randomState(),
            nonce: secret(),
            expiresAt: Date.now() + 5 * 60_000,
          }
          pending.set(digest(handle), flow)
          const location = oidc.buildAuthorizationUrl(config, {
            redirect_uri: `${origin}/callback`,
            scope: 'openid',
            state: flow.state,
            nonce: flow.nonce,
            code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
            code_challenge_method: 'S256',
          })
          res.writeHead(302, {
            Location: location.href,
            'Set-Cookie': cookie('__Host-login', handle, 300),
          })
          return res.end()
        }
        if (url.pathname === '/callback' && req.method === 'GET') {
          const key = digest(jar['__Host-login'])
          const flow = pending.get(key)
          pending.delete(key) // Consumir también en caso de error: no aceptar replay.
          res.setHeader('Set-Cookie', cookie('__Host-login', '', 0))
          if (!flow || flow.expiresAt <= Date.now())
            return reply(400, { error: 'login_failed' })
          const tokens = await oidc.authorizationCodeGrant(config, url, {
            pkceCodeVerifier: flow.verifier,
            expectedState: flow.state,
            expectedNonce: flow.nonce,
          })
          const claims = await verifyIdentityToken(tokens.id_token, {
            issuer,
            audience: 'blog-lab',
            nonce: flow.nonce,
            jwks,
          })
          const sid = sessions.establish(
            { issuer: claims.iss, sub: claims.sub },
            jar['__Host-sid'],
          )
          res.writeHead(303, {
            Location: '/',
            'Set-Cookie': [
              cookie('__Host-login', '', 0),
              cookie('__Host-sid', sid, 1800),
            ],
          })
          return res.end()
        }
        if (url.pathname === '/me' && req.method === 'GET') {
          const identity = sessions.read(jar['__Host-sid'])
          return reply(identity ? 200 : 401, identity ?? { error: 'unauthenticated' })
        }
        if (url.pathname === '/logout' && req.method === 'POST') {
          if (req.headers.origin !== origin)
            return reply(403, { error: 'origin_rejected' })
          sessions.revoke(jar['__Host-sid'])
          res.setHeader('Set-Cookie', cookie('__Host-sid', '', 0))
          return reply(204)
        }
        if (url.pathname === '/' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy':
              "default-src 'none'; connect-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
          })
          return res.end(
            '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Identidad: laboratorio local</title><body style="background:#111;color:#eee;font:18px system-ui;max-width:42rem;margin:2rem auto;padding:1rem"><h1>Identidad: laboratorio local</h1><p>Proveedor de desarrollo: cualquier nombre sirve, no valida una contraseña ni MFA. No utilizar con cuentas reales.</p><p><a style="color:#9cf" href="/login">Iniciar sesión de prueba</a> · <a style="color:#9cf" href="/me">Consultar sesión</a></p><form method="post" action="/logout"><button>Cerrar sesión local</button></form></body></html>',
          )
        }
        return reply(404, { error: 'not_found' })
      } catch {
        return reply(400, { error: 'login_failed' })
      }
    }
    return { origin, issuer, certificate, jwks, close }
  } catch (error) {
    await close()
    throw error
  }
}
