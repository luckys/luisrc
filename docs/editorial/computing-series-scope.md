# Serie 01: Computación, sistemas y redes

Objetivo del usuario: completar todas las fichas pendientes, no solo la ruta corta.
El turno anterior produjo progreso: ML, sus recursos y el inventario real. Esta
entrega recupera P001–P009, español, draft y autor Luis Ramírez Calle. Sin commits,
push, traducción o audio nuevos. Preservar los borradores y recursos anteriores.

## Público y aceptación

Ingenieros que ya programan y necesitan conectar fallos observables con hardware,
SO, transporte y navegador. No repetir un curso de variables. Una pregunta central
por artículo, mecanismos y límites, ejemplos con archivo, decisiones razonadas,
pruebas, ejercicio comprobable, diagrama y fuentes primarias consultadas.

| ID   | Tres objetivos                                                                | Tres errores que evitar                                                                |
| ---- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| P001 | Seguir instrucciones/datos; distinguir jerarquías; medir lectura/proceso      | Tiempo readFile igual a SSD; caché CPU igual a page cache; GHz igual a duración        |
| P002 | Separar valor/bytes; corregir float y UTF-8; fijar instante/unidades          | Bytes igual a caracteres; Number exacto en decimal; fecha local igual a instante       |
| P003 | Explicar aislamiento y scheduling; observar memoria; provocar bloqueo acotado | RSS igual a heap; async igual a otro hilo; memoria virtual igual a RAM reservada       |
| P004 | Diagnosticar PID/puerto/fds; revisar permisos; cerrar por señal               | Matar por nombre; imprimir entornos secretos; SIGTERM garantiza persistencia           |
| P005 | Separar DNS/ruta/puerto; resolver servicio propio; explicar NAT/LB            | DNS entrega URL; TTL garantiza cambio inmediato; loopback prueba Internet              |
| P006 | Comparar entrega/orden/plazos; simular pérdida; distinguir QUIC               | UDP siempre mejor; QUIC sin retransmisión; control de flujo igual a congestión         |
| P007 | Separar cifrado/identidad; inspeccionar TLS; probar certificado inválido      | Desactivar verificación; CA conoce claves de sesión; TLS autoriza negocio              |
| P008 | Aplicar semántica; distinguir versiones; comprobar 200/304/ETag               | 304 sin representación local; no-cache igual a no-store; transporte cambia semántica   |
| P009 | Relacionar DOM/CSSOM/pintado; observar event loop; trazar Fetch/cookie        | Microtask pinta; HttpOnly evita toda acción XSS; CORS impide enviar cualquier petición |

## Laboratorio

Node 24.19.0 y biblioteca estándar, OpenSSL y herramientas Linux ya presentes.
Sin instalaciones nuevas. Solo sockets loopback y puertos efímeros, fixtures
temporales, hijos propios identificados antes de enviar señales. No cambiar DNS,
trust store, red, permisos o procesos ajenos. Nunca guardar claves TLS privadas.

Mediciones locales con muestras y entorno conservados, no cifras universales de
latencia. Simulador de transporte explícitamente conceptual, no implementación de
TCP/QUIC o emulación de congestión. Navegador real con Playwright ya disponible.
ZIP autocontenido en código y resultados; navegador opcional no incluido.

No dar por aceptado el roadmap completo con un inventario, un build o nueve títulos.
