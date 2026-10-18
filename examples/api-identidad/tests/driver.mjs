import http from 'node:http'
import https from 'node:https'
import assert from 'node:assert/strict'

// Driver de protocolo: NO implementa las políticas SameSite/HttpOnly del navegador.
export class BrowserDriver {
  cookies = new Map()
  constructor(ca) {
    this.ca = ca
  }

  async request(input, { method = 'GET', headers = {}, body } = {}) {
    const url = new URL(input)
    const hostCookies = this.cookies.get(url.origin) ?? new Map()
    return new Promise((resolve, reject) => {
      const req = (url.protocol === 'https:' ? https : http).request(
        url,
        {
          method,
          ca: this.ca,
          headers: {
            cookie: [...hostCookies].map(([k, v]) => `${k}=${v}`).join('; '),
            ...headers,
          },
        },
        (res) => {
          for (const entry of res.headers['set-cookie'] ?? []) {
            const [name, ...value] = entry.split(';')[0].split('=')
            if (/Max-Age=0(?:;|$)/i.test(entry)) hostCookies.delete(name)
            else hostCookies.set(name, value.join('='))
          }
          this.cookies.set(url.origin, hostCookies)
          let data = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () =>
            resolve({ status: res.statusCode, headers: res.headers, body: data }),
          )
        },
      )
      req.on('error', reject)
      req.end(body)
    })
  }
}

export async function authorize(driver, input) {
  let url = new URL(input)
  for (let step = 0; step < 12; step++) {
    if (url.pathname === '/callback') return url
    const response = await driver.request(url)
    if ([302, 303].includes(response.status)) {
      url = new URL(response.headers.location, url)
      continue
    }
    assert.equal(response.status, 200, response.body)
    const action = response.body.match(/<form[^>]+action="([^"]+)"/)[1]
    const prompt = response.body.includes('name="login"') ? 'login' : 'consent'
    const submitted = await driver.request(new URL(action, url), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ prompt, login: 'alice' }).toString(),
    })
    assert.ok([302, 303].includes(submitted.status), submitted.body)
    url = new URL(submitted.headers.location, url)
  }
  throw new Error('Too many provider steps')
}
