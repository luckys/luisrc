# Glosario y propiedad de conceptos

| Concepto | Significado usado | Primera entrega |
|---|---|---|
| Minor units | Unidades menores según moneda, céntimos para EUR | API-MONEY |
| Runtime validation | Comprobar datos durante ejecución, no solo anotarlos | API-MONEY |
| Race condition | Resultado dependiente de intercalados o coordinación ausente | API-ASYNC |
| Idempotent HTTP method | Repetir conserva el efecto pretendido, no necesariamente respuesta | API-HTTP |
| Problem Details | Formato de error HTTP de RFC 9457 | API-ERRORS |
| Mass assignment | Actualización de campos no autorizados por copiar objetos externos | API-ERRORS |
| Keyset pagination | Continuar tras una clave de ordenación estable | API-EVOLUTION |
| Principal | Identidad verificada y contexto con el que se evalúa acceso | API-IDENTITY |
| Tenant | Ámbito organizativo de pertenencia y aislamiento | API-IDENTITY |
| Trust boundary | Frontera donde cambian las suposiciones de confianza | API-SECURITY |
| Invariant | Propiedad exigida a los estados válidos del modelo | DESIGN-REQUIREMENTS |
| Port / adapter | Contrato requerido por una parte y componente que lo implementa | DESIGN-MODULES |
| State machine | Estados y acciones con transiciones explícitas | DESIGN-STATES |
| Fake | Sustituto ejecutable simplificado, con garantías limitadas | DESIGN-TDD |
| Partial failure | Una parte falla mientras otras pueden haber seguido funcionando | DIST-FAILURES |
| Scope / fingerprint | Ámbito de identidad y resumen semántico de una intención | DIST-IDEMPOTENCY |
| Deadline | Límite temporal de la operación completa | DIST-RETRIES |
| Bulkhead | Cupo aislado de trabajo simultáneo para contener saturación | DIST-RETRIES |
| Lease | Reclamación temporal, no detención forzada del propietario antiguo | DIST-QUEUES |
| ACK | Confirmación de una entrega según el protocolo de la cola | DIST-QUEUES |
| Raw body | Representación original recibida, necesaria para ciertas firmas | DIST-WEBHOOKS |
| Outbox / Inbox | Intención de publicar y registro de recepción/aplicación recuperables | DIST-OUTBOX |
| Compensation | Nueva acción que corrige consecuencias según reglas de negocio | DIST-SAGAS |
| Reconciliation | Comparación de evidencia y estados para resolver discrepancias | DIST-RECONCILIATION |
| Shrinking | Reducir un contraejemplo generado a un caso más pequeño | OPS-FAULTS |
| Cardinality | Cantidad de combinaciones de dimensiones de una señal | OPS-SIGNALS |
| Closed-loop | Clientes esperan resultados antes de generar su siguiente petición | OPS-LOAD |
| SLI / SLO | Indicador de experiencia y objetivo definido para una ventana | OPS-SLO |
| Runbook | Procedimiento de diagnóstico/mitigación con comprobaciones y límites | OPS-DELIVERY |
