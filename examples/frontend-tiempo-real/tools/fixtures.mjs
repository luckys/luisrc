// Solo el servidor conserva la colección completa.
export const deliveries = Array.from({ length: 100000 }, (_, index) => ({
  id: `d${index + 1}`,
  name: `Entrega ${index + 1}`,
}))
