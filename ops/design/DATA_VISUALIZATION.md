# DATA_VISUALIZATION.md — ley de datos y gráficos

**Qué es**: cómo se representa un dato en One Burger. Un gráfico **no es decoración**: responde una pregunta
de negocio o no existe.

---

## 1. Primero la pregunta

| Pregunta | Patrón | Cuándo NO |
|---|---|---|
| ¿Cuánto? | **Metric / KPI** (número grande + etiqueta) | si hay más de 4 números compitiendo |
| ¿Subió o bajó? | **Delta** (± valor y porcentaje) + **sparkline** | si no hay período comparable |
| ¿Cómo evoluciona? | **Line / Area** | si hay menos de 3 puntos |
| ¿Quién rinde mejor? | **Barras horizontales / ranking** | si hay más de 8 categorías sin scroll |
| ¿Cómo se distribuye? | **Donut**, solo con **pocas** categorías (≤5) | si las porciones se parecen entre sí |
| ¿Qué requiere atención? | **Lista rankeada / de alertas** con acción | si no hay nada accionable |
| ¿Necesito valores exactos? | **Tabla / lista** | si el usuario solo necesita la tendencia |

> **Si dos números responden mejor que un gráfico, no se crea el gráfico.**

Prohibido: charts decorativos, 3D, arcoíris arbitrario, leyendas complejas cuando las etiquetas directas
funcionan, y gráficos que existen para "llenar" una sección.

## 2. Composición

- **Un gráfico, una pregunta.** Título corto que dice qué se mide y cuál es el período.
- **Contexto antes que precisión**: el número principal, su comparación y su período. El detalle va al
  detalle de la sección dueña, no al chart.
- **Eje Y**: pocas marcas, sin decimales innecesarios, empezando en 0 cuando el volumen importa.
- **Eje X**: tiempo real del negocio (zona horaria configurada), nunca UTC crudo.
- **Área/punto**: máximo 3 series visibles; más que eso es una tabla.
- **Ranking**: una barra por fila, valor al final, orden descendente; incluye unidades vendidas cuando
  aporta.
- **KPI**: número grande en `font-mono` + `tabular-nums`, etiqueta en `text-label`, período en `text-caption`,
  delta con su signo y su color semántico.

## 3. Color de datos

Los gráficos **no eligen colores**: consumen los tokens de datos.

| Token | Uso |
|---|---|
| `chart-primary` | serie principal |
| `chart-secondary` | segunda serie |
| `chart-tertiary` | tercera serie |
| `chart-muted` | serie secundaria, fondo, referencia |
| `chart-positive` | variación positiva / listo |
| `chart-negative` | variación negativa / SLA / alerta |

- La identidad de marca **puede** derivar la serie principal; **jamás** los estados: `positive` y `negative`
  no se recolorean con la marca (misma ley que [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §3.2).
- El color no es el único portador de significado: una serie se distingue también por etiqueta directa,
  posición o patrón. Quien no distingue verde de rojo tiene que poder leer el gráfico igual.
- Máximo **5** colores de datos en pantalla. Si hacen falta más, la pregunta está mal planteada.
- Los valores concretos de los tokens viven en `src/app/globals.css`; ningún componente escribe un hex.

## 4. Labeling y números

- Etiquetas directas cuando entran (una serie); leyenda solo cuando hay 2–3 series y no hay espacio.
- Formato con la **moneda configurada** y separador de miles; nunca `${precio}` ni `NIO` a mano.
- Abreviaturas solo si el valor exacto está disponible al lado o en tooltip (`C$ 12,4 k` + `C$ 12.430,00`).
- Fechas y horas en la zona del negocio; períodos explícitos ("Hoy", "Últimos 7 días", "Este mes").
- Tooltip: valor exacto + período + serie. Sin tooltips que repitan lo que ya dice el eje.

## 5. Accesibilidad

- Todo gráfico tiene su **alternativa textual** (título + resumen del dato principal) y los números clave
  están en texto, no solo en píxeles.
- Contraste ≥ 4.5:1 del texto de ejes/etiquetas sobre el fondo; el color de serie no baja de 3:1 contra el
  lienzo.
- Nada depende de `hover`: la información crítica está visible sin interacción (el hover agrega precisión, no
  la única vía).
- En 375 px, un gráfico o se simplifica o se reemplaza por la lista de valores: **no** se comprime con
  scroll horizontal.

## 6. Densidad

- **Dashboard / Overview**: 3–4 KPI, una tendencia, una lista de señales. Nada más.
- **Operational**: casi nada de gráficos; manda el número y el estado.
- **Management / Detail**: tabla o lista antes que gráfico; un gráfico solo si agrega la comparación.

## 7. Métricas: no se inventan

Toda métrica nueva tiene que poder responder, **antes** de mostrarse:

1. ¿Qué representa?
2. ¿Qué fórmula usa?
3. ¿Qué período cubre?
4. ¿Contra qué se compara?
5. ¿De qué fuente sale (tabla, caso de uso, campo real)?
6. ¿Qué decisión ayuda a tomar?

Sin respuesta fiable a las seis: **no se muestra**. Y si el backend no puede sostener el número, el copy **no
miente**: se dice que todavía no está disponible.

Reglas derivadas de la semántica económica ya vigente: el dinero **devuelto o anulado no es ingreso**; u
`netOrderValue` (lo que realmente quedó) es la base de las métricas comerciales; un pedido con devoluciones
parciales **no** entra en el desglose por producto (omitir antes que inventar).

## 8. Qué NO decide este documento

- **Qué métricas y qué señales lleva una pantalla**: su spec
  ([`screens/TEMPLATE.md`](screens/TEMPLATE.md)) con aprobación del owner.
- **Qué puede calcular el backend**: la arquitectura de producto y el código dueño del dato
  ([`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md) §5–§6).
