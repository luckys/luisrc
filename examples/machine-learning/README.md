# Machine Learning clásico: laboratorio de la serie

Código, datos y resultados educativos. No contiene datos personales ni mediciones
de producción. Los 900 envíos válidos fueron generados artificialmente con semilla 20261018. La lista de diez problemas está en tasks.json.

## Ejecutar sin instalar paquetes

Se necesita Node 22+ y Docker con la imagen indicada en runtime.json **ya disponible**.
El runner usa `--pull=never`: si falta, falla, no descarga ni instala nada. El ZIP
no incluye la imagen (ni NumPy, pandas o scikit-learn). En esta entrega reutilizamos
la imagen científica local, sin instalar paquetes con pip/conda ni modificar pnpm.
Si tu entorno no tiene estas dependencias, revisa los resultados archivados antes
de decidir por separado cómo preparar un entorno equivalente.

Desde esta carpeta, tanto en el repo como tras extraer el ZIP:

```sh
node run.mjs tests
node run.mjs results
```

El segundo comando imprime JSON y no sustituye el archivo archivado. En un entorno
Python que ya tenga las versiones de runtime.json, también puedes ejecutar:

```sh
python -B -m unittest discover -s tests -v
python -B experiments.py
```

Docker se ejecuta sin red, filesystem de solo lectura y montaje de solo lectura;
solo /tmp es efímero y escribible. Limita CPU/memoria. No deja un servidor arrancado.

## Datos, cortes y contrato

- data/logistics-v1.csv: 909 filas; seis duplicados exactos por ID y tres filas
  adicionales inválidas. clean() deja 900; mantiene diez distancias y cinco cargas nulas.
- Una fila por envío, orden de salida diario; el fixture supone resultado disponible
  antes de la salida siguiente. No usar esta simplificación si las etiquetas llegan tarde.
- Features: distancia (km), carga (fracción), previsión binaria de lluvia y centro.
  La previsión representa información conocida antes de salir, no lluvia observada después.
- delay_minutes es un resultado firmado: puede ser negativo (adelanto). delayed es
  uno si delay_minutes > 30. No entra como feature, ni shipment_id ni departure.
- Train: filas 0:540; validation: 540:720; test: 720:900, después de limpiar y ordenar.
- protocol.json fija tres referencias finales, métrica AP y threshold 0,5 antes de
  ejecutar. Los ajustes y diagnósticos restantes usan train/validation. Nunca seleccionar
  configuraciones nuevas por los resultados de test; reservar otra evaluación para ello.

## Qué calcula cada archivo

`explorer.html` y `explorer.mjs` ofrecen un gráfico dinámico de umbrales y costes.
Desde esta carpeta se puede abrir con un servidor local:

```sh
python3 -m http.server 4401 --bind 127.0.0.1
```

Abre http://127.0.0.1:4401/explorer.html y detén el servidor con Ctrl+C. Node no
necesita dependencias para comprobar el núcleo del explorador. validation.json
contiene únicamente predicciones de validation, no las de test. La copia pública
está enlazada desde el artículo de métricas. No abrir con file://, porque fetch
necesita servir el JSON por HTTP.

data.py genera y valida el fixture. models.py construye pipelines, métricas y casos
pequeños con resultados conocidos. experiments.py contrasta referencias y conserva
curvas, predicciones finales, hashes y versiones en su salida. Los tests incluyen
separación temporal, imputación train-only, categoría desconocida, OLS contra sklearn,
AP, matriz de confusión, calibración, geometría y bootstrap pareado.

La limpieza usa reglas de contrato fijadas, no selección basada en test. Las
relaciones de EDA se calculan solo en train. La selección de profundidad usa
TimeSeriesSplit dentro de train. CalibratedClassifierCV usa también folds temporales
y ensemble=True; su comparación cambia el estimador base además de calibrarlo.

## Resultados y límites

results/experiments.json contiene datos para gráficas y predicciones para reconstruir
las métricas de test. Sin tiempos ni afirmaciones de velocidad. En estos datos la
logística supera a los ensembles de configuraciones fijas; no es un ranking universal.

Bootstrap: 2.000 remuestreos pareados, semilla 17, intervalo percentile de pérdidas
fijas en validation. No reentrena modelos ni estima cobertura temporal. Tres semillas
del bosque no son un intervalo inferencial. No se ejecutan XGBoost/LightGBM/SHAP,
tracking remoto, causal inference, fairness certificada ni despliegue.

## Regenerar desde la raíz del blog

```sh
node scripts/run-ml-lab.mjs tests
node scripts/run-ml-lab.mjs data
node scripts/run-ml-lab.mjs results
node scripts/render-ml-series.mjs
node scripts/package-ml-series.mjs
```

`data` y `results` reemplazan explícitamente los artefactos versionados correspondientes.
No regenerarlos para ocultar una diferencia: revisar antes el cambio de datos, código,
protocolo o entorno. El generador de gráficos utiliza dependencias pnpm ya existentes.
