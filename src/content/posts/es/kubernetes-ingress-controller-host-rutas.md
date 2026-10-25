---
id: "K8S-INGRESS"
title: "Ingress: una regla HTTP necesita un controller que la ejecute"
published: "2026-10-25T16:03:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-ingress"
slug: "kubernetes-ingress-controller-host-rutas"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-SERVICES"]
description: "Cómo seguir host, ruta, Service y Pod sin confundir declaración con proxy. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

El objeto Ingress aparece en el API, pero ninguna petición alcanza la aplicación. Crear la regla no ha puesto necesariamente un proxy a ejecutarla ni ha resuelto cómo entra tráfico en el clúster.

Después de [Service, EndpointSlices y DNS](/posts/kubernetes-services-endpointslices-dns), vamos a seguir una petición HTTP desde el host del laboratorio hasta el catálogo, usando **Traefik** como Ingress controller.

## Ingress declara reglas; el controller las implementa

Un **Ingress** describe reglas de entrada, como host, path y Service de destino. Un **Ingress controller** observa esos recursos y configura el componente que recibe y dirige tráfico.

**IngressClass** permite indicar qué clase de implementación debe atender la declaración. El campo `ingressClassName: traefik` del ejemplo no instala Traefik. El clúster K3s utilizado ya lo incluye y el harness espera a que esté disponible.

Aceptar una regla en el API y tener el controller preparado son condiciones diferentes. La clase, su configuración y la ruta de entrada real deben formar parte del diagnóstico.

<img src="/assets/visuals/kubernetes/K8S-INGRESS.svg" alt="El cliente conecta a la entrada loopback y envía el Host del catálogo. Traefik implementa la clase y regla Ingress, elige el Service y dirige la petición hacia el puerto de un backend preparado." width="257" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-INGRESS.svg).

## Host y path eligen el Service

Este es `spec` de nuestro Ingress:

```json
{
  "ingressClassName": "traefik",
  "rules": [
    {
      "host": "catalogue.lab.test",
      "http": {
        "paths": [
          {
            "path": "/",
            "pathType": "Prefix",
            "backend": {
              "service": {
                "name": "catalogue",
                "port": {
                  "number": 80
                }
              }
            }
          }
        ]
      }
    }
  ]
}
```

Una petición para `catalogue.lab.test`, con un path que coincide con el prefijo `/`, se dirige al Service `catalogue` en su puerto `80`. El Service conecta ese puerto con el puerto nombrado de la API.

Un Ingress de este tipo referencia un Service de su namespace. Si escribimos el nombre de un Service que vive en otro, no lo descubrimos automáticamente por tener el mismo texto.

**Prefix** aplica reglas de coincidencia por componentes de path; no es una expresión regular arbitraria. El prefijo raíz permite nuestro recorrido completo, pero no define autenticación ni una política de autorización para el catálogo.

## Publicar la entrada es otra parte del diseño

K3s despliega Traefik y su integración de red local. El laboratorio publica el puerto HTTP del nodo-container en un puerto aleatorio de **127.0.0.1** del host. Esa es la entrada que consulta el harness.

No estamos creando un load balancer de AWS, una IP pública o un certificado. En otra plataforma habría que definir DNS externo, exposición del controller y TLS según sus mecanismos.

El dominio de ejemplo se usa como cabecera HTTP. No se añade una entrada al DNS público ni se modifica `/etc/hosts`. La conexión TCP se realiza al puerto loopback del laboratorio y la cabecera selecciona la regla.

Esta separación también ayuda a probar: podemos variar `Host` manteniendo el mismo destino TCP y observar si el enrutamiento HTTP cambia como esperamos.

## Una prueba positiva necesita su contraparte negativa

La fase `ingress_rules` exige dos resultados: el host correcto devuelve el catálogo con `200`; `wrong.lab.test` obtiene `404`. Conserva además el controller declarado por la IngressClass.

Un `404` aislado no demostraría que el controller correcto funciona. El par de pruebas distingue un recorrido válido de otro que no tiene una regla coincidente. El cuerpo de ese `404` puede pertenecer al proxy y no tener el formato JSON de la API.

El cliente del harness utiliza `node:http` para enviar el Host explícito. Sus tests verifican esa cabecera con un servidor local. Así no atribuimos un fallo del cliente de pruebas a la regla de Kubernetes.

Más adelante una readiness fallida producirá otro resultado: habrá regla coincidente, pero faltará un backend preparado. Son causas distintas aunque el usuario solo vea que no obtiene el catálogo.

## Ingress sigue necesitando decisiones de seguridad y evolución

La ruta de entrada no sustituye la autorización de la aplicación. Tampoco cualquier anotación es portable entre controllers. Si utilizas opciones específicas, su compatibilidad y actualización pasan a formar parte del diseño.

**Gateway API** ofrece otro conjunto de APIs para entrada de tráfico y casos de routing. La documentación de Kubernetes recomienda considerarla para nuevas capacidades; no necesitamos introducir sus recursos para entender este Ingress concreto.

Elegimos Traefik por la distribución fijada del laboratorio y probamos su comportamiento. El artículo no supone que todos los controllers o proveedores respondan igual en todos los errores.

## Código completo y pruebas

El [Ingress completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/ingress.json) y el [cliente HTTP](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/scripts/request.mjs) están en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads test
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

## Garantías y límites

Se observan routing por Host, entrada local y respuesta del catálogo. No hay TLS, DNS público, autenticación de usuarios, load balancer externo o Gateway API desplegados. La presencia de un Ingress no acredita esas propiedades.

## Ejercicio: el mismo Service con otro host

Explica qué cambiaría al añadir otro dominio que debe llegar al mismo catálogo. Separa regla HTTP, DNS y certificado. Indica qué prueba negativa conservarías para evitar aceptar cualquier host accidentalmente. Continúa con [startup probe](/posts/kubernetes-startup-probe-inicializacion).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Ingress e IngressClass](https://kubernetes.io/docs/concepts/services-networking/ingress/).
- [Servicios de red de K3s](https://docs.k3s.io/networking/networking-services).
- [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/).
