# Evidencia numérica

experiments.json es la salida de experiments.py bajo runtime.json. Datos ficticios,
semilla 20261018; bootstrap con semilla 17. SHA-256 de dataset/protocolo en el propio
registro. Las gráficas leen esta salida, no transcripciones manuales de valores.

No hay benchmark: no se miden tiempos ni hardware. Conservamos curvas completas,
predicciones finales e IDs. Comparar floats con tolerancia numérica; semilla y digest
no prometen identidad bit a bit entre todas las arquitecturas.
