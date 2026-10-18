---
id: P085
title: 'Fourier, convolución y números aproximados: de las muestras a las frecuencias'
published: 2026-10-18T00:09:00Z
locale: es
translationKey: math-fourier-convolution
slug: fourier-fft-convolucion-errores-numericos
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P076]
description: 'Muestreo, DFT, FFT, aliasing y convolución con una señal sintética reproducible y pruebas de error numérico.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, fourier, fft, audio, python]
---

Una señal contiene dos tonos conocidos, pero la gráfica de muestras solo enseña una curva que sube y baja. Cambiar a una representación de frecuencias permite localizar sus componentes, siempre que entendamos qué información ya se perdió al muestrear.

Usaremos [vectores y productos](/posts/vectores-matrices-tensores-similitud), números complejos elementales y una señal ficticia. No hace falta un micrófono ni un archivo de audio.

## Una muestra no contiene todo lo que ocurrió entre dos instantes

Una sinusoide puede escribirse como $A\sin(2\pi ft+\phi)$: amplitud $A$, frecuencia $f$ en Hz y fase $\phi$. Si muestreamos a $f_s$ muestras por segundo, observamos los tiempos $t=n/f_s$.

El laboratorio genera **64 muestras a 64 Hz**: una ventana de un segundo. Combina una sinusoide de **5 Hz y amplitud 1** con otra de **12 Hz y amplitud 0,5**.

Los números complejos, de la forma $a+bi$ con $i^2=-1$, permiten representar conjuntamente componentes de fase. Python utiliza `j` para la unidad imaginaria. No significa que la señal de entrada tenga que ser compleja: nuestras muestras son reales.

## La DFT compara la señal con patrones de frecuencia discretos

La **discrete Fourier transform**, o **DFT**, calcula:

$$
X_k=\sum_{n=0}^{N-1}x_n e^{-2\pi i kn/N}.
$$

Para cada bin $k$ combinamos las muestras con un patrón oscilatorio. La magnitud informa de su contribución y la fase también contiene información. Conservar solo magnitudes no permite reconstruir en general la señal completa.

La separación entre bins es $f_s/N$. Aquí vale 1 Hz, por lo que los tonos coinciden con bins enteros. La [referencia FFT de NumPy](https://numpy.org/doc/stable/reference/routines.fft.html) documenta convenciones de signos, frecuencias y normalización.

<img src="/assets/visuals/math-series/P085.svg" alt="Una señal de 64 muestras a 64 hercios contiene tonos de cinco y doce hercios; FFT obtiene los bins de la DFT, pero el muestreo permite aliasing entre frecuencias distintas." width="1012" height="822" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P085.svg).

## FFT calcula la misma transformación con otro algoritmo

La DFT directa del laboratorio realiza un sumatorio completo por bin, con coste cuadrático. La **fast Fourier transform**, o **FFT**, no es otra definición de espectro: es una familia de algoritmos más eficientes para calcular esa transformación.

La implementación didáctica **radix-2** separa muestras de índices pares e impares y combina las transformadas menores. Requiere una longitud potencia de dos.

Archivo: `matematicas-estadistica/foundations.py`, combinación recursiva de `fft` tras validar longitud y caso base.

```python
    even, odd = fft(signal[::2]), fft(signal[1::2])
    twiddles = [cmath.exp(-2j*math.pi*k/n)*odd[k] for k in range(n//2)]
    return [even[k]+twiddles[k] for k in range(n//2)] + [even[k]-twiddles[k] for k in range(n//2)]
```

La prueba compara todos sus coeficientes con una DFT directa independiente y admite un error menor que `1e-10` para esta señal. También comprueba amplitudes conocidas. No hemos medido tiempos ni prometemos que esta implementación Python compita con NumPy.

<img src="/assets/visuals/math-series/spectrum.svg" alt="Espectro calculado de la señal sintética con picos en cinco hercios de amplitud uno y doce hercios de amplitud cero coma cinco." width="900" height="460" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/visuals/math-series/spectrum.svg).

Para la gráfica unilateral normalizamos por $N$ y duplicamos los bins interiores positivos. No duplicamos DC ni Nyquist. Esa convención importa para no interpretar una magnitud arbitrariamente escalada como amplitud física.

## Aliasing y resolución no se arreglan dibujando más puntos

Muestreados a 64 Hz, un coseno de 59 Hz y otro de 5 Hz coinciden en los instantes observados. El test lo comprueba. Ese **aliasing** no permite recuperar cuál era la frecuencia original solo con esas muestras.

Para representar sin ambigüedad una señal limitada en banda se necesita una frecuencia de muestreo adecuada, superior al doble de su frecuencia máxima, y control de las componentes fuera de banda antes del muestreo. Una FFT posterior no sustituye el filtro antialiasing.

Al aumentar la duración observada, estrechamos la separación entre bins. Añadir ceros a una ventana fija densifica la representación, pero no añade observaciones. Una frecuencia que no encaja en bins enteros muestra **spectral leakage**; usar ventanas cambia el compromiso entre dispersión y anchura de los picos.

Las ventanas cortas localizan mejor cambios temporales a costa de discriminar peor frecuencias próximas. Este compromiso volverá al estudiar espectrogramas de audio.

## Convolución combina una señal con un kernel desplazado

La **discrete convolution** lineal completa es $y_n=\sum_k x_k h_{n-k}$, interpretando cero fuera del soporte. La demo calcula `[1,2,3]` convolucionado con `[1,1]` y obtiene **[1,3,5,3]**.

Un kernel puede suavizar o resaltar cambios según sus coeficientes. Multiplicar espectros sin padding adecuado produce convolución circular, no necesariamente esta salida lineal. Algunas APIs de redes, como [Conv1d de PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv1d.html), llaman convolution a una operación de correlación; revisa orientación y padding antes de comparar resultados.

## Garantías y límites

[El laboratorio](/assets/examples/matematicas-estadistica-lab.zip) prueba FFT frente a DFT, dos picos, aliasing y convolución. No implementa procesamiento en streaming, STFT, filtros antialiasing o una biblioteca numérica optimizada.

Con floats, comprobar una identidad mediante igualdad exacta puede fallar por redondeo. Una tolerancia debe relacionarse con escala y método; no aumentarse hasta ocultar un algoritmo incorrecto. Las [notas de Python sobre coma flotante](https://docs.python.org/3.12/tutorial/floatingpoint.html) explican esa representación aproximada.

## Ejercicio: un tono entre bins

Cambia 5 Hz por 5,5 Hz y compara el espectro. El resultado no debe concentrarse en un único bin. Conserva duración y muestreo, identifica leakage y explica qué cambiaría al observar dos segundos en vez de rellenar con ceros el mismo segundo.

Con esta base podemos abordar Machine Learning sin tratar shapes, gradientes o métricas como detalles que decide automáticamente una biblioteca.

## Referencias

- [NumPy: DFT y convenciones FFT](https://numpy.org/doc/stable/reference/routines.fft.html).
- [SciPy: Fourier analysis](https://docs.scipy.org/doc/scipy/tutorial/fft.html).
- [PyTorch: Conv1d y cross-correlation](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv1d.html).
- [Python: floating-point arithmetic](https://docs.python.org/3.12/tutorial/floatingpoint.html).

Fuentes consultadas el 18 de octubre de 2026. Señal y espectro generados localmente, sin grabaciones reales.
