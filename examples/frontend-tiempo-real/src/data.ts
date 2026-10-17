export function windowRange(
  total: number,
  scrollTop: number,
  height: number,
  rowHeight: number,
  overscan: number,
) {
  if (
    ![total, scrollTop, height, rowHeight, overscan].every(Number.isFinite) ||
    total < 0 ||
    scrollTop < 0 ||
    height < 0 ||
    rowHeight <= 0 ||
    overscan < 0 ||
    !Number.isInteger(total) ||
    !Number.isInteger(overscan)
  )
    throw new Error('invalid range')
  const first = Math.min(total, Math.floor(scrollTop / rowHeight))
  return {
    start: Math.max(0, first - overscan),
    end: Math.min(total, Math.ceil((scrollTop + height) / rowHeight) + overscan),
  }
}

export type Selection =
  | { kind: 'explicit'; ids: Set<string> }
  | { kind: 'all'; filter: string; excluded: Set<string> }

export function selectionIncludes(selection: Selection, id: string, filter: string) {
  if (selection.kind === 'explicit') return selection.ids.has(id)
  return selection.filter === filter && !selection.excluded.has(id)
}

export function acceptEvent(last: number, next: number) {
  if (next <= last) return 'duplicate'
  return next === last + 1 ? 'apply' : 'resync'
}
