---
id: P007
title: 'HTTPS y TLS: cifrar una conexión no basta si no verificas con quién hablas'
published: 2026-10-18T02:06:00Z
locale: es
translationKey: computing-https-tls-identity
slug: https-tls-certificados-identidad
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P006]
description: 'Claves de sesión, certificados y cadena de confianza: inspeccionar una conexión TLS y reproducir fallos de confianza y nombre sin desactivar verificación.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [redes, https, tls, seguridad]
---

Una conexión empieza a funcionar cuando desactivamos la verificación del certificado. Hemos eliminado el error, pero también una comprobación que nos protegía de hablar con el servidor equivocado. Que los bytes viajen cifrados no basta si ciframos una conversación con un impostor.

Tras [entender el transporte](/posts/tcp-udp-quic-perdida-latencia), separaremos **confidencialidad, integridad e identidad**. El laboratorio inspecciona TLS real y provoca dos fallos distintos: un emisor no confiable y un nombre que no corresponde al certificado.

## El cifrado simétrico protege el tráfico; el handshake prepara sus claves

En **symmetric cryptography**, las partes utilizan claves secretas para proteger y recuperar información. Los algoritmos de cifrado autenticado utilizados por TLS también permiten detectar modificaciones bajo las condiciones de seguridad del protocolo.

La criptografía **asymmetric** utiliza pares de claves públicas y privadas. Una firma permite verificar determinadas afirmaciones sin publicar la clave privada. No conviene imaginar que todo el contenido HTTP se cifra directamente con la clave pública del certificado: TLS establece claves de tráfico para proteger la comunicación de forma eficiente.

En un handshake habitual de **TLS 1.3** con autenticación mediante certificado, cliente y servidor negocian parámetros, intercambian información de claves, autentican el servidor y comprueban la integridad de la negociación. El protocolo contempla variantes, reanudación y otras opciones que este ejemplo no implementa manualmente.

Cuando se utiliza un intercambio efímero adecuado, comprometer después la clave privada del certificado no revela por sí solo todas las claves de sesiones anteriores. Esa propiedad no protege una máquina ya comprometida que exponga texto claro o secretos de sesión.

## Un certificado vincula identidad y clave según una cadena de confianza

Un certificado **X.509** contiene una clave pública, identidad, periodo de validez, extensiones y una firma del emisor. La clave privada correspondiente no debe formar parte del certificado público ni subirse al repositorio junto al tutorial.

Una **certificate authority**, CA, puede firmar certificados dentro de una cadena que termina en un **trust anchor** aceptado por el cliente. La validación revisa firmas, restricciones y otros requisitos de la cadena. No basta con que un fichero tenga extensión `.pem` o incluya un nombre reconocible.

Confiar en una CA no significa que esa entidad reciba las claves de tráfico de cada conexión. Su papel en este modelo es emitir afirmaciones verificables sobre identidades y claves públicas, bajo sus políticas y la confianza depositada en ellas.

<img src="/assets/visuals/computing-series/P007.svg" alt="El cliente valida cadena y nombre del servicio antes de aceptar la autenticación TLS; un certificado firmado no basta si el trust anchor no es aceptado o el nombre solicitado no aparece en su identidad válida." width="666" height="958" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P007.svg).

## La validez del certificado y el nombre esperado son comprobaciones diferentes

El cliente debe verificar la **service identity** que esperaba contactar. En certificados de servicio se utilizan identidades apropiadas en **Subject Alternative Name**, SAN; no debemos basar una nueva implementación únicamente en el Common Name mostrado por una herramienta.

Una cadena confiable para `example.test` no autoriza al mismo servidor a representar `other.test`. Del mismo modo, un certificado con el nombre correcto puede no ser confiable para ese cliente, estar fuera de su validez o incumplir otros requisitos.

**SNI** permite indicar el nombre solicitado durante la conexión para que el servidor seleccione su configuración. No sustituye la validación de identidad. En el fixture conectamos a la IP loopback y mantenemos explícitamente `localhost` como nombre esperado.

## Tres conexiones locales hacen visible qué se está comprobando

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/computing-networks/experiments.mjs) genera con OpenSSL un certificado autofirmado temporal con SAN `DNS:localhost`. El servicio escucha solo en loopback. No modifica el trust store del sistema y elimina certificado y clave al terminar.

Archivo: `computing-networks/experiments.mjs`, cliente TLS con verificación activa.

```javascript
const socket = tls.connect({
  host: '127.0.0.1',
  port,
  servername: 'localhost',
  rejectUnauthorized: true,
  ...options,
})
```

La primera conexión no proporciona confianza adicional y obtiene **DEPTH_ZERO_SELF_SIGNED_CERT**. El cliente no acepta por defecto ese emisor. La segunda confía explícitamente en el certificado local, pero espera `wrong.test`: obtiene **ERR_TLS_CERT_ALTNAME_INVALID**.

La tercera confía en el fixture y utiliza el nombre correcto. Se observa **authorized=true**, **TLSv1.3**, SAN `DNS:localhost` y el cipher registrado en los resultados. Son datos de esta ejecución, no una lista de configuraciones que debas copiar a cualquier despliegue.

El uso de un certificado autofirmado como ancla local simplifica el experimento. No modela una PKI completa, emisión pública, renovación o revocación. La corrección consiste en configurar confianza y nombre de forma pertinente, no en añadir `rejectUnauthorized:false`.

## HTTPS protege un tramo concreto de la arquitectura

**HTTPS** utiliza HTTP sobre una conexión protegida según sus reglas. Si un balanceador termina TLS y envía después HTTP al backend, hay dos tramos con propiedades distintas. El candado del navegador no demuestra que todo el recorrido interno esté cifrado.

TLS tampoco decide qué usuario puede leer un pedido, si una consulta SQL es segura o si el contenido enviado es verdadero. La autorización de negocio y el tratamiento de entradas continúan siendo responsabilidades de la aplicación.

Incluso una conexión protegida puede dejar información observable, como patrones de tamaño y tiempo o ciertos metadatos de red, según los protocolos y extensiones utilizados. «Todo es invisible» sería una promesa demasiado amplia.

## Elegir confianza explícita no significa aceptar cualquier certificado

En desarrollo, una CA de laboratorio controlada puede evitar desactivar verificación globalmente. En producción suelen interesar automatización de emisión y renovación, observación de expiraciones y una política coherente de confianza.

El **certificate pinning** puede acotar confianza, pero introduce costes de rotación y recuperación. Tampoco debe añadirse por costumbre sin definir qué se fija y cómo se actualiza. Los errores de validación merecen diagnóstico antes que una excepción permanente.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p007/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/computing-networks
```

## Garantías y límites

Se verifican conexiones TLS reales y dos causas de rechazo. No implementamos criptografía propia, revocación, mutual TLS, rotación o una auditoría de configuración productiva. El éxito del handshake no certifica seguridad completa del servicio.

## Ejercicio: conserva una comprobación mientras rompes otra

Repite el cliente con confianza local y cambia únicamente el nombre esperado. Después restaura el nombre y elimina la confianza adicional. El criterio es distinguir ambos errores y explicar por qué desactivar toda validación impediría descubrir la diferencia.

Seguimos con [HTTP, representaciones y caché](/posts/http-semantica-versiones-etag-cache).

## Referencias

- [RFC 8446: TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446).
- [RFC 5280: certificados y validación de cadena](https://www.rfc-editor.org/rfc/rfc5280).
- [RFC 9525: identidad de servicios en TLS](https://www.rfc-editor.org/rfc/rfc9525).
- [Node 24.19.0: API TLS y comprobación de certificados](https://nodejs.org/download/release/v24.19.0/docs/api/tls.html).
