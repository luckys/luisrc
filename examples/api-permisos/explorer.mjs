import { can } from './policy.mjs'

const fields = Object.fromEntries(
  ['role', 'action', 'owner', 'state', 'tenant'].map((id) => [
    id,
    document.getElementById(id),
  ]),
)

function update() {
  const context = { subject: 'alice', tenantId: 'north', role: fields.role.value }
  const resource = {
    tenantId: fields.tenant.value,
    ownerId: fields.owner.value,
    state: fields.state.value,
  }
  const allowed = can(context, fields.action.value, resource)
  const result = document.getElementById('result')
  result.textContent = allowed ? 'Permitido' : 'Denegado'
  result.dataset.allowed = String(allowed)
  document.getElementById('reason').textContent = allowed
    ? 'Coinciden el tenant y las reglas de lectura o edición para este rol, propietario y estado.'
    : 'La operación no cumple la política. Admin tampoco salta el tenant ni permite editar documentos publicados o archivados.'
}

for (const field of Object.values(fields)) field.addEventListener('change', update)
document.getElementById('reset').addEventListener('click', () => {
  for (const [id, value] of Object.entries({
    role: 'editor',
    action: 'write',
    owner: 'alice',
    state: 'draft',
    tenant: 'north',
  }))
    fields[id].value = value
  update()
})
update()
