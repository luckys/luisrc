---
title: 'Entender los closures en JavaScript'
published: 2025-07-01
locale: es
translationKey: understanding-closures-in-javascript
slug: cierres-en-javascript
draft: false
description: 'Una introducción a los closures y sus usos habituales en JavaScript.'
tags: ['javascript']
---

Un *closure* (cierre) aparece cuando una función conserva acceso al ámbito en el que fue creada, incluso después de que la función externa haya terminado.

```js
function createCounter() {
  let count = 0
  return () => ++count
}

const counter = createCounter()
counter() // 1
counter() // 2
```

La función devuelta mantiene una referencia a `count`. Cada contador creado de esta forma tiene su propio estado privado, sin necesitar una variable global.

Los closures también son útiles para crear funciones configurables y callbacks que necesitan conservar datos entre llamadas. Conviene usarlos con cuidado cuando retienen objetos grandes: mientras el closure siga accesible, también seguirá accesible su entorno.
