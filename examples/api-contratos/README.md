# Contratos y semántica HTTP

Laboratorio de P020/P021. Node 24.19.0, sin dependencias ni instalación. Datos
ficticios en un Map, sin base de datos ni autenticación. No desplegar ni exponer
en red. El comando de arranque escucha solo en loopback y elige un puerto libre.

```bash
node --test tests/*.test.mjs
node server.mjs
```

Sustituye PUERTO por el que imprime el servidor:

```bash
curl -i http://127.0.0.1:PUERTO/orders -H 'Content-Type: application/json' --data '{"amountMinor":1250,"currency":"EUR","label":"Libro"}'
curl -i http://127.0.0.1:PUERTO/orders/o1
curl -i -X PUT http://127.0.0.1:PUERTO/orders/o1 -H 'Content-Type: application/json' --data '{"amountMinor":2400,"currency":"USD"}'
curl -i -X PATCH http://127.0.0.1:PUERTO/orders/o1 -H 'Content-Type: application/json' --data '{"label":null}'
curl -i -X DELETE http://127.0.0.1:PUERTO/orders/o1
```

Ctrl+C cierra el servidor. Reiniciarlo borra todos los pedidos. Los tests abren
puertos efímeros independientes y cierran sus sockets.

## Contrato

- POST /orders: 201, Location y representación. Repetir crea otro ID, sin deduplicación.
- GET /orders/{id}: 200, sin modificar el estado de negocio.
- PUT: reemplaza todos los campos editables. Solo actualiza recursos existentes.
- PATCH: documento propio application/json para label. Ausente conserva; null elimina.
  No se anuncia como implementación completa de JSON Merge Patch.
- DELETE: 204 vacío la primera vez; 404 si ya no existe. Mismo efecto pretendido.
- Errores 400/404/405/413/415/422: Problem Details básico, sin stack ni detalles internos.
- Cuerpo máximo aceptado 4096 bytes; label máximo 80 code points Unicode.
  Se consume el cuerpo antes de responder 413, descartando chunks excedentes.
  No es protección completa ante slow clients, abuso de red o memoria del socket.

openapi.json fija OpenAPI 3.1.1 y el subconjunto publicado. La validación es manual,
no un motor general JSON Schema. Las pruebas comprueban respuestas HTTP y límites
del contrato; no certifican toda la especificación OpenAPI ni todos los clientes.

## Fuera de alcance

Pagos reales, workers, idempotency keys, autenticación, concurrencia entre procesos,
control de actualizaciones perdidas, SQL, sesiones, OAuth/OIDC, caché y rate limiting.
P020/P021 no completan las otras diez fichas de la Serie 03. Las propuestas sobre
pagos en el artículo son diseño de contrato, no cargos implementados.
