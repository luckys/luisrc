const roles = new Set(['reader', 'editor', 'admin'])
const states = new Set(['draft', 'published', 'archived'])

export function can(context, action, document) {
  if (!context?.subject || !context.tenantId || !roles.has(context.role)) return false
  if (!document?.ownerId || !states.has(document.state)) return false
  if (context.tenantId !== document.tenantId) return false
  const owns = document.ownerId === context.subject
  if (action === 'read')
    return document.state === 'published' || owns || context.role === 'admin'
  if (action === 'write')
    return (
      document.state === 'draft' &&
      (context.role === 'admin' || (context.role === 'editor' && owns))
    )
  return false
}
