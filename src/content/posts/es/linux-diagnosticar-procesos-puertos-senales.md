---
id: P004
title: 'Linux para diagnosticar un servicio: del puerto al proceso y al cierre'
published: 2026-10-18T02:03:00Z
locale: es
translationKey: computing-linux-diagnostics
slug: linux-diagnosticar-procesos-puertos-senales
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P003]
description: 'Relacionar PID, sockets, permisos, descriptores y señales para investigar un servicio Linux sin cambiar procesos o configuración ajenos.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [linux, procesos, observabilidad, diagnostico]
---

Un servicio no responde y el log termina en «listening». Antes de reiniciarlo conviene comprobar si ese proceso sigue vivo, dónde escucha y si estamos mirando los logs de la misma ejecución. Un mensaje de arranque describe algo que ocurrió, no el estado actual del sistema.

Este artículo continúa [procesos, hilos y memoria](/posts/procesos-hilos-memoria-virtual-bloqueos). Aprenderemos a relacionar **PID, puerto y descriptores**, revisar permisos y solicitar un cierre controlado. El laboratorio solo opera sobre procesos que él mismo crea.

## Empieza por identificar el recurso que falla

Un puerto no identifica por sí solo una aplicación. Un socket de escucha tiene dirección local, puerto y protocolo; el proceso mantiene un descriptor asociado a él. Dos servicios pueden utilizar el mismo número de puerto si escuchan en direcciones o espacios de red distintos.

**ss** permite observar sockets y, cuando tenemos permisos, los procesos asociados. **ps** muestra procesos con sus PID, estado y comando. La primera pregunta no es «¿cómo mato Node?», sino «¿qué proceso posee exactamente el socket al que estoy intentando conectar?».

Escuchar en `127.0.0.1` limita el servicio al loopback de ese espacio de red. No equivale a escuchar en todas las interfaces. Dentro de un contenedor, localhost tampoco señala automáticamente al host o a otro contenedor.

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/computing-networks/service.mjs) crea un hijo con un puerto efímero, recibe su PID y puerto por IPC y consulta únicamente esos recursos. No busca por nombre ni utiliza un `killall` que pueda afectar a otros proyectos.

## La jerarquía de archivos ayuda a distinguir configuración, estado y observación

En un sistema Linux habitual, `/etc` contiene configuración del sistema, `/var` datos variables y `/tmp` temporales. `/proc` expone una vista del kernel sobre procesos y recursos; no es una carpeta de documentos persistentes de la aplicación.

Una ruta relativa se resuelve desde el **working directory** del proceso, no necesariamente desde la carpeta del script. Un servicio que funciona desde la IDE puede fallar bajo otro directorio si busca `config.json` sin una base explícita.

El laboratorio fija el directorio del hijo y crea sus fixtures en una carpeta temporal única. Una aplicación desplegada debería decidir por separado dónde busca configuración, dónde puede escribir y qué datos deben sobrevivir a un reinicio.

## Usuario, grupo y permisos explican por qué «el archivo existe» no basta

Los permisos clásicos distinguen propietario, grupo y otros usuarios, con bits de lectura, escritura y ejecución. En un directorio, ejecutar permite recorrerlo: tener lectura sobre un fichero no ayuda si no podemos atravesar una carpeta de su ruta.

El fixture de memoria se crea solicitando modo **0640**: propietario con lectura/escritura, grupo con lectura y sin acceso para otros. La **umask**, ACL y políticas adicionales pueden restringir el resultado. No debemos solucionar un fallo de permisos dando acceso universal a toda la carpeta.

Las **environment variables** forman parte de la configuración recibida por el proceso. Cambiar una variable en otra terminal no reconfigura mágicamente un proceso ya arrancado. Tampoco conviene volcar todo su entorno al log: podría contener tokens o credenciales.

En el ejemplo solo se configura `LAB_MESSAGE=fixture`, un valor ficticio conocido. No registramos variables reales del equipo.

<img src="/assets/visuals/computing-series/P004.svg" alt="El diagnóstico relaciona el puerto observado con ss, el PID confirmado con ps, sus descriptores y logs; solo después envía SIGTERM al hijo propio y verifica su cierre." width="658" height="1104" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P004.svg).

## stdout y stderr también son recursos abiertos

Un **file descriptor** es una referencia que el proceso utiliza para acceder a un recurso abierto. Por convención, cero corresponde a stdin, uno a stdout y dos a stderr. Pueden apuntar a terminales, ficheros o pipes, no solo a archivos de texto.

Una redirección cambia dónde termina esa salida. Un **pipe** conecta la salida de un proceso con la entrada de otro; su capacidad es limitada, así que un consumidor lento puede introducir backpressure. No es una cola durable por conectar dos comandos con una barra vertical.

La vista `/proc/<pid>/fd` ayuda a investigar qué tiene abierto un proceso propio. El número de descriptor puede reutilizarse después de un cierre, por lo que una observación antigua no identifica para siempre el mismo recurso.

El servicio escribe eventos JSON de una línea en stdout. Su supervisor recoge `ready`, `request` y `shutdown`. Este encuadre simplifica la lectura, pero no garantiza persistencia del log ni impide que varios productores intercalen salidas si comparten destino.

## SIGTERM es una solicitud que la aplicación debe atender

**SIGTERM** permite a una aplicación iniciar su cierre. **SIGKILL** fuerza su terminación sin darle oportunidad de ejecutar un handler. Un cierre ordenado suele dejar de aceptar trabajo nuevo, terminar o cancelar operaciones pendientes y cerrar recursos.

Archivo: `computing-networks/service.mjs`, handler del servicio de prueba.

```javascript
process.on('SIGTERM', () => {
  log('shutdown')
  server.close(() => process.exit(0))
  server.closeIdleConnections()
})
```

El ejemplo solo gestiona conexiones HTTP simples. Un worker con tareas largas necesitaría deadlines, seguimiento de operaciones y una política para lo que no consiga terminar. Instalar este handler no hace durables sus efectos pendientes.

El test confirma el PID con `ps`, el puerto con `ss`, una respuesta 200 y el cierre con código cero tras SIGTERM. Si el hijo no termina, un watchdog acotado actúa sobre ese mismo handle. Esa protección del laboratorio no es una receta para terminar procesos por un PID copiado de ayer.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p004/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/computing-networks
```

## Garantías y límites

La secuencia verifica un servicio local y su ciclo de vida. No comprueba firewall, balanceador, contenedores remotos o persistencia de peticiones reales. Una conexión aceptada tampoco demuestra que una dependencia del servicio esté disponible.

## Ejercicio: diagnosticar sin reiniciar

Arranca una copia propia de `service.mjs` y anota PID, dirección y puerto comunicados. Confirma que el socket existe, realiza una petición y relaciona su evento con el proceso. Solicita después SIGTERM y comprueba que desaparecen tanto proceso como escucha. El ejercicio falla si actúas sobre un servicio no creado por ti.

Seguimos con [qué ocurre entre un nombre de dominio y una conexión](/posts/internet-ip-routing-nat-dns).

## Referencias

- [Linux man-pages: señales](https://man7.org/linux/man-pages/man7/signal.7.html).
- [Linux man-pages: descriptores en proc](https://man7.org/linux/man-pages/man5/proc_pid_fd.5.html).
- [Linux: ss](https://man7.org/linux/man-pages/man8/ss.8.html).
- [Node 24.19.0: proceso y entorno](https://nodejs.org/download/release/v24.19.0/docs/api/process.html).
