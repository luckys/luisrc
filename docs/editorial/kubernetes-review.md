# Revisión del bloque Kubernetes de P065

Once drafts españoles complementan los seis de Terraform. Autor Luis Ramírez
Calle, draft/status draft. Ver [manifiesto](kubernetes-series.json) y
[ruta conjunta](ruta-terraform-kubernetes.md). P065 queda cubierto como material
editorial y laboratorio local verificado; no equivale a una plataforma preparada
para producción. El objetivo global del roadmap sigue abierto.

## Cobertura y observaciones

| Concepto | Artículo / fuente | Evidencia concreta |
| --- | --- | --- |
| API, Pods y controladores | K8S-PODS; runner | UID cambia al borrar Pod, image ID se conserva y ReplicaSet pertenece al Deployment |
| Deployment/ReplicaSet | K8S-DEPLOYMENTS; deployment/Dockerfile | Dos images con versión baked distinta; rolloutv2 y undov1 comprobados por HTTP |
| Services/EndpointSlices/DNS | K8S-SERVICES; service/client | Nombre resuelto igual a ClusterIP; HTTP desde Pod cliente y condiciones de endpoints |
| Ingress/controller | K8S-INGRESS; ingress/request | Traefik preparado, Host correcto200 y host ajeno404, IngressClass observada |
| Startup | K8S-STARTUP; dos Pods | Fixture8s: startup503 inicial, Ready sin restart; sin startup reinicia |
| Readiness | K8S-READINESS; API/deployment | Endpoint readyfalse y Traefik503 con UID/restarts iguales; recuperación sin restart |
| Liveness | K8S-LIVENESS; API/deployment | Aumenta restartCount dentro del mismo UID; flag restaurado y HTTP preparado |
| ConfigMaps | K8S-CONFIG | Mismo Pod ve volume-v2/env-v1; rollout posterior recibe env-v2 |
| Secrets/ServiceAccount/RBAC | K8S-SECRETS; Role/binding | ConfigMap permitido y Secret Forbidden mediante impersonation; token automountfalse |
| Requests/scheduling | K8S-RESOURCES; fixture | Pending sin nodo, condición Unschedulable e Insufficient cpu |
| Memoria/limit | K8S-RESOURCES; fixture | Buffer256Mi bajo limit64Mi; razón OOMKilled observada, Pod negativo eliminado |
| Autoscaling | K8S-HPA; hpa/runner | Métricas válidas, carga CPU, al menos2Ready requeridas, aumento observado a3 y reducción a1 |

Temario P065 combinado: Terraform plan/state/providers/modules/drift, y Kubernetes
pods/deployments/services/ingress/probes/secrets/autoscaling. El servicio mínimo
se despliega realmente con Terraform en su laboratorio y con Kubernetes en este.
Cada mecanismo del segundo bloque tiene observación propia, no se acepta solo
por existir su objeto. La comprobación del objetivo completo sigue pendiente de
los demás IDs y gaps del roadmap.

## Fuentes y archivos publicados

Código solo en `luisrc-blog-examples/packages/kubernetes-workloads`. Catorce
extractos en posts: trece JSON/subárboles de los manifests probados y un helper
JavaScript que resume observaciones de Pod. Se verifica cada JSON contra su ruta
en el manifiesto fuente. El helper se presenta con formato legible, conservando
el código normalizado de la fuente probada. Once índices por post, carpetas inglesas.

K3s1.35.9+k3s1 y Node24.19.0 por digest. Imagesv1/v2 se construyen con archivo de
versión baked, tienen IDs diferentes y se importan al containerd local. No registry
publicado o firma de images probados. JSON incluye placeholders de namespace/image
que el harness sustituye para su clúster propio; no es un tutorial para usar un
contexto personal por accidente.

Solo cinco exports canónicos: explorer.html/mjs, chart.mjs, replay.json y SVG.
chart.mjs calcula coordenadas de muestras observadas, no simula el HPA. La API,
manifiestos, scripts y tests no se exportan al directorio público del blog.

## Captura final y alcance del experimento

Captura `2026-10-25T13:10:56.028Z`, proyecto `luisrc-kubernetes-c5b5bec6`, namespace
`k8s-lab-c5b5bec6`:23fasesobserved,26hashes de entradas y66muestras HPA. No hay datos
de producción, kubeconfig personal, credenciales de nube o Secret real. El valor
ficticio del Secret es público en source, pero no se copia siquiera ese valor a
la evidencia. La prueba de decodificación publica un booleano.

Ocho clientes con trabajo CPU20ms generaron752peticiones; al detener y esperar
clientes,752correctas/0fallidas. La fase de aumento tenía ocho peticiones todavía
en curso: no se presentan sus contadores intermedios como resultados finales.
No es benchmark: la carga es sintética y no hubo peticiones continuas durante
las fases anteriores de rollout. No inferir disponibilidad continua del servicio.

En la muestra que confirmó aumento:CPU500% sobre request50m, deseadas3/Ready3,
currentHPA1 aún atrasado. En la confirmación de reducción:CPU4%,deseadas1/Ready1,
currentHPA3. Las consultas de HPA y Deployment no forman snapshot atómico y los
controladores actualizan estado en momentos distintos. Los artículos/visor
explican esa diferencia, sin corregir a mano los valores archivados.

Antes de disponer de CPU válida, statusdesired podía ser0 con una réplica Ready.
Se conserva esa observación en tablas y datos, pero se excluye de la curva de
recomendaciones: no representa una orden válida de escalar bajo minReplicas.
La inspección visual detectó este matiz; se corrigió renderer/visor y se comprobó
la selección de puntos tanto en tests como en navegador.

La primera consulta Service desde el mismo Pod resolvió DNS pero terminó con
ConnectTimeout en HTTP. Se adoptó un Pod cliente separado, que valida el recorrido
entre workloads. No se acreditó ni se alteró con sysctls globales el hairpin hacia
el propio Pod. El intento fallido limpió su clúster sin publicar captura final.
Esta limitación se conserva en README; no se afirma que todos los recorridos de
red posibles estén cubiertos.

## Política pnpm y capturas anteriores

El workspace tiene35proyectos,34laboratorios. El paquete no tiene dependencias
npm nuevas y pnpm12 no necesita un importador vacío. Ambos lockfiles pnpm
permanecen sin cambios. Frozen install pasa después de denegar explícitamente
scripts auxiliares:telemetríaScarf y optimizaciones opcionales ssh2/cpu-features.
Se leyó su uso instalado antes de definir la política; no se desactivaron los
controles de scripts ignorados ni se autorizó ejecución nativa indiscriminada.

Cambió pnpm-workspace.yaml, entrada de los builds P062/P063. Se repitieron ambos
exercises completos conservando controles de hashes:

- P062:`2026-10-25T13:03:35.536Z`,luisrc-containers-a044e370,10fases/15hashes,
  build618485156bytes/runtime344518059bytes(589,8/328,6MiB). Gráfico,replay y cifras
  del post multi-stage actualizados.
- P063:`2026-10-25T13:03:26.794Z`,luisrc-delivery-4a2c436a,18fases/26hashes;
  replay y gráfico actualizados. Sus pruebas de canary/rollback siguen pasando.

Las revisiones anteriores conservan evidencia histórica con notas explícitas de
actualización. Terraform y AWS no cambiaron sus entradas de experimento; verify
sigue pasando. No se repitieron sus recorridos por cambios de presentación ajenos.

## Verificación editorial y visual

Tres tests locales del laboratorio pasan:tipos de configuración/flags, diferencias
de probes y Host/restricción loopback del cliente. Los tests se definieron antes
de implementar su parte; la primera invocación pnpm quedó bloqueada por política
de builds auxiliares, no fue una fase red funcional del código. No se presenta
ese fallo de instalación como prueba TDD de un comportamiento de la API.

132checks editoriales/estructurales pasan, siete nuevos de Kubernetes. Verifican
metadatos, orden,14extractos,11D2/SVG y gráfico, hashes,23fases,66muestras, puntos
iniciales sin métrica válida, snapshots y exports canónicos. Terraform mantiene
un check del complemento Kubernetes existente en lugar de una nota de pendiente.

Build y Pagefind pasan;19tests del blog pasan. Índices253,labs34,exports88. Auditor
69draft_exists/20related_only/86not_written: no aceptación del objetivo global.
Se conservan10páginas publicadas,4280palabras y dos idiomas; estos drafts no se
publican ni traducen y no tienen audio generado.

Chromium final:24vistas1440/360(11posts+visor),46selecciones de fase y132muestras
recorridas con teclado real. Compara datos, polilíneas y coordenadas de puntos
contra la captura; comprueba unknown/null sin falso cero, prev/next, detalles,
regiones, noindex, iframe, enlaces/assets y error de carga. Sin overflow global,
errores JavaScript o peticiones del visor fuera de sus assets. Informe final
`/tmp/kubernetes-layout.F49lGm/report.json`. El informe .E92QCG es anterior a la
corrección de status inicial sin métricas. Se inspeccionaron los once diagramas,
gráfica, visor en ambas anchuras y helper JavaScript renderizado.

## Limpieza y continuación

El harness confirma nombres libres antes de adquirir recursos. Finally elimina
solo container y red propios, sin prune; los negativos startup/OOM/scheduling
se retiran antes del HPA. Namespace y clúster finales ausentes; images retenidas.
No crash del propio harness/host ensayado. El servidor de QA se cierra al terminar.

No multinodo/HA, NetworkPolicy, TLS, almacenamiento persistente, autenticación
con token real, cifrado de Secrets o escalado de nodos comprobados. RBAC usa
impersonation del administrador local; no equivale a probar un login de workload.
La carga CPU y los valores de probes son fixtures y no dimensionamiento recomendado.

Siguiente P066: capacidad y costes con tres escenarios y contraste de supuestos,
sin convertir el HPA local en benchmark o reutilizar un subtotal como TCO. Después
Deep Learning y restantes series. Preservar gapsP026,Stripe sandboxP045,soakP058 y
Serie02solo estructuras/algoritmos. AWS, Terraform y Kubernetes se incluyen en los
commits solicitados por el usuario. No se hace push ni publicación. El objetivo
global sigue activo.
