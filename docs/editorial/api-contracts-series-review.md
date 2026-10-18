# Revisión del inicio de Diseño de APIs y seguridad web

Nota de lectura: revisión histórica de la entrega inicial. La estructura vigente
de doce artículos se documenta en api-series-split-review.md y la ruta editorial.

18 de octubre de 2026. Dos borradores nuevos, P020 y P021. No completan las doce
fichas de la Serie 03. Orden, objetivos, fuentes y siguientes ampliaciones en
ruta-diseno-apis-seguridad.md. No publicación, traducción, audio, commit o push.

## Qué se hizo y por qué

- Contrato primero: OpenAPI 3.1.1 con cinco operaciones, campos, unidades y respuestas.
- Servidor Node 24.19.0 sin dependencias: loopback, puerto efímero, memoria ficticia.
- Tests HTTP escritos primero y fallando por ausencia de server.mjs; después
  implementación y contraste de schemas. Dos extractos JS comprobados contra código.
- Separar creación, lectura safe, sustitución, actualización parcial y borrado.
  Repetir DELETE puede cambiar de 204 a 404; repetir POST crea otro pedido.
- Se declara que PATCH usa un documento propio, no JSON Merge Patch completo.
- La propuesta de solicitudes de pago es conceptual: ningún cargo ejecutado.
- REST se distingue de HTTP JSON; no se certifican todas sus restricciones.

## Evidencia

- 11 tests del laboratorio: cinco operaciones, entradas inválidas, error sin stack,
  JSON malformado, media type, cuerpo, referencias, campos y fronteras del schema.
- Una discrepancia detectada durante la revisión: string.length contaba unidades
  UTF-16 mientras maxLength habla de code points. Corregido el parser y probado
  con 80/81 emoji tanto por HTTP como contra el schema.
- Dos tests de raíz: metadatos españoles/draft, esquema del post igual al contrato,
  extractos iguales al código, dimensiones SVG y ZIP byte a byte con seis archivos.
- Chromium real a 1440/360: títulos, noindex, imágenes decodificadas, enlaces,
  ausencia de overflow y de errores de página. Diagramas con fuente D2 y enlaces
  de ampliación. Informe final y cuatro capturas: /tmp/api-contracts-layout.EXmM2Q.
- El verificador de schemas en tests soporta explícitamente solo los keywords
  usados; falla si aparece uno nuevo. No se anuncia como motor general ni como
  metavalidación completa OpenAPI. Las pruebas de estado no dependen de tiempos.
- ZIP extraído en directorio temporal independiente: sus 11 tests pasan sin
  instalaciones. Suite conjunta final: 94 tests aprobados, 55 raíz, 28 algoritmos
  y 11 HTTP. Typecheck de algoritmos y build público correctos; los 23 borradores
  de esta entrega no aparecen en HTML, Markdown ni índice LLM. Servidor de revisión
  detenido al terminar. Fuentes primarias consultadas el 18 de octubre de 2026:
  OpenAPI, RFC 9110/8259/9457, JSON Schema y tesis de Fielding, enlazadas en los posts.

## Límites

Sin autenticación, permisos, rate limiting, proveedor OIDC, SQL, concurrencia entre
procesos ni almacenamiento duradero. No hay pagos ni deduplicación. PUT no crea.
HEAD/OPTIONS y negociación avanzada no implementados. No desplegar este servidor.
El límite de cuerpo se comprueba al consumirlo, descartando chunks excedentes;
no demuestra resistencia ante clientes lentos o abuso de transporte.

Esta revisión corresponde a la entrega inicial P020/P021, guardada después en
3d3de63. La continuación P022/P023 está documentada en
[api-validation-errors-review.md](api-validation-errors-review.md). P024–P031
siguen pendientes de ampliación y pruebas según sus fichas. No se renumeran
artículos agrupados anteriores para aparentar cobertura.
