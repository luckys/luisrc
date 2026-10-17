export type Order = { id: string; name: string; version: number }

export class LatestRequest<T> {
  private generation = 0
  private controller?: AbortController

  async run(load: (signal: AbortSignal) => Promise<T>, commit: (value: T) => void) {
    this.controller?.abort()
    const generation = ++this.generation
    const controller = new AbortController()
    this.controller = controller
    try {
      const value = await load(controller.signal)
      if (generation === this.generation) commit(value)
    } catch (error) {
      if (generation === this.generation && !controller.signal.aborted) throw error
    }
  }

  cancel() {
    ++this.generation
    this.controller?.abort()
  }
}

export async function optimisticRename(
  get: () => Order,
  set: (order: Order) => void,
  name: string,
  save: (order: Order) => Promise<Order>,
) {
  const previous = get()
  const optimistic = { ...previous, name }
  set(optimistic)
  try {
    const canonical = await save(optimistic)
    if (get() === optimistic) set(canonical)
  } catch (error) {
    // No restaurar un snapshot sobre un valor que ya ha cambiado por otro camino.
    if (get() === optimistic) set(previous)
    throw error
  }
}
