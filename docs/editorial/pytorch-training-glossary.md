# Glosario del pipeline PyTorch

| Término | Significado aquí | Distinción |
| --- | --- | --- |
| Tensor | Valores con shape,dtype ydevice | Un eje necesita significado,no solo tamaño |
| Broadcasting | Expansión lógica de ejes compatibles | Puede calcular pares de muestras no deseados |
| Map-style Dataset | Muestras accesibles por índice | No es el batch ni el sampler |
| DataLoader | Iteración,agrupación ycollation | Su configuración cambia cobertura yorden |
| Generator state | Punto actual de un RNG | No equivale a volver a aplicar la seed inicial |
| nn.Module | Organiza submódulos,parámetros ybuffers | No decide la loss o el training loop |
| nn.Linear | Afín con weight(outputs,inputs) | NumPy anterior almacenaba(inputs,outputs) |
| Logit | Salida antes de sigmoid | BCE con logits espera este valor |
| Online loss | Promedio durante un recorrido con pesos cambiantes | No es loss de los pesos al final de la epoch |
| Eval mode | Comportamiento de capas en evaluación | No desactiva autograd |
| No_grad | Contexto sin registro de gradientes pertinente | No cambia el modo de las capas |
| State_dict | Referencias a estado nombrado | Retenerlo no hace una copia profunda |
| Inference artifact | Estado yconfiguración para predecir | No contiene necesariamente estado para continuar training |
| Resume checkpoint | Estado del modelo ydel proceso de actualización | Aquí solo se garantiza un límite de epoch |
| Weights_only load | Restricción de deserialización | No es la variante de control que solo restaura modelo |
| Exact local resume | Misma trayectoria en el runtime probado | No promete equivalencia entre versiones oCPU/GPU |
