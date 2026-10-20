---
id: P005
title: 'De un dominio a un servicio: DNS, direcciones IP, rutas y NAT'
published: 2026-10-18T02:04:00Z
locale: es
translationKey: computing-internet-dns-routing
slug: internet-ip-routing-nat-dns
draft: true
status: draft
math: true
level: intermedio
prerequisites: []
description: 'Separar resolución DNS, rutas IP, puertos y balanceadores; observar un resolver local sin atribuirle pruebas de conectividad por Internet.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [redes, dns, ip, routing]
---

El dominio resuelve a una dirección y, aun así, la aplicación no responde. No hay contradicción: conocer una dirección no demuestra que exista una ruta utilizable, un socket escuchando o una aplicación capaz de atender la petición.

Para investigar ese recorrido separaremos **nombre, dirección, ruta y servicio**. El laboratorio utiliza infraestructura propia en loopback; los saltos por Internet se explican como modelo, no como una captura que no hemos realizado.

## Un dominio, una URL y una dirección IP representan cosas distintas

Una URL como `https://api.example.test:8443/orders` incluye esquema, nombre, puerto y ruta de aplicación. DNS puede ayudar a obtener direcciones para el nombre; no entrega normalmente esa URL completa ni decide qué handler procesa `/orders`.

Una **IP address** identifica una interfaz o destino dentro de un contexto de red. Los **ports** permiten distinguir endpoints de transporte en una dirección. El protocolo también importa: UDP y TCP no comparten un único espacio operativo de sockets por tener el mismo número de puerto.

Una **subnet** agrupa direcciones mediante un prefijo. En IPv4, `/24` significa que los primeros 24 bits pertenecen al prefijo; no es una afirmación de que todos los servicios de esas direcciones sean alcanzables o confiables.

Los rangos privados permiten comunicación dentro de redes diseñadas para ello, pero no son direcciones globalmente enrutables del mismo modo que una dirección pública. IPv6 incorpora otras decisiones de direccionamiento; no debemos trasladar automáticamente todas las prácticas de NAT IPv4.

## Routing decide el siguiente salto, no conoce el endpoint de negocio

Un host consulta su tabla de **routes** para decidir por dónde enviar un paquete. Las rutas más específicas permiten distinguir destinos; una ruta por defecto cubre casos sin una coincidencia más concreta. El siguiente salto puede ser un gateway hacia otra red.

Cada router continúa el proceso según su información, no según la ruta HTTP. En el destino, transporte y aplicación interpretan sus propios campos. Separar estas capas evita intentar arreglar una respuesta 404 cambiando DNS o atribuir una conexión rechazada a un JSON inválido.

**Loopback** permite hablar con el propio host dentro de su espacio de red. El laboratorio comprueba con `ip route get 127.0.0.1` que se utiliza `lo`. No observa routers externos, propagación entre proveedores o traducciones NAT reales.

<img src="/assets/visuals/computing-series/P005.svg" alt="Una URL aporta un nombre; el resolver obtiene una dirección mediante DNS; las rutas llevan paquetes hacia un endpoint que puede ser un balanceador y después un servicio; cada etapa puede fallar de forma independiente." width="610" height="1152" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P005.svg).

## DNS distribuye respuestas sobre nombres, con cachés y autoridades

Un **resolver** recibe preguntas y busca respuestas. Un servidor **authoritative** publica datos de una zona; un resolver recursivo puede consultar la jerarquía y conservar resultados. El cliente del sistema no realiza necesariamente todo ese recorrido cada vez.

Los registros **A** contienen direcciones IPv4 y **AAAA**, IPv6. Un **CNAME** expresa un alias a otro nombre, no un redirect HTTP. La delegación de zonas permite distribuir responsabilidad sin que un único fichero central contenga todos los nombres existentes.

El **TTL** limita cuánto tiempo puede conservarse una respuesta en caché bajo las reglas del protocolo. No obliga a cerrar conexiones abiertas ni sincroniza todas las cachés a la vez. Reducirlo justo al cambiar una dirección tampoco borra copias que ya se obtuvieron con un TTL anterior mayor.

Hay además respuestas negativas y errores distintos de «el nombre no existe». Un timeout del resolver no demuestra NXDOMAIN. Elegir una política de reintentos sin distinguirlos puede convertir un problema pequeño en más carga.

## Un resolver real puede probarse sin tocar el DNS del equipo

El [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/computing-networks/experiments.mjs) crea un servidor UDP limitado al nombre ficticio `lab.test`, ligado a `127.0.0.1` y un puerto efímero. Configura un resolver independiente de Node para consultarlo. No modifica `/etc/resolv.conf`, servicios del sistema o zonas públicas.

Archivo: `computing-networks/experiments.mjs`, selección explícita del DNS local.

```javascript
const resolver = new Resolver({ timeout: 500, tries: 1 })
resolver.setServers([`127.0.0.1:${server.address().port}`])
let httpServer
```

La respuesta observada es **127.0.0.1 con TTL 30 segundos**. Dos llamadas generan dos consultas al fixture: este camino del cliente no añade una caché de resultados. No significa que los navegadores, resolvers recursivos o APIs del sistema tengan que comportarse igual.

El servidor solo implementa la parte del formato necesaria para esta pregunta A/IN. No es un resolver general, no ofrece recursión ni debe exponerse a Internet. Después utilizamos la dirección obtenida para conectar a un servicio HTTP propio en un puerto efímero: responde **200** con la versión uno del recurso. Así distinguimos resolver el nombre de comprobar la conexión y la aplicación.

## NAT y load balancing no son variantes de DNS

**NAT** traduce direcciones y, en su variante de traducción de puertos, también endpoints de transporte. Una conexión saliente puede aparecer externamente con otra dirección y puerto. Esa tabla de traducción es estado de red: perderlo puede afectar conexiones existentes aunque DNS siga igual.

NAT no sustituye una política de seguridad ni garantiza acceso entrante a un equipo privado. Firewalls, rutas y reglas de publicación son decisiones diferentes.

Un **load balancer** reparte tráfico entre destinos. Puede operar a nivel de conexión o interpretar HTTP, según su diseño. Resolver un nombre hacia un balanceador no revela qué instancia atenderá cada petición ni demuestra que sus health checks representen toda la funcionalidad del backend.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p005/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/computing-networks
```

## Garantías y límites

Observamos consultas DNS reales y una ruta local. No medimos propagación pública, NAT operativo, DNSSEC o comportamiento de un proveedor. Una respuesta DNS correcta es una evidencia sobre nombres, no una prueba completa de disponibilidad.

## Ejercicio: clasifica el fallo antes de cambiar configuración

Compara tres situaciones en un entorno propio: nombre inexistente, dirección válida sin proceso escuchando y servidor que devuelve 404. Escribe qué capa produjo cada señal y qué observación la distingue. El criterio es no tratar las tres como «Internet no funciona».

Seguimos con [transporte, pérdida y plazos de entrega](/posts/tcp-udp-quic-perdida-latencia).

## Referencias

- [RFC 1034: modelo de nombres y DNS](https://www.rfc-editor.org/rfc/rfc1034).
- [RFC 3022: traducción NAT tradicional](https://www.rfc-editor.org/rfc/rfc3022).
- [Node 24.19.0: DNS y resolvers independientes](https://nodejs.org/download/release/v24.19.0/docs/api/dns.html).
