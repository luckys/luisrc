# Estadísticas del artículo sobre roles en IT

Consulta: 2026-10-13. Las versiones española e inglesa conservan `draft: true`.
Los nombres de archivos, identificadores y código son ingleses; las etiquetas
visibles de las gráficas siguen el idioma de cada versión.

## Datos, fuentes y decisiones

La selección de ofertas explica responsabilidades. Las estadísticas añadidas
proceden de otras fuentes y no representan un ranking de esos anuncios ni de
títulos como Product Engineer, Staff o Tech Lead.

- **Eurostat:** conjunto `jvs_a_isco3_r1`, filtros `freq=A`,
  `geo=EU27_2020`, `time=2024`, `indic_em=OJA`, `unit=THS`.
  [API utilizada](https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/jvs_a_isco3_r1?lang=EN&geo=EU27_2020&time=2024&indic_em=OJA&unit=THS).
  Cuatro categorías ISCO-08 seleccionadas: `OC251`, `OC351`, `OC252`, `OC133`.
  Sus valores son 363,04; 66,22; 63,42 y 22,2 miles. El agregado `ICT` es
  633,69 miles; las cuatro categorías no lo agotan. Los valores llevan `b`,
  ruptura de serie temporal. Se usa una comparación de volumen dentro de 2024,
  no una variación frente a 2023. Último año disponible: 2024; actualización
  del conjunto: 2026-02-17.
  [Metadatos](https://ec.europa.eu/eurostat/cache/metadata/EN/jvs_a_isco3_r1_esmsip2.htm).
  Es el indicador de anuncios online, no `JOBVAC`, vacantes. Cobertura parcial,
  duplicados y clasificación automática limitan la interpretación.
- **Indeed Hiring Lab:** `US/job_postings_by_sector_US.csv`,
  versión `8c73e908f6b0bae8448706b033102de008ff78dc`, `jobcountry=US`,
  `variable=total postings`. Última fecha: 2026-10-02. Se compara con
  2025-10-02, utilizando ambas observaciones de la misma versión revisada.
  [Archivo original](https://github.com/hiring-lab/job_postings_tracker/blob/8c73e908f6b0bae8448706b033102de008ff78dc/US/job_postings_by_sector_US.csv).
  Crecimiento: `(indexTo / indexFrom - 1) * 100`. Diferencia frente al
  2020-02-01: `indexTo - 100`. La referencia vale 100. Resultados redondeados
  a un decimal; el generador conserva los índices originales para el cálculo.
  [Metodología](https://hiring-lab.github.io/job_postings_tracker/): ajuste
  estacional, media móvil de siete días, posibles revisiones históricas.
  Licencia CC BY 4.0, atribución en el artículo, datos y gráfica.
  No es un conteo absoluto por categoría, ni contrataciones, ni empleo.
- **BLS:** [tabla 1.2](https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm),
  horizonte vigente **2025–2035**. Se transcriben seis filas SOC y sus columnas
  de cambio porcentual y oportunidades anuales promedio. No se emplean las
  anteriores proyecciones 2024–2034. Las oportunidades se publican en miles
  y se multiplican por 1.000 para la tabla del artículo.
  [Cálculo del BLS](https://www.bls.gov/opub/hom/emp/calculation.htm):
  crecimiento y salidas de la ocupación generan oportunidades; estas no son
  solo puestos nuevos. La variación de empleo es acumulada en diez años y
  proyectada, no observada. SOC e ISCO no son títulos comerciales equivalentes.

No se comparan directamente las magnitudes de las tres fuentes ni se atribuyen
sus variaciones a IA. Todas las conclusiones sobre mayor volumen o crecimiento
quedan acotadas a las categorías seleccionadas.

## Recursos y reproducción

Extracto de los datos: `public/assets/data/it-roles-2026-10-13.json`, enlazado
desde el artículo y con fuentes, periodos, filtros, unidades y fórmulas.

```bash
node assets/it-roles/generate-charts.mjs
node assets/it-roles/generate-charts.mjs en
```

El generador usa ECharts en modo SSR y escribe cuatro SVG en
`public/assets/visuals/it-roles/`, y sus versiones inglesas en el subdirectorio
`en/`. No hace consultas externas ni actualiza datos.
Las etiquetas abreviadas de las gráficas se corresponden con los nombres
originales de las tablas o el JSON. Solo se generan imágenes; no se importa
ECharts en componentes ni se añade JavaScript al cliente.

## Verificación

- Valores y marcas de Eurostat contrastados programáticamente con su JSON-stat.
- Ocho índices de Indeed contrastados con el CSV original; fórmulas y redondeos
  comprobados. Cifras BLS contrastadas con las filas de la tabla vigente.
- Revisión independiente de fuentes y cautelas metodológicas.
- Inspección visual de los cuatro SVG rasterizados: etiquetas, escalas y unidades.
  Se corrigieron el solapamiento de marcas del eje y la coherencia de miles en UE.
- Markdown procesado con Astro: nueve tablas y cuatro imágenes con dimensiones,
  texto alternativo, carga diferida y enlaces para ampliar. SVG sin scripts
  ni animaciones. Tamaño conjunto: aproximadamente 35 kB por idioma antes de compresión.
- `pnpm build` completado. El borrador sigue excluido de las rutas de producción.
  No se ha verificado el diseño del artículo completo en un navegador.
- Traducción inglesa completa: 38 encabezados, nueve tablas, fuentes y cifras
  conservadas. Las cuatro gráficas inglesas tienen etiquetas y formato numérico
  localizados. Inspección visual de los cuatro SVG ingleses rasterizados.
- La generación con idioma español sigue produciendo exactamente los mismos
  SVG después de añadir la opción de idioma.

La verificación confirma que se han utilizado y explicado las cifras publicadas;
no elimina los límites de cobertura, clasificación o proyección de las fuentes.

## Ampliación: puestos y estadísticas de IA

Se comparan siete familias de responsabilidades, sin presentar todas como
profesiones nacidas con la IA generativa. Research Scientist, Research Engineer
y prácticas MLOps pueden precederla. Se distinguen implementación de producto,
agentes, investigación, plataforma, evaluación, seguridad, prompts y contexto.
RAG y MCP no se presentan como títulos profesionales estandarizados.

Ocho ejemplos adicionales de ofertas primarias consultadas el 2026-10-13:
tres de OpenAI, dos de Mistral y uno de Cohere verificados como `isListed=true`
en sus API públicas Ashby; MCI y Capgemini en sus portales oficiales con opción
de candidatura visible. Incluyen Estados Unidos, Londres y París. Los títulos
y funciones se citan como ejemplos específicos, no definiciones universales.

Dos nuevas medidas, guardadas también en el JSON descargable:

- **Lightcast / Stanford HAI:**
  [AI Index 2026, capítulo 4](https://hai.stanford.edu/assets/files/ai_index_report_2026_chapter_4_economy.pdf),
  figuras 4.4.5 y 4.4.7, páginas impresas 207–208 (páginas 37–38 del PDF del
  capítulo). Anuncios de Estados Unidos que mencionan habilidades, 2024–2025:
  Prompt engineering 6.152 → 22.227; AI agents 1.310 → 15.217; RAG
  2.885 → 12.609; Context engineering 9 → 703. Cifras contrastadas en el texto
  y las páginas renderizadas del PDF original. Crecimiento calculado sobre los
  recuentos y redondeado a un decimal. Categorías solapadas: no sumar, ni
  equiparar con vacantes que lleven esos títulos. La base de nueve anuncios
  acompaña siempre al crecimiento porcentual de context engineering. No se
  confunde AI agents con Agentic AI o Agentic systems. Gráfica con barras
  agrupadas por año y recuentos absolutos, no porcentajes extremos.
- **Indeed Hiring Lab:**
  [análisis de títulos con IA, 2026-07-08](https://hiringlab.indeed.com/2026/07/08/ai-is-no-longer-just-a-tech-occupation-story/).
  Primer trimestre de 2026: EE. UU. 822, Alemania 288, Reino Unido 160,
  Francia 138, Países Bajos 84, España 81 categorías de títulos normalizados.
  Se requiere al menos cinco anuncios con menciones de AI, GenAI, AGI o
  artificial intelligence (y equivalentes lingüísticos) en el título original
  por trimestre y categoría. Incluye ocupaciones no técnicas. No mide anuncios,
  contrataciones o profesiones nuevas, ni intensidad de demanda comparable
  entre países. No se fabrica un ranking de los siete grupos editoriales.

Las versiones ES y EN conservan las mismas fuentes, cifras y delimitaciones,
con 38 encabezados, nueve tablas y cuatro gráficas por idioma. Código y nombres
de archivos en inglés. Nuevos SVG: `us-ai-skill-postings-2024-2025.svg`, incluido
el subdirectorio `en/`. Inspección visual de las versiones rasterizadas; no se
añaden librerías ni JavaScript al cliente.

## Revisión del puesto de CTO

CTO solo aparecía como referencia en la oferta de Principal Engineer. Se añadió
una sección propia en ambos idiomas, con el significado de Chief Technology
Officer, estrategia tecnológica, decisiones de inversión y organización,
variaciones según tamaño de empresa y diferencias de alcance con Tech Lead
y Engineering Manager. Fuente primaria:
[Unipro, CTO](https://www.unipro.io/career/chief-technology-officer-cto/),
consultada el 2026-10-13, con descripción y vía de candidatura disponibles.
Se descartó el anuncio indexado de True Classic: el puesto no estaba listado
en su API pública al comprobarlo. No se incorporan estadísticas específicas
de CTO que las fuentes utilizadas no permiten separar.

## Lectura e interpretación de las estadísticas

Se amplió la explicación de cada medida en ambos idiomas, manteniendo las
cifras y los SVG de la consulta original:

- Eurostat: códigos ISCO-08 como identificadores, alcance UE-27, conversión
  de miles a unidades, selección parcial del agregado y ruptura de serie.
- Indeed: índice con base 100, anuncios totales frente a nuevos, ajuste
  estacional, media móvil y referencias de cada barra. Ejemplo contrastado:
  64,30 → 78,33 da +21,8 % interanual y −21,7 % frente a la base 2020.
- BLS: códigos SOC, crecimiento acumulado proyectado y oportunidades anuales
  con sustituciones. Se compara crecimiento relativo de ciencia de datos con
  volumen de oportunidades de software y se explica que un descenso del empleo
  no elimina la necesidad de reemplazos.
- Habilidades de IA: recuentos por año, colores de las barras, parámetros de
  la fórmula y diferencia entre aumento y total final. Prompt engineering:
  16.075 anuncios adicionales, +261,3 %, total aproximadamente 3,61 veces el
  inicial. Se explica el efecto de la base pequeña de context engineering.
- Títulos con IA: normalización de variantes, umbral de cinco anuncios por
  categoría y trimestre y lectura de los 81 grupos de España. No son anuncios
  ni profesiones nuevas, ni un ratio de vacantes entre países.

Las explicaciones añaden ejemplos de interpretación, sin nuevos datos,
dependencias ni cambios en la ejecución del blog.
Verificación de esta revisión: ejemplos numéricos recalculados desde el JSON,
fuentes idénticas en ambos idiomas y Markdown renderizado con Astro (38
encabezados, nueve tablas y cuatro imágenes por idioma). Revisión independiente
del español sin hallazgos. Se comprobó el formato; no se repitió el build completo
para este cambio exclusivamente editorial.

## Generación de las narraciones

Generación solicitada expresamente por el autor el 2026-10-13, incluyendo los
borradores. Se mantienen las voces `es-ES-AlvaroNeural` y `en-US-AndrewNeural`.
El cliente JavaScript `edge-tts-universal` 1.4.0 devolvió HTTP 403. Para esta
generación se utilizó `edge-tts` 7.3.1 en un entorno Python temporal, mediante
la función de síntesis inyectable de `generatePair`; no se cambiaron dependencias
del blog ni el generador habitual.

[Versión oficial 7.3.0](https://github.com/rany2/edge-tts/releases/tag/7.3.0):
soporte del protocolo actualizado. La
[versión 7.3.1](https://github.com/rany2/edge-tts/releases/tag/7.3.1) corrige el
análisis de fechas del servidor. Se conserva el procesamiento habitual del
artículo, la caché de fragmentos, los fingerprints y la unión y comprobación de
MP3 con FFmpeg. El manifiesto se actualiza únicamente cuando ambos idiomas
terminan correctamente.

Ambos audios completados: español 3.103,392 segundos (51:43) e inglés
2.796,480 segundos (46:36). MP3 mono a 24 kHz; decodificación completa
comprobada por el generador. Fingerprints contrastados con los textos finales
y voces del manifiesto. Pasan las diez pruebas de audio y `pnpm build`; los
artículos siguen como borradores.
