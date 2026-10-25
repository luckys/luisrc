# Terraform y Kubernetes: dos bloques para responsabilidades distintas

P065 exige infraestructura declarativa y orquestación. Se divide para explicar
cada mecanismo antes de combinarlo con los demás. El primer bloque desarrolla
Terraform con un servicio desplegado realmente en Kubernetes local; el segundo
explica los objetos y controladores con experimentos específicos. Ambos bloques
cubren P065 como drafts verificados, con los límites locales documentados.

## Bloque Terraform

1. P065: configuración, grafo, plan, apply y comprobación HTTP.
2. TF-PROVIDERS: dependencias, versiones, lockfile y validaciones.
3. TF-STATE: identidad de recursos, backend, coordinación y datos sensibles.
4. TF-MODULES: límites, variables, outputs y referencias.
5. TF-DRIFT: cambios manuales, refresh-only y reparación declarativa.
6. TF-CHANGES: planes guardados, obsoletos, reemplazos y recuperación.

Manifiesto `terraform-series.json`; drafts solo en español, autor Luis Ramírez
Calle. Código de laboratorio en packages/declarative-infrastructure del monorepo.

## Bloque Kubernetes

1. **K8S-PODS**: [Kubernetes: qué es un Pod y quién mantiene la aplicación ejecutándose](../../src/content/posts/es/kubernetes-pods-api-controladores.md).
2. **K8S-DEPLOYMENTS**: [Deployment y ReplicaSet: cambiar de versión y recuperar la anterior](../../src/content/posts/es/kubernetes-deployments-replicasets-rollout.md).
3. **K8S-SERVICES**: [Services, EndpointSlices y DNS: encontrar una API aunque cambien sus Pods](../../src/content/posts/es/kubernetes-services-endpointslices-dns.md).
4. **K8S-INGRESS**: [Ingress: una regla HTTP necesita un controller que la ejecute](../../src/content/posts/es/kubernetes-ingress-controller-host-rutas.md).
5. **K8S-STARTUP**: [Startup probe: dar tiempo al arranque sin convertirlo en un bucle de reinicios](../../src/content/posts/es/kubernetes-startup-probe-inicializacion.md).
6. **K8S-READINESS**: [Readiness probe: retirar tráfico sin reiniciar el container](../../src/content/posts/es/kubernetes-readiness-probe-trafico.md).
7. **K8S-LIVENESS**: [Liveness probe: cuándo reiniciar ayuda y cuándo multiplica el problema](../../src/content/posts/es/kubernetes-liveness-probe-reinicios.md).
8. **K8S-CONFIG**: [ConfigMaps: por qué cambia un archivo y una variable de entorno sigue igual](../../src/content/posts/es/kubernetes-configmaps-env-volumenes.md).
9. **K8S-SECRETS**: [Secrets y RBAC: codificar un valor no decide quién puede leerlo](../../src/content/posts/es/kubernetes-secrets-serviceaccounts-rbac.md).
10. **K8S-RESOURCES**: [Requests y limits: reservar sitio, limitar consumo y entender un OOMKilled](../../src/content/posts/es/kubernetes-requests-limits-scheduling-oom.md).
11. **K8S-HPA**: [HPA: observar cómo las métricas cambian las réplicas de una API](../../src/content/posts/es/kubernetes-hpa-metricas-escalado.md).

Manifiesto `kubernetes-series.json`. Código en `packages/kubernetes-workloads`:23
fases locales con probes, OOM, permisos y aumento/reducción HPA reales.
El bloque Terraform conserva su propio laboratorio y captura; no se confunden
sus seis recursos con una prueba de cada mecanismo Kubernetes.

## Laboratorios locales y límites

Terraform CLI y K3s se ejecutan en containers fijados; provider Kubernetes fijado
con lockfile. Un clúster efímero propio y una image Node sin dependencias externas.
Seis recursos Terraform: namespace, ConfigMap, Secret ficticio, Deployment, Service
e Ingress. Pruebas HTTP, drift, refresh-only, plan obsoleto y reemplazo de ConfigMap;
teardown de esos recursos y del clúster. No usa kubeconfig personal o cloud.

State, planes y kubeconfig privados ignorados; el sitio solo recibe un resumen
sanitizado con hashes y un visor estático. El laboratorio Kubernetes añade métricas y escalado de réplicas; no prueba
autoscaling de nodos, HA, TLS o capacidad de producción. El de Terraform no
acredita backend remoto o concurrencia de operadores. Ninguno demuestra
disponibilidad continua. P066 continúa con capacidad y costes.
