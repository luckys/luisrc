export function invalidInput() {
  return Object.assign(new Error('invalid_input'), { status: 422 })
}

export function parseTitleChange(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidInput()
  const keys = Object.keys(input)
  if (keys.length !== 1 || keys[0] !== 'title') throw invalidInput()
  if (typeof input.title !== 'string') throw invalidInput()
  const title = input.title.trim()
  if (title.length < 1 || title.length > 120) throw invalidInput()
  return { title }
}

// Variante vulnerable: solo para comparar en el sandbox y en el visor sin red.
export function unsafeAssign(document, input) {
  return { ...document, ...input }
}

export function simulateAssignment(mode, input) {
  const before = {
    id: 'd1',
    tenantId: 'north',
    ownerId: 'alice',
    state: 'draft',
    title: 'Original',
  }
  try {
    const after =
      mode === 'unsafe'
        ? unsafeAssign(before, input)
        : { ...before, ...parseTitleChange(input) }
    return { status: 200, before, after }
  } catch (error) {
    if (error.status !== 422) throw error
    return { status: 422, before, after: { ...before } }
  }
}
