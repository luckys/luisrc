import { Circle, Txt, makeScene2D } from '@motion-canvas/2d'
import { all, createRef, waitFor } from '@motion-canvas/core'

export default makeScene2D(function* (view) {
  const document = createRef<Circle>()
  view.fill('#1a1b26')
  view.add(<Txt text="Documento → OCR → RAG" y={-160} fill="#c0caf5" fontSize={56} />)
  view.add(<Circle ref={document} x={-400} size={100} fill="#7aa2f7" />)
  yield* waitFor(0.5)
  yield* document().position.x(0, 1)
  yield* all(document().position.x(400, 1), document().fill('#9ece6a', 1))
  yield* waitFor(0.5)
})
