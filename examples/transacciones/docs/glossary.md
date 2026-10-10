# Vocabulario del laboratorio

- **Transacción:** unidad de trabajo confirmada o descartada conjuntamente.
- **Autocommit:** confirmación individual de sentencias exitosas fuera de un bloque explícito.
- **Invariante:** regla que debe cumplir un estado válido.
- **Atomicidad:** conservación completa o descarte de los cambios del bloque.
- **Consistencia:** preservación de las reglas del estado válido.
- **Aislamiento:** garantías sobre la interacción entre transacciones concurrentes.
- **Durabilidad:** conservación de commits frente a los fallos cubiertos por la configuración.
- **Instantánea:** visión de los datos usada por una consulta o transacción.
- **Savepoint:** punto dentro del bloque al que puede retrocederse sin perder cambios anteriores.
- **WAL:** registro utilizado para recuperar cambios sin exigir que todas las páginas se escriban al confirmar.
- **Pool:** conjunto de conexiones; una transacción debe mantenerse en un mismo cliente.
- **SQLSTATE:** código estable que identifica una clase de resultado o error de PostgreSQL.
- **Registro interno de pago:** fila de demostración; su existencia no equivale a un cobro externo.
