---
id: P074
title: 'CRDT y Yjs: editar sin conexión y volver a converger'
published: 2026-10-17T05:07:00Z
locale: es
translationKey: frontend-crdt-offline
slug: crdt-yjs-offline-convergencia
draft: true
status: draft
level: intermedio
prerequisites: [P073]
description: 'Convergencia, identidad y persistencia con dos pestañas Yjs que editan desconectadas y después intercambian updates.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, crdt, yjs, offline-first]
---

Dos personas abren una nota. Una escribe «A» sin conexión y otra añade «B» en su propia copia. Al reconectar, guardar el último documento recibido puede borrar una aportación, aunque ambas peticiones hayan terminado correctamente.

[Recuperar eventos después de un corte](/posts/sse-websockets-reconexion-eventos-perdidos) no decide cómo combinar ediciones concurrentes. Hace falta definir qué significa conservarlas.

## Convergencia no significa elegir la última cadena

Un registro **last-write-wins** elige un valor según una regla de orden. Puede servir para ciertos datos, pero en texto podría descartar una edición completa.

Un **CRDT**, o conflict-free replicated data type, utiliza estructura y reglas de combinación para que las réplicas converjan bajo determinadas condiciones. En texto, la cadena visible no contiene suficiente información: insertar antes de una posición cambia lo que esa posición significa en otra copia.

**Yjs** proporciona tipos compartidos como `Y.Text`. Sus updates representan cambios con identidades internas, no simplemente «el texto nuevo». Su [API de updates](https://docs.yjs.dev/api/document-updates) describe propiedades que permiten aplicarlos con repetición y distinto orden.

Utilizaremos la biblioteca en lugar de implementar un algoritmo de texto propio. Así podemos estudiar sus garantías sin esconder un problema difícil detrás de un `merge` inventado.

<img src="/assets/visuals/frontend-series/P074.svg" alt="Dos pestañas insertan A y B desconectadas; al intercambiar updates Yjs convergen al mismo texto con ambas letras, sin exigir aquí AB o BA." width="793" height="808" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P074.svg).

## Editar una estructura compartida no es reemplazarla entera

El laboratorio crea un documento y obtiene su texto compartido. La operación disponible añade un fragmento al final de la copia local. No usamos un textarea que sustituya toda la cadena en cada pulsación.

Archivo: `frontend-tiempo-real/src/collaboration.ts`, creación del tipo compartido.

```typescript
const document = new Y.Doc()
const text = document.getText('note')
```

Una edición emite un update. El adaptador notifica a React, guarda estado local y publica si está conectado. Al recibir datos, aplica `Y.applyUpdate` con origen `remote`; así evita reenviar indefinidamente el mismo cambio.

La [guía de tipos compartidos](https://docs.yjs.dev/getting-started/working-with-shared-types) desarrolla estas operaciones. Para un editor real elegiría un binding que gestione selección y posiciones, además del texto.

## El transporte y el algoritmo son responsabilidades distintas

**BroadcastChannel** comunica pestañas del mismo origen, no equipos remotos. El botón Desconectar nota desactiva el intercambio en el adaptador: no corta Internet.

Al reconectar, cada pestaña pide sincronización y publica su estado binario completo. La otra lo combina. Un proveedor más eficiente puede utilizar state vectors y deltas para evitar transmitir información ya conocida.

La prueba abre dos pestañas, desconecta ambas, inserta A y B por separado y reconecta. Exige el mismo texto con las dos letras. Acepta `AB` o `BA`: no impone una preferencia semántica para inserciones concurrentes.

Eso comprueba ese escenario, no todas las operaciones. Tampoco valida reglas de negocio: dos reservas pueden converger y aun así superar una capacidad permitida. Ese límite necesita coordinación adicional.

## Persistencia, identidad y presencia no vienen resueltas por converger

Guardamos un snapshot en **localStorage** para probar recarga después de sincronizar. Las pestañas comparten esa clave y pueden sobrescribir snapshots todavía no combinados. No prometemos conservar ambas ediciones si caen antes de intercambiarlas.

Para persistencia offline, Yjs documenta un [proveedor basado en IndexedDB](https://docs.yjs.dev/getting-started/allowing-offline-editing). Seguirían pendientes retención, borrado, recuperación y almacenamiento fuera del dispositivo. Guardar bytes localmente no crea un backup remoto.

La identidad interna de la réplica no autentica a una persona. Los permisos de lectura y edición deben comprobarse aparte. Un cursor o «está escribiendo» pertenece a **presence**, normalmente efímera, no al contenido persistido. Yjs separa ese papel mediante [awareness](https://docs.yjs.dev/api/about-awareness).

## Qué cambia con Operational Transformation

**Operational Transformation**, u **OT**, transforma operaciones con respecto a otras concurrentes según un protocolo. No consiste únicamente en ajustar índices: necesita un algoritmo con propiedades definidas.

[ShareDB](https://share.github.io/sharedb/) es un ejemplo de backend de sincronización basado en OT. Se cita como alternativa, no se instala ni compara experimentalmente en esta demo.

OT y CRDT son familias de soluciones, no sinónimos de «servidor central» y «sin servidor». Un sistema CRDT puede centralizar autorización y distribución. Elegiría una implementación mantenida según el tipo de editor, sus operaciones y sus necesidades de almacenamiento.

## Garantías y límites

[El laboratorio](/assets/examples/frontend-tiempo-real-lab.zip) comprueba inserciones desconectadas, convergencia de dos pestañas y recarga posterior. No incluye borrado, undo compartido, presencia, permisos, sincronización entre equipos ni persistencia resistente a cualquier caída.

Desde `frontend-tiempo-real/`, ejecuta `pnpm test:browser --grep Yjs`. No necesita un servicio externo de colaboración.

## Ejercicio: añadir una tercera réplica

Abre una tercera pestaña e inserta C desconectada. Al sincronizar, las tres deben compartir una cadena con A, B y C una vez cada una. No fijes `ABC` como única salida correcta para operaciones concurrentes.

Cerramos la serie con [audio WebRTC y liberación de recursos al colgar](/posts/webrtc-audio-ice-stun-turn).

## Referencias

- [Yjs: tipos compartidos](https://docs.yjs.dev/getting-started/working-with-shared-types).
- [Yjs: document updates](https://docs.yjs.dev/api/document-updates).
- [Yjs: edición offline](https://docs.yjs.dev/getting-started/allowing-offline-editing).
- [Yjs: awareness](https://docs.yjs.dev/api/about-awareness).
- [ShareDB: sincronización basada en OT](https://share.github.io/sharedb/).
- [MDN: BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API).

Fuentes consultadas el 17 de octubre de 2026. Biblioteca ejecutada: Yjs 13.6.27.
