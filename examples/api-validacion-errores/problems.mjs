const definitions = {
  malformed_json: [400, 'JSON no válido'],
  invalid_input: [422, 'Revisa los campos de la solicitud'],
  not_found: [404, 'Recurso no encontrado'],
  method_not_allowed: [405, 'Método no permitido'],
  payload_too_large: [413, 'Cuerpo demasiado grande'],
  unsupported_media_type: [415, 'Se requiere application/json'],
  out_of_stock: [409, 'No hay unidades suficientes'],
  version_conflict: [409, 'El inventario ha cambiado'],
  dependency_unavailable: [503, 'Servicio temporalmente no disponible'],
  internal_error: [500, 'No se pudo completar la operación'],
}

export class ApiError extends Error {
  constructor(code, errors) {
    if (!Object.hasOwn(definitions, code)) throw new Error('Unknown problem code')
    super(code)
    this.code = code
    this.errors = errors
  }
}

export function toProblem(error, requestId) {
  const code = error instanceof ApiError ? error.code : 'internal_error'
  const [status, title] = definitions[code]
  return {
    type: `urn:api-lab:problem:${code}`,
    title,
    status,
    code,
    instance: `urn:uuid:${requestId}`,
    requestId,
    ...(code === 'invalid_input' ? { errors: error.errors } : {}),
  }
}
