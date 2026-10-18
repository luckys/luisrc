# Alcance: estructuras de datos y algoritmos

La petición del usuario restringe la Serie 02 a P011 y pide más detalle por tema.
Se desarrolla en 21 entregas, sin Git, paradigmas, lenguajes ni concurrencia de
P010/P012–P019. Las siguientes series del roadmap sí pueden continuar al terminar.
Español, draft y autor Luis Ramírez Calle. Sin publicación, traducción, audio o commit.

Cada entrega responde a una pregunta propia; las dependencias están en
algorithms-series.json. TypeScript es el medio para probar las ideas, no el temario.

| ID | Pregunta y tres objetivos | Tres errores que evitar |
| --- | --- | --- |
| P011 | ¿Qué estructura elegir? Separar ADT/representación; comparar operaciones; mantener índices. | Map universal O(1); lista siempre mejor; índice siempre vigente. |
| DSA-02 | ¿Cómo justificarlo? Definir contrato; conservar invariante; demostrar progreso. | Ejemplo demuestra todo; O son ms; esperado es amortizado. |
| DSA-04 | ¿Array o lista? Localizar antes de mutar; explicar capacidad; distinguir locality. | Borrar siempre O(1); Array tiene layout fijo; ignorar búsqueda previa. |
| DSA-05 | ¿Qué sale primero? Separar FIFO/LIFO; mantener head/tail; tratar vacío. | FIFO es orden final; durabilidad implícita; tail obsoleto. |
| DSA-06 | ¿Qué cuesta un BST? Mantener subárboles ordenados; buscar por rama; medir altura. | BST balanceado por nombre; duplicados sin política; mutar claves. |
| DSA-07 | ¿Cuándo recorrer? Primera coincidencia; probar ausencia; contar n y q. | Orden previo necesario; igualdad indefinida; todas consultas iguales. |
| DSA-08 | ¿Qué intervalo queda? Lower bound; límites semiabiertos; terminación. | Datos desordenados; índice es coincidencia; ! valida. |
| DSA-09 | ¿Qué paga un índice? Resolver colisiones; decidir duplicados; invalidar. | Hash es igualdad; Map solo un paso; set actualiza la clave externa. |
| DSA-10 | ¿Cómo insertar ordenado? Prefijo; desplazar guardando valor; explicar inversiones. | Desplazar iguales; perder value; ignorar copia inicial. |
| DSA-11 | ¿Qué cuesta elegir mínimo? Contar comparaciones; separar swaps; probar inestabilidad. | Adaptación a ordenado; swaps son tiempo; primer mínimo da estabilidad. |
| DSA-12 | ¿Cuándo parar? Seguir pares; mantener sufijo; justificar pasada sin cambios. | Pocos cambios implica orden; simetría de desplazamientos; >= conserva empates. |
| DSA-13 | ¿Cómo mezclar? Cabezas; elegir izquierda en empate; separar memoria/asignaciones. | Recursión sola mejora; < conserva estabilidad; O(n) significa RSS exacto. |
| DSA-14 | ¿Qué hace el pivote? Tres particiones; justificar reducción; analizar desequilibrio. | Centro es mediana; todo quicksort inestable; esta versión in-place. |
| DSA-15 | ¿Cómo sacar prioridad? Forma completa; reparar localmente; decidir empates. | Heap está ordenado; claves mutables inocuas; FIFO por prioridad igual. |
| DSA-16 | ¿Cómo ordenar con heap? Bottom-up; frontera activa; contar alturas. | Construcción O(n log n) ajustada; reparar sufijo; estable. |
| DSA-21 | ¿Cuándo contar? Separar n/k; validar rango; conservar frecuencias. | k son claves presentes; bucles implican nk; reconstruir números conserva objetos. |
| DSA-17 | ¿Cómo guardar relaciones? Dirección/peso; lista/matriz; validar vértices. | Cero es ausencia; vecino faltante es aislado; toda consulta O(1). |
| DSA-18 | ¿Menos aristas? Capas FIFO; marcar al descubrir; reconstruir. | Peso arbitrario; ruta única; audita componentes no visitadas. |
| DSA-19 | ¿Cómo profundizar? Pila; ciclos; contar pendientes duplicados. | DFS mínimo; seen detecta ciclos; O(V) espacio en esta variante. |
| DSA-20 | ¿Menor coste? Relajar; descartar stale; validar pesos y sumas. | Descubrir es fijar; negativos válidos; ignorar O(E) heap. |
| DSA-03 | ¿Compensa indexar? Separar construcción; variar carga; interpretar muestras. | O predice ms; excluir preparación; benchmark es una API. |

## Evidencia requerida

Código probado con casos de borde y 243 entradas exhaustivas pequeñas por cada
ordenación genérica nueva. Verificar estabilidad y contraejemplos por identidad,
BST degenerado, ciclos, pesos cero/negativos/no finitos, overflow y entradas obsoletas.
TypeScript strict, noUncheckedIndexedAccess y extractos iguales al código ejecutado.
ZIP autónomo sin instalación, dos visores con teclado, móvil sin overflow, enlaces
internos y exclusión de drafts del build. Las mediciones archivadas no se regeneran
al ampliar contenido. Los diagramas textuales trazan estados concretos, no son adorno.

## Límites deliberados

No es una enumeración de todos los algoritmos existentes. AVL/red-black, radix,
Bellman–Ford, A*, orden topológico y componentes conexas se mencionan como siguientes
ampliaciones, sin presentarlas como implementadas. Las variantes didácticas no
reemplazan bibliotecas de producción ni prometen rendimientos sin medir.
