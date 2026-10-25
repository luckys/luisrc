# Revisión del bloque Terraform de P065

## Actualización al completar el bloque Kubernetes

P065 se completa como drafts con los once artículos y laboratorio Kubernetes. La captura Terraform y sus diecisiete fuentes permanecen intactas; su verify pasa. Ver kubernetes-review.md para el complemento y sus límites.

La política pnpm compartida deniega explícitamente Scarf y optimizaciones SSH
opcionales sin desactivar los controles de scripts. P062/P063 se recapturaron
porque esa política es entrada de sus builds; no se eliminó el control de hashes.
Las secciones siguientes conservan la revisión anterior.

Seis drafts españoles, un concepto por artículo, autor Luis Ramírez Calle. Ver
[ruta completa](ruta-terraform-kubernetes.md) y [manifiesto](terraform-series.json).
P065 sigue **parcial**: el bloque Kubernetes necesita artículos y experimentos
propios, especialmente probes, permisos y autoscaling. No se publica, traduce o
genera audio; los cambios permanecen sin commit y preservan los de AWS anteriores.

## Cobertura de Terraform y evidencia

| Concepto | Artículo / fuente | Qué se verifica |
| --- | --- | --- |
| Configuración, plan y apply | P065; main.tf/exercise | Seis recursos reales, apply, HTTP vía Ingress y plan posterior sin cambios |
| Providers/versiones | TF-PROVIDERS; versions.tf/tools/lockfile | CLI1.15.3, provider3.4.0, init readonly, fmt y validate reales |
| State/backend | TF-STATE; state local privado | Seis recursos mapeados; atributo sensible en plan y fixture pública presente en state, solo booleanos publicados |
| Módulos | TF-MODULES; modules/catalogue | Root crea namespace, referencias e inputs/outputs del módulo local usados por provider |
| Drift | TF-DRIFT; patch/plan/apply | Mensaje manual observado por HTTP, una actualización propuesta y reparación comprobada |
| Refresh-only | TF-DRIFT; plan/apply refresh-only | Acepta observaciones sin reparar objeto; HTTP conserva cambio, plan ordinario aún propone actualizar |
| Plan guardado/obsoleto | TF-CHANGES; stale/fresh | Segundo apply avanza state, primer plan rechazado exactamente como stale, HTTP conserva segundo valor |
| Reemplazo | TF-CHANGES; ConfigMap revision | Create-before-destroy, actualización del Deployment, respuesta nueva y nombre anterior ausente |
| Teardown | Runner y verify | Plan de seis borrados acotados, namespace ausente, state vacío y container/red propios eliminados |
| Dos reconciliadores | P065; delete Pod | Kubernetes repone UID sin nuevo apply; Terraform sigue sin cambios sobre Deployment |

El requisito de desplegar un servicio mínimo se prueba con Kubernetes real local,
no con una simulación de scheduler. Esto no acepta automáticamente todo el temario
Kubernetes de P065. No se han provocado fallos a mitad de apply ni probado HA,
capacidad, TLS, operadores concurrentes o locking remoto.

## Laboratorio reproducible y entradas

Código en `luisrc-blog-examples/packages/declarative-infrastructure`. Siete
extractos HCL/JavaScript dentro de los posts coinciden con el código probado.
Seis índices nuevos enlazan fuentes en GitHub. Las carpetas tienen nombres ingleses.

K3s1.35.9+k3s1 y Terraform1.15.3 en containers fijados por digest, provider
hashicorp/kubernetes3.4.0 seleccionado desde registro oficial y lockfile versionado.
K3s incluye el controlador Traefik de esta distribución. Se importa una image
propia Node24.19.0 sin dependencias de terceros en el containerd local. No hay
instalación de binarios host, kubeconfig personal, recursos cloud o secretos reales.

El clúster requiere un container privilegiado, cgroup namespace host y Docker
Linux compatible. API y entrada HTTP se publican únicamente en127.0.0.1 con
puertos aleatorios. Se confirma inexistencia del nombre antes de adquirir propiedad;
finally limpia solo container y red propios. No prune global. Images retenidas.
No se ha ensayado el crash del harness o del host durante la limpieza.

La carpeta privada de ejecución se comprobó con modo700 y kubeconfig600. State,
planes y checkpoints están ignorados en `.artifacts`. La fixture Secret es pública
por diseño; la evidencia no contiene su valor ni credenciales del clúster. En una
ejecución correcta se eliminan kubeconfig y tar de image tras destruir el clúster.
Los fallos conservan diagnósticos privados ignorados y no sustituyen la captura final.

Pnpm12 reconoce34proyectos,33laboratorios más raíz. El nuevo paquete no necesita
dependencias ni importador: pnpm12 omite el importador vacío incluso tras install
frozen y lockfile-only. La comprobación estructural conserva la exigencia de
importador para todos los paquetes con dependencias. No se añadieron paquetes
para fabricar una entrada vacía ni se editó el lockfile a mano. Root package,
workspace y ambos lockfiles pnpm permanecen sin cambios. P062/P063verify pasan;
no se repitieron sus builds por archivos que no son entradas de sus images.

## Captura y fallos corregidos

Captura final `2026-10-25T12:39:39.917Z`, proyecto
`luisrc-declarative-9575171a`, namespace `tf-lab-9575171a`. Dieciséis fases
`observed`, diecisiete hashes de aplicación, scripts, tests, HCL, lock y herramientas.
Todos los planes y peticiones provienen del recorrido real. Los timestamps y
elapsedMs son del harness; no se presentan como benchmarks o disponibilidad continua.

La exploración levantó otro clúster para comprobar soporte local; se eliminó tras
contrastar su etiqueta de propiedad. Dos recorridos iniciales fallaron y limpiaron
sus clusters antes de producir evidencia final:

- Nodo Ready no implicaba que existiese aún Deployment/traefik. Se cambió la espera
  por disponibilidad del controlador, manteniendo el criterio de entrada real.
- Fetch de Node24 ignoraba el Host solicitado. Un servidor loopback confirmó el
  Host recibido distinto del requerido por el Ingress. Se añadió un cliente con
  node:http, un test de regresión de Host y rechazo de destinos fuera de loopback.
  No se retiró la regla host del Ingress para dar el ensayo por válido.

Cuatro tests locales pasan. La fase red inicial del resumen de planes se observó
antes de implementar plan.mjs; los tests del cliente se añadieron antes del nuevo
helper. El resumen público excluye before/after sensibles y la política rechaza
recursos ajenos o borrar namespace fuera del teardown. Verify compara hashes,
orden, diferencias de los experimentos y limpieza, offline y sin iniciar Docker.

## Diagramas, gráficos y navegador

Seis D2/SVG, anchuras294–314px, labels legibles inspeccionados. Gráfico380×470
con cuatro planes y escala común0–6; un reemplazo cuenta en crear y borrar. Los
contadores derivan de la captura. No son el número de objetos únicos ni tiempos.

El visor solo carga replay.json, sin control Terraform o Kubernetes. Select y
prev/next recorren dieciséis fases. Cada fase muestra su HTTP o «No capturado»,
plan propio, acciones, barras y hechos JSON sanitizados. Refresh-only muestra
explícitamente el plan ordinario posterior. Fases sin plan no inventan valores0.
El título completo permanece visible fuera del select en móvil.

Chromium comprueba seis posts y visor en1440/360:14vistas y32selecciones de fase,
valores exactos, acciones/barras, detalles JSON, prev/next/select y teclado, noindex,
enlaces/recursos, iframe y ausencia de overflow global/errores JavaScript. Incluye
fallo de carga con error explícito y controles deshabilitados. Se inspeccionaron
ambas anchuras, todos los diagramas, gráfico y una muestra del código renderizado.
La tabla de estado se ajustó para leer dato/valor en móvil sin scroll horizontal;
las direcciones largas conservan su región desplazable. Informe final:
`/tmp/terraform-layout.be3HyH/report.json`.

Los recursos canónicos exportados son cuatro: HTML/JS del visor, replay y SVG.
La API, HCL, planes/state y kubeconfig no se copian al directorio público del blog.

## Verificación editorial y continuación

125 checks editoriales/estructurales pasan, seis nuevos de esta serie. Diecinueve
tests del blog pasan. Build50rutas/69HTML y Pagefind pasan; se mantienen diez páginas publicadas,
4280palabras y dos idiomas. Índices242, laboratorios33 y exports83.
Auditor69draft_exists/20related_only/86not_written: inventario, no aceptación del
bloque Kubernetes ni del objetivo global.

Siguiente: bloque Kubernetes de la ruta, con Pods/controladores, Deployment y
ReplicaSet, Services/EndpointSlices/DNS, Ingress, tres probes, ConfigMaps, Secrets/
RBAC, requests/limits/scheduling y HPA. Ampliar el laboratorio con observaciones
reales para esos mecanismos; no presentar metrics-server instalado como autoscaling
probado. Después P066 y restantes series. Conservar los gaps P026, Stripe sandbox
P045 y soak P058, y Serie02 solo estructuras de datos y algoritmos.
