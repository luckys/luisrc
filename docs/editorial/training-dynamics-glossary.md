# Glosario: optimización y entrenamiento

| Término | Significado en el laboratorio | Distinción necesaria |
| --- | --- | --- |
| Epoch | Recorrido sin reemplazo del train | No equivale a un optimizer step |
| Batch / minibatch | Grupo para calcular un gradiente medio | Full-batch usa todo el conjunto |
| Microbatch | Parte procesada antes de acumular | No provoca un step por sí sola |
| Effective batch | Muestras que alimentan un único step | Su tamaño real incluye colas incompletas |
| Update / optimizer step | Cambio de pesos y estado | Avanza el reloj del schedule y de Adam |
| Learning rate | Multiplicador del desplazamiento | Su escala depende de loss, reducción y método |
| Momentum buffer | Suma con descuento de gradientes | No es el gradiente actual ni una EMA normalizada |
| First moment | EMA de g en Adam | Incluye signo; corrección por arranque en cero |
| Second moment | EMA de g² en Adam | No es una varianza centrada |
| Bias correction | Dividir por 1−βᵗ | No corrige bias de la red ni errores en los datos |
| Epsilon | Estabilizador fuera de la raíz en Adam | No elimina la necesidad de elegir learning rate |
| L2 penalty | λ/2 por norma cuadrada en la loss | Gradiente λθ; factor depende de la convención |
| Decoupled weight decay | Contracción separada del paso adaptativo | No es equivalente a L2 acoplada en Adam |
| Schedule | Regla de tasas sobre un reloj definido | Warmup no es mejora automática |
| Checkpoint de curva | Evaluación de splits completos al cerrar epoch | Normas y tasa son del último step, no medias |
| Ablation | Cambio declarado respecto a una referencia | No equivale a ajustar toda una familia |
