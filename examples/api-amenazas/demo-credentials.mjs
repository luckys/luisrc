import { observeRotation } from './observe-credentials.mjs'
const evidence = await observeRotation()
console.table(evidence.observations)
console.log(JSON.stringify(evidence.events))
