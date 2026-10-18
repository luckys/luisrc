# Identidad web: sesiones, rotación y OIDC

Node 24.19.0, pnpm 12.8.1 y OpenSSL disponibles en PATH. Dependencias fijadas en
pnpm-lock.yaml: oidc-provider 9.12.2, openid-client 6.8.8 y jose 6.2.12.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm serve
```

`serve` imprime dos puertos efímeros. Abre la URL **RP HTTPS**. El certificado es
autofirmado y temporal: la excepción del navegador es exclusivamente para ese
laboratorio local. El OP HTTP escucha también solo en 127.0.0.1. No abrir estos
puertos a la red, no utilizar identidades reales y no desactivar TLS globalmente.
Ctrl+C detiene ambos servidores y elimina los dos archivos de certificado/clave
y su directorio temporal exacto. No se guardan claves en este proyecto.

## Cuatro artículos, dos ejercicios complementarios

| Entrega                                | Código                        | Evidencia                                                                |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| P026: sesiones y cookies               | state.mjs / Sessions; lab.mjs | hash, fixation, expiración, cookie HTTPS, logout y rechazo de Origin     |
| API-SESSION-REFRESH: rotación          | state.mjs / RefreshFamilies   | token usado, revocación familiar, access corto y carrera local           |
| P027: OAuth/OIDC y PKCE                | lab.mjs                       | discovery, interacción, autorización, canje y verifier incorrecto        |
| API-OIDC-VALIDATION: validar identidad | identity.mjs                  | firma con JWKS del OP, iss/aud/exp/iat/nonce/sub/azp y callback repetido |

**No es un único servicio OAuth de producción.** El RP obtiene un ID token del
OP y crea una sesión opaca local de 30 minutos. No pide offline_access ni conserva
el access token del OP. El modelo RefreshFamilies es un ejercicio separado: no
es la implementación de refresh del proveedor ni está conectado a la cookie RP.
No existe un endpoint público que entregue refresh tokens a JavaScript.

## Pruebas y límites

Diez tests Node, con varias variantes negativas. Los de estado inyectan reloj y
no esperan minutos reales. Los de protocolo usan un OP oidc-provider real en
loopback, discovery, JWKS y firmas RS256 efímeras. No necesitan cuenta o API key.
Las claves privadas para tokens adversariales se crean dentro del test; no se
exponen en una ruta HTTP ni se distribuyen.

El driver HTTP de tests confía únicamente en el certificado generado y simula
cookies por origin. **No es un navegador y no demuestra SameSite/HttpOnly.** La
comprobación adicional de Chromium vive en scripts/check-api-identity-browser.mjs
del repositorio del blog; usa su Playwright ya instalado, no una dependencia
oculta necesaria para `pnpm test`. Comprueba el flujo y las flags en un navegador
real, no una cobertura completa de CSRF, XSS o compatibilidad entre navegadores.

El OP utiliza devInteractions: el navegador exige escribir un nombre y una
contraseña ficticios, pero el servidor **no comprueba esa contraseña ni MFA**.
No escribas una contraseña real. Sus avisos al arrancar son intencionados. Un formulario real,
protección antiabuso, recuperación de cuenta, persistencia y despliegue HTTPS del
OP quedan fuera. En producción se elegiría un proveedor operado con esas medidas.
La UI de desarrollo del OP referencia una fuente de Google; el test Chromium
bloquea toda petición fuera de 127.0.0.1 y no depende de esa fuente.
La configuración de cliente público sin secret es una simplificación local, no
una recomendación para todo backend confidencial.

Map vive en un proceso y se pierde al reiniciar. Los registros caducados se
rechazan al consultarlos; no hay un recolector completo o límite global de memoria.
No expongas el laboratorio a carga o entradas de Internet. La rotación síncrona
es atómica solo dentro de este proceso: una base compartida necesitaría operación
condicional/transacción. La política estricta revoca la familia ante dos usos del
mismo refresh, incluso si proceden de pestañas legítimas o una respuesta perdida.

Logout revoca solo la sesión RP; no termina la sesión del OP ni implementa
revocación OAuth RFC 7009. Los access del modelo se comprueban contra estado en
cada llamada: esa revocación inmediata no se puede prometer para cualquier JWT
validado offline. No hay resource server, permisos por objeto, M2M, MFA o pagos.
