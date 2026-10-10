# Resultados del laboratorio

Verificación: 2026-10-10. Datos ficticios; no son un benchmark ni evidencia de producción.

## Entorno

Linux x64, Node.js 24.18.0, pnpm 12.8.1, Docker 29.9.0, PostgreSQL 18.4.
Imagen y digest en `docker-compose.yml`. pg 8.23.1, Vitest 5.0.3, TypeScript 5.9.3.
Configuración observada: `read committed`, `fsync=on`,
`synchronous_commit=on`, `full_page_writes=on`.

## SQL: resultados que comprobar

| Experimento                           | Estado observado                                       |
| ------------------------------------- | ------------------------------------------------------ |
| Débito en autocommit seguido de error | 7500 + 5000 = 12500                                    |
| Débito en bloque seguido de rollback  | 10000 + 5000 = 15000                                   |
| Transferencia completa                | 7500 + 7500 = 15000                                    |
| Stock inválido                        | CHECK rechaza -1; sigue en 1                           |
| Dos lecturas READ COMMITTED           | 10000, 10500                                           |
| Dos lecturas REPEATABLE READ          | 10000, 10000; escritor confirma 10500                  |
| Documento y reinicio ordenado         | `committed version` permanece                          |
| Error y recuperación a savepoint      | El débito y crédito se confirman; documento descartado |

## Ampliación TypeScript: nueve pruebas

1. Error de aplicación sin transacción: un pedido y cero pagos.
2. Error de aplicación dentro del bloque: ninguna fila.
3. Commit normal: ambas filas, importes 2500 EUR y pago interno `created`.
4. Error SQL 23505 en la segunda escritura: revierte el pedido nuevo.
5. Otro cliente no ve el pedido antes del commit.
6. Error SQL 22012, bloque abortado 25P02 y recuperación a savepoint.
7. Cierre antes del commit: backend terminado y ninguna fila conservada.
8. Importe negativo sin CHECK: permite -2500 para mostrar la regla ausente.
9. COMMIT sobre un bloque abortado devuelve el comando ROLLBACK.

```bash
pnpm check
pnpm test
pnpm experiment:atomicity
```

El experimento imprime los conteos 1/0, 0/0 y 1/1 para los tres recorridos.

## Límites

Los scripts SQL comprueban casos concretos de datos y visibilidad. El reinicio
es ordenado: no simula un corte eléctrico, almacenamiento defectuoso o failover.
La prueba de visibilidad no demuestra serializabilidad. No se verifica concurrencia
entre dos escritores ni reconciliación de un commit cuya respuesta se pierde.

La ampliación no realiza cobros, envíos ni efectos externos. Los tests de atomicidad
no prueban cualquier regla de negocio. No hay mediciones de latencia o throughput.
