---
id: "AWS-EC2"
title: "EC2: ejecutar una aplicación también significa operar su máquina"
published: "2026-10-25T14:03:00Z"
locale: "es"
translationKey: "aws-foundations-aws-ec2"
slug: "aws-ec2-maquina-virtual-operacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-VPC"]
description: "Qué decisiones asumes al elegir una máquina virtual y cómo separar proceso, disco y capacidad. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

El proceso responde correctamente en local y la decisión parece sencilla: «lo ponemos en una máquina de AWS». Falta concretar qué mantiene vivo ese proceso, cómo se actualiza la máquina y dónde quedan los datos cuando hay que sustituirla.

**EC2** ofrece máquinas virtuales. Es una opción útil cuando necesitas controlar el sistema operativo o ejecutar software con requisitos específicos. Ese control añade decisiones operativas que no aparecen en un `npm start`. Tras [la red de la API](/posts/aws-vpc-subnets-rutas-endpoints), vamos a separar máquina, proceso y almacenamiento.

## Una AMI y un instance type responden a preguntas diferentes

La **Amazon Machine Image**, o **AMI**, define la base con la que arranca la instancia: sistema operativo y software incluido. El **instance type** determina una combinación de recursos y características de hardware.

Elegir más vCPU no instala una versión de Node ni corrige una fuga de memoria. Elegir una AMI actualizada tampoco demuestra que la capacidad alcance para la carga. Son entradas distintas del entorno.

Después del arranque necesitas configurar el proceso, suministrarle su configuración, ejecutarlo con una identidad adecuada y decidir cómo arranca tras un reinicio. Puedes automatizarlo con una image propia y mecanismos de inicialización. Hacer esos pasos a mano por SSH dificulta repetirlos al sustituir la instancia.

La libertad de instalar paquetes puede ser necesaria para software heredado o agentes particulares. Si la API solo requiere un runtime habitual y HTTP, conviene valorar si mantener ese sistema operativo aporta una ventaja concreta al equipo.

## Un servidor HTTP no es una estrategia de operación

El catálogo del laboratorio puede ejecutarse mediante un servidor Node. Este es el adaptador completo de `src/http.ts`:

```typescript
import { createServer } from 'node:http'
import { catalogueRequest, catalogueHeaders } from './catalogue.ts'
import type { Reader } from './catalogue.ts'
export function createCatalogueServer(read: Reader) {
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://catalogue').pathname
      const result = await catalogueRequest(req.method ?? 'GET', path, read)
      res.writeHead(result.statusCode, catalogueHeaders(result.statusCode)); res.end(JSON.stringify(result.body))
    } catch { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'dependency_unavailable' })) }
  })
}
```

La función recibe la dependencia de lectura en lugar de construir un cliente de DB internamente. Así probamos respuestas de éxito, ausencia y fallo sin necesitar una cuenta AWS. La lógica del catálogo permanece en otro archivo y puede reutilizarse en el adaptador Lambda. El helper compartido `catalogueHeaders` añade `Allow: GET` cuando responde `405`, además de indicar el formato JSON.

El test abre un puerto loopback efímero y realiza peticiones reales. Eso demuestra el comportamiento de este adaptador. No demuestra arranque al reiniciar Linux, rotación de logs, TLS, límites de conexiones o recuperación de EC2. El host del test tampoco es una instancia EC2.

Para operarlo en una máquina faltaría un contrato de proceso: usuario, comando, señales, configuración, supervisión, límites y healthchecks. El cierre ordenado debería dejar de aceptar trabajo nuevo y terminar o cancelar el que esté en curso dentro de un plazo. No basta con que el proceso exista en la lista de tareas.

<img src="/assets/visuals/aws-foundations/AWS-EC2.svg" alt="La AMI y el instance type permiten arrancar una máquina, pero el equipo mantiene el sistema operativo y supervisa la API. Los datos externos conservan un ciclo de vida separado del proceso." width="297" height="1088" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-EC2.svg).

## El disco puede tener un ciclo de vida distinto al proceso

**EBS** proporciona almacenamiento de bloques que una instancia puede usar. Sus volúmenes y la configuración de borrado requieren atención independiente. **Instance store**, cuando está disponible, tiene otras condiciones de persistencia y no debe confundirse con un volumen durable externo.

Nuestra API no guarda estado propio en el disco de la máquina. El catálogo se propone en DynamoDB. Esa elección facilita reemplazar compute sin trasladar archivos locales, pero no elimina la necesidad de proteger los datos externos.

Un log guardado únicamente en el filesystem del host puede perderse justo cuando más interesa investigarlo. El diseño de observabilidad debe decidir cómo se recopila, cuánto se conserva y qué ocurre si falla su envío. No hemos instalado ese agente en este ejercicio.

## Escalar una instancia y escalar un servicio son tareas diferentes

Aumentar el tamaño de una máquina puede dar más recursos a un proceso compatible. Añadir instancias exige repartir tráfico, supervisar salud y sacar estado compartido del proceso. Un **Auto Scaling Group** puede mantener capacidad declarada; necesita una configuración de lanzamiento y políticas adecuadas.

Si el cuello de botella es una consulta lenta, añadir servidores puede multiplicar conexiones hacia la misma base. Antes de automatizar el escalado conviene medir CPU, memoria, latencia, errores y saturación de dependencias.

También hay un trabajo de actualización: preparar la nueva versión, comprobarla, retirar instancias antiguas y poder recuperar servicio. La [serie de despliegues](/posts/ci-cd-pipeline-gates-evidencia) explica por qué sustituir una versión implica más que copiar archivos.

## Detener compute no borra todos los cargos

Según el [ciclo de vida de EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html), una instancia detenida deja de facturar el uso de instancia, pero otros recursos pueden seguir generando cargos, como volúmenes EBS o direcciones IP. Hibernar y terminar tienen condiciones diferentes; tampoco cancelan automáticamente compromisos de reserva.

La limpieza debe inventariar recursos asociados, no limitarse a ver una máquina apagada en la consola. En este laboratorio no hay instancias ni una estimación EC2: no añadimos un precio de máquina a una comparación cuyo alcance son Lambda y ECS.

## Código completo y pruebas

Consulta el [adaptador HTTP](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/src/http.ts) y los [tests de adaptadores](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/tests/adapters.test.mjs). Tras `git clone https://github.com/luckys/luisrc-blog-examples.git` e instalar con pnpm:

```bash
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations typecheck
```

## Garantías y límites

Se ha probado HTTP local con un reader ficticio. No hay AMI construida, instancia lanzada, supervisor instalado, recuperación del host o escalado medido. El ejemplo de código ilustra el proceso que alojaríamos; no es una configuración EC2 de producción.

## Ejercicio: sustituir la máquina sin perder el servicio

Enumera qué necesita una máquina nueva para atender el catálogo. Separa software, configuración, permisos, rutas y datos. Explica cómo comprobarías cada elemento antes de retirar la antigua. Continúa con [Lambda](/posts/aws-lambda-eventos-concurrencia-limites) para ver qué cambia al entregar una función en lugar de mantener ese proceso.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Conceptos de Amazon EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html).
- [Estados y facturación de instancias](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html).
- [Amazon EC2 Auto Scaling](https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html).
- [Instance store](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/InstanceStorage.html).
