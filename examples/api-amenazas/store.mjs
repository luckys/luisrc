import { DatabaseSync } from 'node:sqlite'
import { invalidInput } from './command.mjs'

const columns = { id: 'id', title: 'title' }
const projection =
  'id, tenant_id AS tenantId, owner_id AS ownerId, state, title, internal_note AS internalNote'

export function createStore() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE documents (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL, owner_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('draft', 'published')),
      title TEXT NOT NULL, internal_note TEXT NOT NULL,
      PRIMARY KEY (tenant_id, id)
    ) STRICT;
  `)
  const insert = db.prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?)')
  insert.run('north', 'd1', 'alice', 'draft', "O'Reilly", 'Nota ficticia North')
  insert.run('north', 'd2', 'bob', 'draft', 'Guía de Bob', 'Otra nota ficticia')
  insert.run('south', 'd1', 'bob', 'draft', 'Privado South', 'Nota ficticia South')
  return {
    close: () => db.close(),
    get(tenantId, id) {
      const row = db
        .prepare(`SELECT ${projection} FROM documents WHERE tenant_id = ? AND id = ?`)
        .get(tenantId, id)
      return row ? { ...row } : undefined
    },
    list(tenantId) {
      return db
        .prepare('SELECT id, title FROM documents WHERE tenant_id = ? ORDER BY id')
        .all(tenantId)
        .map((row) => ({ ...row }))
    },
    save(original, next) {
      db.prepare(
        'UPDATE documents SET title = ?, owner_id = ?, state = ?, tenant_id = ?, internal_note = ? WHERE tenant_id = ? AND id = ?',
      ).run(
        next.title,
        next.ownerId,
        next.state,
        next.tenantId,
        next.internalNote,
        original.tenantId,
        original.id,
      )
    },
    changeTitle(tenantId, id, subject, title) {
      return (
        db
          .prepare(
            "UPDATE documents SET title = ? WHERE tenant_id = ? AND id = ? AND owner_id = ? AND state = 'draft'",
          )
          .run(title, tenantId, id, subject).changes === 1
      )
    },
    search(tenantId, title, sort) {
      if (!Object.hasOwn(columns, sort)) throw invalidInput()
      const column = columns[sort]
      return db
        .prepare(
          `SELECT id, title FROM documents WHERE tenant_id = ? AND title = ? ORDER BY ${column}, id`,
        )
        .all(tenantId, title)
    },
    unsafeSearch(tenantId, title) {
      // Intencionadamente vulnerable: el input cambia la sintaxis del WHERE.
      return db
        .prepare(
          `SELECT id, title FROM documents WHERE tenant_id = '${tenantId}' AND title = '${title}' ORDER BY id`,
        )
        .all()
    },
    searchWithoutTenant(title) {
      // Parametrizar no añade el ámbito que esta consulta ha omitido.
      return db.prepare('SELECT id, title FROM documents WHERE title = ?').all(title)
    },
  }
}
