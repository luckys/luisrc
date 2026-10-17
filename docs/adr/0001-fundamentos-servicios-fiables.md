# ADR: fundamentos con monolito modular y laboratorio pequeño

Estado: aceptada para los borradores, 2026-10-17.

## Contexto

El lector necesita entender fronteras y garantías antes de implementar un servicio
fiable. Añadir infraestructura por anticipación puede esconder la regla que debe
aprender. No estamos construyendo el proyecto integrador en este repositorio.

## Decisión

Usar TypeScript estricto con funciones y contratos pequeños. Reglas puras y
adaptadores separados conceptualmente; no imponer DDD completo ni un framework.
PostgreSQL real para atomicidad y unicidad; modelos en memoria explícitos para
aislar intercalados, leases y respuestas perdidas.

## Alternativas y consecuencias

- Microservicios: introducirían red y despliegues sin una necesidad demostrada.
- Framework completo: útil para integrar una API real, pero innecesario para probar
  la tabla de transiciones o un constructor de Money.
- Todo simulado: rápido, pero no demostraría constraints ni rollback del motor.
- Broker/CDC/motor durable: extensiones razonables si el integrador necesita sus
  garantías. No se afirman implementados por describir su funcionamiento.

La sencillez reduce dependencias; no elimina trabajo futuro. Se revisará cuando
exista una necesidad medible de aislamiento, despliegue independiente o replay.
