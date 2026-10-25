# Capacidad y costes: una decisión por artículo

P066 se divide en siete drafts españoles, independientes de PaySafe. Público:
ingenieros que ya manejan HTTP, latencia y los diseños AWS anteriores. Los artículos
no requieren contratar cloud, publicar un servicio o disponer de datos reales.

La pregunta común es cómo pasar de una demanda declarada a capacidad y coste sin
ocultar margen, dependencias o incertidumbre. Los tres escenarios y sus contrastes
son cálculos reproducibles, no benchmarks. Ver [manifiesto](capacity-costs-series.json)
y [revisión](capacity-costs-review.md).

## Orden y criterios de aprendizaje

### P066. [RPS y concurrencia: cuántas peticiones hay dentro de tu servicio](../../src/content/posts/es/rps-concurrencia-ley-little-capacidad.md)

**Pregunta:** Cómo relacionar tasa, tiempo medio y peticiones en curso sin confundir espera con CPU.

Capacidades comprobables:

- Distinguir tasa de llegadas, admisión y throughput.
- Calcular concurrencia media con unidades compatibles.
- Separar tiempo de estancia de demanda CPU.

Errores que se corrigen: Multiplicar RPS por p99; Tratar concurrencia como número de cores; Mezclar ventanas y poblaciones.

### CAP-UTILIZATION. [Utilización y réplicas: dimensionar con margen sin inventar un porcentaje universal](../../src/content/posts/es/utilizacion-cpu-replicas-margen-capacidad.md)

**Pregunta:** Cómo convertir demanda CPU en un mínimo de réplicas y comprobar la pérdida de una.

Capacidades comprobables:

- Derivar réplicas CPU con target y margen.
- Recalcular utilización después de una pérdida.
- Detectar un máximo insuficiente sin ocultar required.

Errores que se corrigen: Tratar 60% como universal; Confundir N+1 con HA entre zonas; Recortar réplicas sin marcar inviabilidad.

### CAP-BOTTLENECKS. [Cuellos de botella: por qué seis réplicas no siempre procesan más trabajo](../../src/content/posts/es/cuellos-botella-capacidad-dependencias.md)

**Pregunta:** Cómo acotar el throughput de una cadena y contrastar el coste de cada visita.

Capacidades comprobables:

- Calcular techos por recurso y número de visitas.
- Identificar qué recurso limita cada variante.
- Diseñar un contraste que cambie una hipótesis cada vez.

Errores que se corrigen: Aumentar API para arreglar una quota global; Usar espera completa como tiempo de servicio; Equiparar conexiones abiertas con capacidad DB.

### CAP-AUTOSCALING. [Autoscaling y colas: qué ocurre mientras llegan las nuevas réplicas](../../src/content/posts/es/autoscaling-colas-arranque-picos.md)

**Pregunta:** Cómo explorar preparación, cola limitada y capacidad global en una traza explícitamente simulada.

Capacidades comprobables:

- Recorrer preparación y cola por intervalos.
- Verificar conservación de llegadas, servicio y rechazos.
- Comparar reacción, preparación anticipada y DB limitada.

Errores que se corrigen: Equiparar réplicas deseadas con listas; Convertir un flujo simulado en p99; Presentar la simulación como HPA real.

### CAP-ESTIMATES. [Estimar costes: tres perfiles de tráfico y un presupuesto que muestra sus supuestos](../../src/content/posts/es/estimar-costes-servicio-tres-escenarios.md)

**Pregunta:** Cómo calcular partidas, comparar pico permanente y ajuste ideal, y hacer análisis de sensibilidad.

Capacidades comprobables:

- Recalcular tres presupuestos por franjas de tráfico.
- Reconciliar partidas en microUSD sin float monetario.
- Contrastar CPU y bytes sin ocultar exclusiones.

Errores que se corrigen: Usar la media mensual para dimensionar el pico; Presentar ajuste ideal como autoscaling observado; Llamar TCO a un subtotal parcial.

### CAP-COMMITMENTS. [Reservas y compromisos: pagar menos por hora no siempre reduce el gasto](../../src/content/posts/es/reservas-compromisos-descuentos-capacidad.md)

**Pregunta:** Cómo separar capacidad reservada de descuento y detectar compromisos ociosos.

Capacidades comprobables:

- Distinguir descuento y disponibilidad de capacidad.
- Calcular exceso y ociosidad pagados.
- Comparar una base estable con comprometer el pico.

Errores que se corrigen: Asumir que todo producto llamado reserva garantiza capacidad; Comprar el pico por su menor tarifa; Trasladar el umbral ficticio a un contrato real.

### CAP-FINOPS. [FinOps: convertir el coste por petición en una decisión que puedas revisar](../../src/content/posts/es/finops-coste-peticion-asignacion-presupuesto.md)

**Pregunta:** Cómo definir denominadores, asignar costes compartidos y reconciliar una estimación.

Capacidades comprobables:

- Definir alcance y denominador de coste unitario.
- Repartir y reconciliar cada microUSD.
- Diseñar una revisión de coste junto con errores y latencia.

Errores que se corrigen: Premiar reintentos con un denominador inflado; Devolver cero cuando no hay operaciones buenas; Confundir regla de reparto con causalidad.

## Laboratorio y aceptación

Código en `luisrc-blog-examples/packages/capacity-costs`. Los posts conservan siete
extractos TypeScript explicados y las tarifas JSON; los archivos de laboratorio
se enlazan al monorepo. Siete diagramas D2/SVG, un gráfico estático de presupuestos
y un comparador que utiliza la misma función tipada, transformada sin tipos.

- Tres perfiles: estable 8RPS24h, horario 10RPS16h/120RPS8h y campaña20RPS23h/300RPS1h.
- 30 días explícitos, target60%, margen1, CPU10ms, mínimo2/máximo8. Cada franja tiene
  demanda y horas, con réplicas ideales preparadas al comenzar. No equivale a un
  mes de autoscaling observado ni incluye arranque o solapamiento de rollout.
- Tarifas ficticias USD, dinero exacto en microUSD. Partidas compute/base/peticiones/
  storage/egress y exclusiones explícitas. El gráfico compara ajuste ideal con pico
  permanente, manteniendo idénticas exclusiones.
- Sensibilidad CPU×2 (campaña inviable con máximo8), bytes×10 y DB5/20ms por visita.
  Inviabilidad visible, sin convertir el subtotal de recursos limitados en una
  promesa de atender demanda o SLO.
- Simulación independiente300s, pasos5s, tres variantes. Controlador simplificado
  con demanda conocida, no HPA. Conservación de trabajo y cola limitada; no latencia
  individual ni percentiles. Conexión pedagógica con el HPA real anterior, sin
  atribuirle los resultados calculados.
- Compromisos2/6unidades y precio reducido ficticio, ociosidad y exceso. Diferenciar
  mecanismos comerciales de AWS con fuentes oficiales, sin ejecutar compras.
- Coste por millón ofrecidas/buenas, null con cero buenas, allocation5:3:2 que
  reconcilia el total. No factura, forecast validado ni ahorro realizado.

La aceptación del bloque exige validar fórmulas/importes, nueve fuentes hash,
metadatos, dependencias, extractos, dimensiones y exports. También recorrer el visor
con teclado, móvil y escritorio, casos inviables/cero denominador y error de carga.
Los tests del blog deben seguir impidiendo que drafts aparezcan en producción.

## Decisiones editoriales

No añadir otro tutorial de AWS o Kubernetes: sus mecanismos ya tienen series.
No usar precios comerciales para un ejemplo genérico de descuentos. No fabricar
un benchmark para ilustrar una identidad algebraica. Separar coste del presupuesto
ideal, traza fluida y evidencia observada evita mezclar garantías incompatibles.

El siguiente bloque del objetivo global es Deep Learning, P096 en adelante; las
series07–09 ya disponen de material previo que debe seguir auditándose. La existencia
de un draft no acepta automáticamente una ficha ni cierra los gaps históricos.
