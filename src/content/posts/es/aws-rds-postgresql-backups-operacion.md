---
id: "AWS-RDS"
title: "RDS: gestionar PostgreSQL sin delegar el diseño ni la recuperación"
published: "2026-10-25T14:08:00Z"
locale: "es"
translationKey: "aws-foundations-aws-rds"
slug: "aws-rds-postgresql-backups-operacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-SQS", "DB-MIGRATIONS"]
description: "Qué aporta una base gestionada y qué evidencia sigue faltando para operar y restaurar. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

El equipo activa backups y una opción Multi-AZ y da por resuelta la recuperación de PostgreSQL. Semanas después, un borrado lógico afecta al dato correcto en la instancia principal y en su réplica. Ahora hay que recuperar una versión anterior y volver a conectar la aplicación.

**RDS** reduce trabajo de infraestructura de la base de datos. Después de [SQS y los efectos durables](/posts/aws-sqs-visibilidad-reintentos-batches), conviene precisar qué delegamos y qué evidencia necesitamos antes de decir que podemos recuperar el servicio.

## Una base gestionada sigue necesitando diseño de datos

Con **RDS for PostgreSQL**, AWS gestiona componentes de provisión, mantenimiento y mecanismos de backup. El equipo conserva decisiones de esquema, índices, consultas, permisos SQL, conexiones y compatibilidad de migraciones.

Una consulta sin un índice adecuado puede seguir siendo lenta sobre una base gestionada. Aumentar la clase de instancia cambia recursos, pero no prueba que se haya resuelto el patrón de acceso. Antes de atribuir la saturación a una máquina pequeña necesitamos observar consultas, esperas y uso de recursos.

La aplicación debe usar un rol SQL con las capacidades que necesita. Un IAM role que permite gestionar una instancia no equivale al permiso de hacer `SELECT` sobre cualquier tabla. Autorización del control plane y autorización dentro del motor son fronteras distintas.

No elegimos RDS en el diseño final del catálogo, que propone DynamoDB para una lectura por clave. Lo estudiamos como alternativa relacional para servicios que sí necesitan sus consultas y transacciones. No incluimos un RDS invisible en el presupuesto de la otra arquitectura.

## Multi-AZ, read replica y backup resuelven problemas distintos

Un despliegue **Multi-AZ DB instance** tiene una instancia principal y una standby para failover. Esa standby no sirve lecturas. Existen también **Multi-AZ DB clusters** con otra topología y réplicas que sí pueden atender lecturas; hay que identificar qué modalidad se ha elegido.

Una **read replica** puede descargar lecturas en un diseño adecuado. No debe confundirse con la standby anterior ni con un backup histórico. La aplicación necesita decidir qué lecturas pueden usar una copia y con qué condiciones de consistencia.

Un **backup** permite recuperar datos de otro momento. El failover busca recuperar disponibilidad de la base, no deshacer un `DELETE` válido que el motor ya ha ejecutado. Replicar correctamente una eliminación no la convierte en reversible.

<img src="/assets/visuals/aws-foundations/AWS-RDS.svg" alt="El preflight acepta un plan privado con Multi-AZ y retención, pero conserva restore no verificado. Probar recuperación exige una instancia restaurada, datos validados y el servicio de aplicación operativo." width="300" height="1088" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-RDS.svg).

## Retención configurada y restauración probada son evidencias diferentes

El plan local exige acceso no público, Multi-AZ y retención de siete días. Es una política del ejercicio; no significa que siete días sea el valor correcto para cualquier producto ni el mínimo del servicio.

El helper distingue la configuración aceptada de una restauración verificada:

```typescript
export function reviewManagedDb(plan: { publiclyAccessible: boolean; multiAZ: boolean; backupRetentionDays: number; restoreTested: boolean }) {
  if (plan.publiclyAccessible || !plan.multiAZ || !Number.isInteger(plan.backupRetentionDays)
    || plan.backupRetentionDays < 7 || plan.backupRetentionDays > 35) throw Error('local_db_policy_rejected')
  return { configuredAsRequested: true, restoreDeclaredTested: plan.restoreTested, restoreVerified: false,
    openWork: ['restore_evidence_not_verified'] }
}
```

Incluso si el documento declara `restoreTested: true`, el resultado mantiene `restoreVerified: false`. Un booleano escrito por quien propone el diseño no contiene el resultado de una restauración. El test protege precisamente esa separación.

Un ensayo de recuperación necesitaría identificar origen, punto temporal, destino aislado y validaciones. Después habría que comprobar datos relevantes y que la aplicación funciona con la instancia restaurada. Los tests de negocio importan tanto como ver el estado `available` en la consola.

La [restauración a un punto temporal de RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html) crea una nueva instancia. Hay que revisar su configuración, permisos, conectividad y procedimiento de cambio de endpoint. El laboratorio no ha realizado ninguno de esos pasos en AWS.

## RPO y RTO conectan el backup con el servicio

El **Recovery Point Objective**, o **RPO**, fija cuánta pérdida de datos es tolerable, expresada como una ventana de tiempo. El **Recovery Time Objective**, o **RTO**, fija cuánto tiempo puede tardar la recuperación del servicio.

Retener siete días no demuestra un RPO de cero ni un RTO de cinco minutos. La retención indica qué historial puede estar disponible; la recuperación incluye elegir el punto, restaurar, validar y volver a atender tráfico. Un objetivo sin ensayo debe figurar como objetivo pendiente, no como resultado.

También hay que decidir qué hacer con las escrituras posteriores al punto restaurado y con efectos externos. Recuperar una tabla no revierte automáticamente correos enviados, ficheros creados o respuestas ya entregadas a otros sistemas.

## Las conexiones y el mantenimiento pertenecen al diseño de la API

Cada task o entorno Lambda puede añadir conexiones. Necesitamos un presupuesto agregado, timeouts y una política de recuperación cuando la DB cambia de estado. Un pool pequeño por proceso puede ser grande al multiplicarlo por muchas réplicas.

Las ventanas de mantenimiento permiten planificar actualizaciones, pero hay acciones que pueden afectar a disponibilidad. Conviene probar cómo responde el cliente ante desconexiones y cambios de endpoint, y aplicar reintentos solo donde repetir sea seguro.

Una migración incompatible puede impedir que la versión anterior vuelva a funcionar aunque la base esté saludable. Los [patrones de migración](/posts/rollback-aplicacion-esquema-datos-compatibles) siguen siendo necesarios en RDS.

## Código completo y pruebas

El [plan de operación](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/designs/rds-plan.json) declara qué queda por probar. Tras `git clone https://github.com/luckys/luisrc-blog-examples.git` y la instalación con pnpm:

```bash
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
```

Los tests rechazan exposición pública y conservan `restoreVerified: false` incluso con una declaración optimista. Son pruebas de la política local, no del motor PostgreSQL ni del servicio RDS.

## Garantías y límites

Hay un checklist ejecutable y un plan explícito. No se ha creado RDS, restaurado un backup, medido failover, validado RPO/RTO o ensayado mantenimiento. Multi-AZ y retención no sustituyen esas evidencias.

## Ejercicio: demostrar un RTO

Define el inicio y el final de un ensayo de recuperación. Incluye validación del dato, cambio de conexión y una operación de la aplicación. Separa cuánto tardó la restauración de cuánto tardó el servicio en volver. Continúa con [DynamoDB](/posts/aws-dynamodb-claves-access-patterns) para estudiar una elección distinta de persistencia.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Modalidades Multi-AZ](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html).
- [Backups y restauraciones](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html).
- [Point-in-time restore](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html).
- [Mantenimiento de RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_UpgradeDBInstance.Maintenance.html).
