export function timeline(interval) {
  if (!Number.isInteger(interval) || interval < 1 || interval > 10)
    throw new Error('invalid_interval')
  const changes = [2, 5, 9]
  const horizon = 12
  const polls = []
  for (let time = 0; time <= horizon; time += interval)
    polls.push({ time, version: 1 + changes.filter((change) => change <= time).length })
  return {
    horizon,
    changes,
    polls,
    observations: changes.map((change) => ({
      changedAt: change,
      observedAt: polls.find((poll) => poll.time >= change)?.time ?? null,
    })),
  }
}
