---
id: API-SECURITY
title: 'Seguridad de una API web: CORS, CSRF, XSS y límites de confianza'
published: 2026-10-17T01:06:00Z
locale: es
translationKey: reliable-browser-api-security
slug: seguridad-api-navegador-limites-confianza
draft: true
status: draft
level: intermedio
prerequisites: [API-IDENTITY]
description: 'Sitúa CORS, CSRF, XSS, TLS y SSRF en sus fronteras correctas. Diseña controles verificables sin confundir configuración con autorización.'
author: 'Luis Ramírez Calle'
series: 'APIs y seguridad sin atajos'
tags: [seguridad, api, navegador, csrf, ssrf]
---

Una API permite un único origen en CORS y el equipo da por protegidos sus endpoints. Sin embargo, una herramienta de terminal puede seguir llamándolos. CORS controla ciertos accesos desde navegadores; no determina quién tiene permiso para ejecutar una operación.

Cerramos **APIs y seguridad sin atajos** dibujando las fronteras que deben defenderse por separado. Necesitas [autenticación y autorización](/posts/autenticacion-autorizacion-tenant). El objetivo no es acumular headers, sino saber qué amenaza atiende cada control.

Si necesitas reproducir el comportamiento de un navegador, el bloque ampliado dedica artículos propios a [DOM XSS](/posts/xss-dom-texto-html-contextos), [CSP](/posts/csp-nonces-report-only-defensa-adicional), [CSRF y cookies](/posts/csrf-cookies-samesite-origin-token) y [SOP/CORS](/posts/cors-sop-preflight-no-autorizacion), con un sandbox local y pruebas de Chromium. Este resumen conserva su alcance de revisión de fronteras.

## Sigue las credenciales y los datos no confiables

**TLS** protege el canal y permite autenticar el servidor mediante su certificado, sujeto a la validación correspondiente. No evita que una persona autenticada solicite un objeto ajeno ni que el servidor publique información sensible.

**CORS** regula cuándo el navegador permite a un origen acceder a respuestas de otro. No sustituye autenticación, autorización ni protección CSRF. Una petición puede llegar al servidor aunque el navegador no permita al script leer su respuesta.

**CSRF** explota credenciales enviadas automáticamente, como ciertas cookies: una página ajena induce una acción con la sesión de la víctima. **XSS** ejecuta contenido inyectado bajo la confianza de nuestra propia aplicación. Es un problema distinto y puede derrotar muchas defensas CSRF al actuar desde el origen legítimo.

<img src="/assets/visuals/reliable-services/API-SECURITY.svg" alt="El navegador, la API, la base de datos y el proveedor son fronteras distintas: cookies y CSRF en la entrada, autorización y consultas parametrizadas dentro, allowlist y control de red en la salida." width="874" height="652" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/API-SECURITY.svg).

## Un contrato de mutación basado en sesión

El siguiente control pertenece a una demo con un único origen permitido. `sessionToken` representa un token CSRF aleatorio y secreto ligado a la sesión, no su identificador público.

Archivo: `servicios-fiables/src/security.ts` (extracto).

```typescript
export function allowMutation(
  origin: string | undefined,
  token: string,
  sessionToken: string,
): boolean {
  return origin === 'https://shop.example' && token.length > 0 && token === sessionToken
}
```

Se rechaza un origen ausente porque ese es el contrato cerrado del ejemplo. Una API que también admita clientes no navegador necesita diseñar otra vía autenticada, no aceptar cualquier petición que omita `Origin`.

Las cookies de sesión deberían configurarse según el flujo con **Secure**, **HttpOnly** y **SameSite** apropiado. HttpOnly impide que un script lea la cookie por la API habitual, pero un XSS aún puede ejecutar acciones desde la página. El escape contextual de salida, evitar sinks inseguros y una **CSP** ajustada atienden otra parte del riesgo.

## La salida de red también acepta entradas

Si el cliente proporciona una URL para consultar un resultado, la API podría terminar llamando a la red interna. Es **SSRF**. Una comprobación superficial como «la URL contiene provider.example» permite destinos como `provider.example.evil.test`.

El laboratorio compara el `origin` parseado con un destino fijo HTTPS y rechaza credenciales en la URL. Es mejor no aceptar URLs arbitrarias cuando basta con recibir un identificador y construir la ruta en el servidor.

Esa allowlist sintáctica no cubre resolución DNS, redirects ni todas las redes de destino. Un cliente real debe controlar redirecciones y egress; una redirección del host permitido no autoriza automáticamente al siguiente host.

## Las consultas y los recursos también necesitan límites

El bloque ampliado desarrolla por separado un [threat model multi-tenant](/posts/threat-model-api-multi-tenant-pruebas),
[mass assignment](/posts/mass-assignment-comandos-propiedades-autorizadas) y
[SQL injection con SQLite real](/posts/sql-injection-parametros-tenant-ordenacion).
SSRF continúa en [destinos y redirects](/posts/ssrf-destinos-permitidos-redirecciones)
y [resolución y conexión](/posts/ssrf-dns-validacion-conexion-ip), con fixtures locales.
[Concurrencia](/posts/consumo-recursos-concurrencia-bulkheads) y [cuota temporal](/posts/rate-limiting-token-bucket-tenant)
tienen también entregas propias, locales. Secretos sigue pendiente; este resumen no demuestra esos mecanismos por sí solo.

Para **SQL injection**, utiliza parámetros del driver, no concatenación de valores. Los nombres dinámicos de columnas suelen necesitar allowlists porque no son simples parámetros de datos. Para abuso de recursos, limita tamaño de body, número de resultados, tiempo de consulta y concurrencia, no solo peticiones por segundo.

**Rate limiting** por IP puede ser útil, pero no representa por sí solo al usuario ni al tenant. Un proxy compartido puede agrupar personas legítimas; un atacante puede repartir tráfico. El límite debe responder al recurso que queremos proteger.

## Garantías y límites

Las pruebas verifican las políticas de origen/token y destino. No ejecutan un navegador, una explotación XSS, un handshake TLS ni un ataque DNS. El ejemplo enseña fronteras y casos negativos; no constituye una auditoría ni una configuración de producción completa.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Archivo: terminal, desde `servicios-fiables/`.

```bash
node --test --test-name-pattern="controles de frontera" tests/core.test.mjs
```

## Ejercicio: un threat model pequeño

Para cancelar un pedido, identifica actor, activo, entrada, amenaza y control. Incluye un usuario de otro tenant, una página maliciosa y una URL saliente controlada por el cliente. Cada amenaza debe tener un test o una comprobación operativa asociada; «usar HTTPS» no puede ser la respuesta a todas.

La siguiente serie empieza antes del código: [requisitos, invariantes y capacidad](/posts/requisitos-capacidad-invariantes-servicio).

## Referencias

- [OWASP: CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- [OWASP: SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- [OWASP: prevención de XSS](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

Fuentes consultadas el 17 de octubre de 2026.
