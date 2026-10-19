export function createFixtures() {
  // Credenciales públicas de fixture: no son sesiones ni tokens de producción.
  const tokens = new Map(
    ['alice', 'bob', 'rita', 'trent', 'mallory'].map((name) => [
      `${name}-demo`,
      `user-${name}`,
    ]),
  )
  const key = (tenantId, id) => JSON.stringify([tenantId, id])
  const memberships = new Map([
    [key('north', 'user-alice'), 'editor'],
    [key('south', 'user-alice'), 'reader'],
    [key('north', 'user-bob'), 'editor'],
    [key('south', 'user-bob'), 'admin'],
    [key('north', 'user-rita'), 'reader'],
    [key('north', 'user-trent'), 'admin'],
  ])
  const documents = new Map(
    [
      ['north', 'shared', 'user-alice', 'draft', 'Draft de North'],
      ['north', 'bob-draft', 'user-bob', 'draft', 'Draft de Bob'],
      ['north', 'published', 'user-bob', 'published', 'Publicado en North'],
      ['north', 'archived', 'user-alice', 'archived', 'Archivado en North'],
      ['south', 'shared', 'user-bob', 'draft', 'Draft de South'],
      ['south', 'south-private', 'user-bob', 'draft', 'Privado de South'],
      ['south', 'south-published', 'user-bob', 'published', 'Publicado en South'],
    ].map(([tenantId, id, ownerId, state, title]) => [
      key(tenantId, id),
      {
        tenantId,
        id,
        ownerId,
        state,
        title,
        internalNote: 'No distribuir esta propiedad',
      },
    ]),
  )

  return {
    authenticate: (token) => tokens.get(token),
    membership: (subject, tenantId) => memberships.get(key(tenantId, subject)),
    setMembership(subject, tenantId, role) {
      if (role === null) memberships.delete(key(tenantId, subject))
      else memberships.set(key(tenantId, subject), role)
    },
    inTenant(tenantId) {
      return {
        find(id) {
          const row = documents.get(key(tenantId, id))
          return row && { ...row }
        },
        list: () =>
          [...documents.values()]
            .filter((row) => row.tenantId === tenantId)
            .map((row) => ({ ...row })),
        rename(id, title) {
          const row = documents.get(key(tenantId, id))
          if (!row) throw new Error('Missing scoped document')
          row.title = title
          return { ...row }
        },
      }
    },
  }
}
