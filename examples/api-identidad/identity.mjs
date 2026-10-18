import { jwtVerify } from 'jose'

export async function verifyIdentityToken(token, { issuer, audience, nonce, jwks }) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience,
    algorithms: ['RS256'],
    requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp', 'nonce'],
    maxTokenAge: '10m',
    clockTolerance: 0,
  })
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('invalid_sub')
  if (typeof nonce !== 'string' || !nonce || payload.nonce !== nonce)
    throw new Error('invalid_nonce')
  if (Array.isArray(payload.aud) && payload.aud.length > 1 && !payload.azp)
    throw new Error('missing_azp')
  if (payload.azp !== undefined && payload.azp !== audience)
    throw new Error('invalid_azp')
  return payload
}
