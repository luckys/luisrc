export type State = 'created' | 'processing' | 'unknown' | 'succeeded' | 'failed'
export type Action = 'submit' | 'confirm' | 'decline' | 'uncertain'

const transitions: Record<State, Partial<Record<Action, State>>> = {
  created: { submit: 'processing' },
  processing: { confirm: 'succeeded', decline: 'failed', uncertain: 'unknown' },
  unknown: { confirm: 'succeeded', decline: 'failed', uncertain: 'unknown' },
  succeeded: { confirm: 'succeeded' },
  failed: { decline: 'failed' },
}

export function transition(state: State, action: Action): State {
  const next = transitions[state][action]
  if (next === undefined) throw new Error(`invalid_transition:${state}:${action}`)
  return next
}

export function reconcile(
  local: State,
  remote: 'succeeded' | 'failed' | 'pending' | 'not_found',
): State {
  if (local !== 'unknown') return local
  if (remote === 'succeeded') return transition(local, 'confirm')
  if (remote === 'failed') return transition(local, 'decline')
  return local
}

export function compensate(state: 'reserved' | 'released' | 'delivered'): 'released' {
  if (state === 'delivered') throw new Error('manual_review_required')
  return 'released'
}
