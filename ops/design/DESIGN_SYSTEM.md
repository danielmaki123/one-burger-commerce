# DESIGN_SYSTEM.md — One Burger Design System v4

**Qué es**: la **fuente de la ley visual** de One Burger — el Design System v4—. Define **cómo se diseña**
cualquier superficie del producto: pantallas del panel, menú público, POS, KDS, admin, charts y estados.

**Qué NO decide** (y por eso no se busca acá): qué módulos existen ni dónde pertenece una feature
(eso es [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)); qué contenido necesita
una pantalla concreta, qué KPI lleva Resumen o qué secciones nuevas se crean (eso es la spec de esa
pantalla, con aprobación del owner).

## Cadena de autoridad

```text
Owner / decisión explícita de producto
        ↓
Seguridad / integridad / accesibilidad
        ↓
AGENTS.md
        ↓
ops/product/MODULE_ARCHITECTURE.md
        ↓
ops/design/DESIGN_SYSTEM.md   ← este documento
        ↓
spec aprobada de pantalla (ops/design/screens/<pantalla>.md)
        ↓
src/shared/ui/registry.json
        ↓
implementación
```

**Una sola fuente visual.** El material de `ops/references/stitch/` queda **ARCHIVED / NON-NORMATIVE**:
se conserva como historia y evidencia, no se lee por obligación, no decide un diseño nuevo. Ningún
documento visual histórico compite con esta cadena.

**Estado**: `v4`, creado por `DS-001` (2026-09-25). Describe el sistema **real** del repo y fija las reglas
que faltaban. **No rediseña ninguna pantalla**: los tokens y valores de hoy siguen siendo los de hoy, y la
migración de cada sección se hace de a una, con el owner.

---

## 1. Principios

One Burger debe sentirse: **premium, limpio, operativo, rápido, preciso, moderno, denso cuando conviene,
táctil cuando corresponde y consistente.**

> **Premium no es más elementos. Es menos ruido y mejores decisiones visuales.**

Prohibido como lenguaje: decoración, marketing visual dentro del panel, cards por todas partes, sombras
exageradas, gradientes gratuitos, párrafos explicativos y animación ornamental.

Cinco leyes que resuelven la mayoría de las discusiones:

1. **Una intención, un token.** Un componente pide intención semántica; nunca un color concreto.
2. **Primero el componente que existe.** Antes de crear, se busca en `src/shared/ui/` y en el registro.
3. **Jerarquía antes que decoración**: tamaño, peso, espacio y posición —no color ni sombra— crean jerarquía.
4. **El número manda**: todo valor operativo (plata, tiempo, ID, contador) se lee de un vistazo y no tiembla.
5. **Accesibilidad comprobada gana sobre estética.** Contraste, foco, teclado y tamaño táctil no se negocian.

---

## 2. Modos

| Superficie | Modo | Lienzo |
|---|---|---|
| **Panel** (Admin, POS, KDS, Caja) | **oscuro**, `class="dark"` en el shell | `bg-canvas` |
| **Público** (menú, carrito, checkout, seguimiento) | **claro**, con la paleta que configura el negocio | `bg-background` |

El `dark` vive en el shell del panel y **nunca** en el layout raíz (oscurecería al público). Un overlay
montado en un **portal** tiene que llevar su propio alcance de modo o sale en el modo equivocado.

Nada de contenedores blancos planos en el panel: las superficies se distinguen por **capas**, no por bordes
gruesos.

---

## 3. Color

### 3.1 Ley

Los componentes consumen **intención semántica**:

```text
brand-primary   brand-accent   brand-muted    surface        surface-elevated
ink             ink-secondary  ink-muted      line-control
status-success  status-warning status-danger  chart-primary
```

**Prohibido dentro de un componente**: `#hex`, `rgb()`, `rgba()`, `hsl()` y `hsla()`, y la paleta cruda de
Tailwind (`sky-400`, `amber-500`, `rose-600`, `slate-900`, …). Un componente pide **intención**; el valor
vive en el token.

**Dónde el color crudo SÍ es legítimo** (por eso el contrato no lo mide ahí): la **fuente de tokens**
(`src/app/globals.css`, con sus modos y derivaciones), los **presets y defaults de color** del negocio y las
**herramientas de color** del dominio (`src/modules/business-settings/domain/`: contraste, color de categoría)
donde el hex es el dato, y los **tests** de contraste.

**Ratchet**: lo viejo está congelado por archivo en `src/shared/config/design-tokens.allow.json` y **la deuda
nueva hace fallar el CI** —incluida la de `rgb()`/`rgba()`/`hsl()` desde DS v4—. No se obliga a limpiar la
existente: se congela. **Está prohibido subir un techo para pasar el CI.**

### 3.2 Las tres categorías

| Categoría | Qué es | Quién la controla | Tokens |
|---|---|---|---|
| **BRAND** | identidad del negocio | **configurable** por el owner en `/admin/settings` | `--brand`, `--brand-strong`, `--brand-foreground`, `--brand-primary`, `--brand-accent`, `--brand-muted`, `--accent`, `--background`, `--foreground`, `--card`, `--font-heading`, `--font-body` |
| **STRUCTURE** | lienzo, superficies, texto, bordes, radios, sombras | el **sistema** (derivados, no editables de a uno) | `--bg-canvas`, `--bg-surface{,-low,-card,-elevated,-input}`, `--text-{primary,secondary,muted,inverse}`, `--border-{subtle,medium,strong,control,focus}`, `--radius-*`, `--shadow-*` |
| **SEMANTIC** | significado operativo | **protegido**: la marca no lo puede reescribir | `--status-{pending,prep,ready,sla,inactive}-{bg,border,text,dot}`, `--status-{nueva,preparando,lista,cerrada,alerta}`, `--success|warning|danger|info-{soft,strong}`, `--pickup-{on-time,past,late}` |

**Regla dura**: personalizar la marca **jamás** puede cambiar un estado. Un `danger` no se vuelve verde
porque el negocio eligió verde, y un SLA vencido no puede dejar de llamar la atención.

**La ley es la intención, no el color.** `brand-primary` es *la* intención de marca (identidad y acción) y
`brand-accent` la secundaria; qué color concreto tiene cada una **no es ley**, es **tema** (lo que el negocio
configura, con sus defaults). **Tema vigente, documentado y no normativo**: hoy el acento es ámbar y el
primario azul cielo, y el panel viene usando el acento para cocina y el primario para administración,
navegación y POS — una asignación que el owner puede cambiar **sin tocar la ley**. Lo que sí es ley: un
componente pide `brand-primary`/`brand-accent` y **nunca** un color ni una asignación fija por superficie.

---

## 4. Theming (BusinessSettings → tokens)

Arquitectura real y vigente:

```text
BusinessSettings (base de datos)
   └── businessSettingsStyleVariables()  · dominio
        └── <html style="--brand: …">    · layout raíz
             ├── público y componentes compartidos  → la marca SÍ llega
             └── panel (.dark)                      → los alias del panel ganan
```

- El negocio elige **primary, accent, background, foreground, surface y tipografías**; el sistema deriva
  hover, tintes, sombras y estados con `color-mix()`.
- El panel oscuro usa **constantes del sistema** para su marca de trabajo (hoy `--brand-primary`), así que
  la identidad configurada **no** lo alcanza. Es **deuda declarada**, no un descuido de una pantalla:
  conectarla es una decisión de producto por sección.
- Los **estados semánticos no son configurables** (§3.2), y los presets de color del admin pasan su propio
  control de contraste, así que el owner no puede dejar el sitio ilegible de un click.

**Lo que `DS-001` dejó preparado**: el vocabulario de tokens (§5) para que la marca pueda alimentar Menú,
Admin, POS, KDS y charts **sin hardcode por componente**, y la regla de que esa conexión se hace por
sección. Recolorear el producto de una vez está prohibido.

---

## 5. Tokens

Un nombre canónico por intención. Los **aliases** existen solo para migrar y **solo se achican**.

| Familia | Nombres canónicos | Aliases en migración (no crecen) |
|---|---|---|
| **Color — estructura** | `bg-canvas`, `bg-surface`, `bg-surface-low`, `bg-surface-card`, `bg-surface-elevated`, `bg-surface-input`, `line-*`, `ink`, `ink-secondary`, `ink-muted`, `ink-inverse` | `background`, `card`, `secondary`, `muted`, `accent`, `border`, `input`, `foreground`, `muted-foreground` |
| **Color — marca** | `brand-primary`, `brand-primary-hover`, `brand-primary-muted`, `brand-accent`, `brand-accent-hover`, `brand-accent-soft` | `brand`, `brand-strong`, `brand-foreground`, `brand-amber`, `brand-amber-hover`, `brand-amber-soft`, `terracotta`, `gold`, `cream`, `coal`, `ink-green` (ADN del público) |
| **Color —semántica** | `status-*` (§3.2), `success-*`, `warning-*`, `danger-*`, `info-*` | `success`/`warning`/`danger` + `-foreground` |
| **Datos** | `chart-primary`, `chart-secondary`, `chart-tertiary`, `chart-muted`, `chart-positive`, `chart-negative` | `chart-1` … `chart-5` |
| **Tipografía** | **público**: `text-display`, `text-kpi`, `text-title`, `text-headline`, `text-body`, `text-label`, `text-caption` · **panel**: `text-panel-{display,title,section,item,body,body-lg,meta,overline}` | `text-title-sm`, `text-headline-md`, `text-headline-lg`, `text-body-sm`, `text-label-sm`, `text-label-xs` · **`text-st-*`** (nomenclatura histórica del panel: alias del mismo valor, solo compatibilidad) |
| **Spacing** | escala de Tailwind (§7). **No se crean tokens de spacing**: son números, no intenciones | — |
| **Radius** | `rounded-card` (16 px), `rounded-panel` (24 px), `rounded-full` y la escala de Tailwind (`rounded-sm|md|lg|xl|2xl`) | **`rounded-stitch-{xs,sm,md,lg,xl,2xl}`** (nomenclatura histórica: se conserva por compatibilidad, **no** es la recomendada para código nuevo) |
| **Bordes** | `border-line-subtle`, `border-line-medium`, `border-line-strong`, `border-line-control`, `border-line-focus` | `border-border`, `border-input` |
| **Elevación** | `shadow-elevation-1..4` (panel), `shadow-card`, `shadow-raised`, `shadow-float` (público, teñidas por marca) | — |
| **Motion** | `--motion-fast`, `--motion-standard`, `--motion-emphasized`, `--motion-ease-standard`, `--motion-ease-emphasized` | `duration-*`/`ease-*` de Tailwind, mapeados en [`MOTION.md`](MOTION.md) |
| **z-index** | solo cuando haga falta: `--z-sticky`, `--z-overlay`, `--z-modal`, `--z-toast` (**FALTANTE**: hoy se usan números sueltos de Tailwind) | — |

**Prohibido perpetuar equivalencias**: `--brand`, `--brand-primary`, `--primary` y `--main-blue` no son
cuatro conceptos. `--primary`, `--popover`, `--destructive`, `--ring` y `--sidebar-*` están **eliminados** y
no vuelven (borrar `--ring` además rompe el foco: Tailwind compila `outline-ring/50` a `var(--ring)`).

**No se sobre-tokeniza**: si un valor no se reutiliza ni cambia por modo o por marca, es un número, no un token.

---

## 6. Tipografía

Dos escalas, una por superficie, y **un componente no mezcla las dos**. Los nombres del panel son neutrales
(`text-panel-*`); `text-st-*` es la **nomenclatura histórica del mismo valor** y se conserva solo por
compatibilidad con el código que ya existe (**no** es la recomendada para código nuevo, y **no** se migra en
bloque):

| Nivel | Público | Panel (canónico) | Panel (histórico) |
|---|---|---|---|
| Dato principal / KPI | `text-display` (56) · `text-kpi` (32) | `text-panel-display` (32) | `text-st-display` |
| Título de página | `text-title` (32) | `text-panel-title` (24) | `text-st-h1` |
| Título de sección | `text-headline` (20) | `text-panel-section` (20) | `text-st-h2` |
| Subtítulo / ítem | `text-title-sm` (20) | `text-panel-item` (16) | `text-st-h3` |
| Cuerpo | `text-body` (14) | `text-panel-body` / `text-panel-body-lg` (14/15) | `text-st-body` / `text-st-body-lg` |
| Metadato | `text-caption` (12) | `text-panel-meta` (12) | `text-st-caption` |
| Etiqueta | `text-label` (11, tracking amplio) | `text-panel-overline` (10, MAYÚSCULAS) | `text-st-overline` |

Familias reales: **Fraunces** (display del público), **Inter** y **Plus Jakarta Sans** (elegibles por el
negocio), **JetBrains Mono** (números del sistema, obligatoria).

Reglas:

- **Jerarquía por tamaño, peso y espacio.** No todo es bold: dos pesos por pantalla alcanzan (400/700).
- **Números**: `font-mono` + `tabular-nums` para plata, cronómetros, IDs, PIN y contadores. No es
  decoración: evita que la interfaz tiemble cuando el valor cambia.
- Interlineado corto en datos y cómodo en texto largo; tracking negativo solo en tamaños grandes.
- Una pantalla no inventa un nivel nuevo: si hace falta, se discute acá.

---

## 7. Spacing y densidad

Ritmo: la escala de **4 px** de Tailwind (`1` = 4 px, `2` = 8, `3` = 12, `4` = 16, `6` = 24, `8` = 32,
`12` = 48). Nada de valores arbitrarios (`p-[13px]`), que ya están congelados por contrato.

```text
elementos estrechamente relacionados   →  1–2  (4–8 px)
grupos                                 →  3–4  (12–16 px)
bloques                                →  6–8  (24–32 px)
secciones                              →  8–12 (32–48 px)
```

Densidad por arquetipo (ver [`PATTERNS.md`](PATTERNS.md)):

- **Dashboard / Operational**: denso. En el **primer viewport** (375 px) entran el **estado crítico**, **la
  acción principal** y la información mínima para **iniciar** la tarea (§12); lo secundario puede requerir
  scroll vertical.
- **Management**: media; una fila por entidad, con aire entre filas.
- **Configuration**: puede respirar más, pero **progressive disclosure** manda (§ [`CONTENT.md`](CONTENT.md)).

Premium **no** es enorme espacio vacío: es ritmo consistente. Y **no** se comprime desktop: se preserva la
jerarquía (§12).

---

## 8. Surfaces, bordes, radios y elevación

**Superficies por capas** (panel): `canvas` → `surface` → `surface-low` → `surface-card` → `surface-elevated`.
Un elemento se eleva **un** nivel para separarse; dos niveles de anidado visual ya son un problema de diseño.
En el público, la superficie es `card` sobre `background`, con las sombras teñidas por la marca.

**Bordes**: `line-subtle` separa bloques, `line-medium` define una tarjeta, `line-strong` delimita una zona,
`line-control` es el **borde de un control** (WCAG 1.4.11 pide 3:1 y el panel lo cumple con 3.23:1 medido),
`line-focus` es el anillo de foco.

**Radios**: `rounded-card` (16) para tarjetas y `rounded-panel` (24) para paneles; `rounded-full` solo en
piezas circulares (sello, pulgar, punto de estado); para un paso intermedio, la escala de Tailwind
(`rounded-sm|md|lg|xl|2xl`). `rounded-stitch-*` es la **nomenclatura histórica** del mismo valor: se conserva
por compatibilidad y **no** es la recomendada para código nuevo. **Prohibido el radio arbitrario**
(`rounded-[7px]`).

**Elevación**: en el panel, `shadow-elevation-1..4` (cada sombra trae su anillo de 1 px, para no ensuciar el
borde a alto brillo); en el público, `shadow-card`/`raised`/`float`, teñidas con el color de marca. La
elevación **comunica interacción** (dropdown, hoja, modal), no decora.

### Cards

**Una Card es una agrupación semántica.** No es un wrapper universal y **no** se anidan:

```text
Card
 └ Card
    └ Card      ← prohibido como estructura habitual
```

Cuando una superficie extra no agrega significado, se usan **separadores, filas, grupos y secciones**
(que además son más densos y más baratos de escanear).

---

## 9. Botones

Jerarquía oficial (los nombres del `Button` real, `src/shared/ui/button.tsx`):

| Nivel | `variant` | Cuándo |
|---|---|---|
| **Primaria** | `primary` | la acción que cierra la tarea. **Una por contexto visual.** |
| **Secundaria** | `secondary` · `outline` | alternativa real, no destructiva |
| **Terciaria / fantasma** | `ghost` | acción de bajo peso (filtros, cancelar, navegación interna) |
| **Destructiva** | `danger` | borrar, anular, devolver plata |
| **Solo icono** | `size="icon"` | cuando el significado es inequívoco + `aria-label` + `Tooltip` si hace falta |

Tamaños: `sm`, `md`, `lg`, `icon`, `pill`. **Ojo con lo táctil**: `sm` (32 px) y `md` (40 px) quedan por
debajo del mínimo táctil de 44 px; en superficies que se usan con el dedo (POS, KDS, móvil) la acción
principal usa `lg`/`pill` o el contenedor garantiza 44 px. Es **deuda declarada** del primitivo, no una
invitación a bajar el mínimo.

Labels: **verbo + objeto** (*Crear usuario*, *Guardar cambios*, *Cerrar turno*, *Reembolsar pago*). Evitar
*Procesar*, *Ejecutar*, *Aceptar*, *Continuar* cuando el contexto no es inequívoco. **Jamás** una frase
debajo del botón explicando lo que el botón ya dice.

---

## 10. Estados de interacción

Todo control define, como mínimo: **default · hover · pressed · focus-visible · disabled · loading**.
Cuando corresponda: **selected · error · success · dragging**.

- **Focus**: visible siempre, por **anillo** (`focus-visible:ring-2 ring-brand ring-offset-2`), **nunca**
  solo por cambio de color.
- **Loading**: preserva las dimensiones del control (no salta el layout), impide el doble submit cuando la
  acción no es idempotente y comunica progreso. Un botón que carga sigue diciendo qué está haciendo.
- **Disabled**: `opacity-50` + `pointer-events-none`; si el usuario necesita saber *por qué*, se explica donde
  está el problema. **Selected**: no se marca solo con color; suma peso, borde o un indicador.

---

## 11. Iconografía

Los iconos **ayudan a reconocer, representan estado y acompañan acciones**. No son decoración obligatoria de
cada título o card.

- Un icono **solo** (sin label) exige significado reconocible, `aria-label` y, si el alcance no es obvio,
  tooltip; y **no** reemplaza el texto de una acción importante. Set único del repo (lucide): no se mezclan
  sets ni se dibujan iconos a mano.

---

## 12. Responsive

Breakpoints de revisión **obligatorios**: **375**, **768** y **1280**.

**Ley del primer viewport (375 px).** En el primer viewport, sin scrollear, tienen que estar visibles:

1. el **estado crítico** (qué está pasando: turno, pedido, alerta, filtro activo);
2. la **acción principal** de la tarea;
3. la **información mínima para iniciar** la tarea.

El contenido **secundario y de detalle puede requerir scroll vertical**: eso es esperable y no es un defecto.
Lo que **no** se admite es que el scroll haga falta para *entender dónde estoy* o para *empezar*.

- **Se preserva la jerarquía, no se comprime el desktop**: en móvil cambia el orden y la cantidad de
  información, no el tamaño de todo.
- **Sin scroll horizontal accidental** (una tabla ancha scrollea dentro de su contenedor, no empuja la página).
- Los controles táctiles respetan 44 px y los labels van asociados a su input.
- La cabecera y los filtros de una pantalla operativa no pasan el **20 %** del alto del viewport: son parte
  del primer viewport, no lo consumen entero.

---

## 13. Accesibilidad

Accesibilidad comprobada **gana** sobre estética. Se preserva y se refuerza:

- **Contraste**: texto/fondo **4.5:1** (AA) y borde de control **3:1** (WCAG 1.4.11). Los pares del panel
  están **medidos** (`dark-mode-contract.test.ts`): primario 17.71:1, secundario 7.23:1, muted 5.17:1, borde
  de control 3.23:1. **Deuda declarada del modo claro**: `--brand-primary` (2.14:1) y `--text-muted` (2.45:1)
  **no** sirven como texto sobre blanco, solo como relleno; si el modo claro se usa para algo crítico, se
  oscurecen.
- **Teclado**: todo se alcanza y se opera sin mouse; el foco no se pierde ni queda atrapado.
- **Nombres accesibles**: todo control y todo icono tienen el suyo; los errores están **asociados** al campo.
- **Nunca solo color**: un estado se comunica también por texto, icono o forma.
- **Motion**: `prefers-reduced-motion` se respeta (§ [`MOTION.md`](MOTION.md)).
- **Nada baja el piso WCAG** conseguido: los guardrails de contraste y de foco son contratos, no sugerencias.

---

## 14. Componentes

- **Componente que existe, componente que se usa.** Prohibido el HTML crudo equivalente donde hay primitivo
  (`Button`, `Input`, `Select`, `Textarea`, `Toggle`, `Modal`, `Tabs`, `Card`, `Badge`, …).
- **Componente nuevo = registro previo** en [`../../src/shared/ui/registry.json`](../../src/shared/ui/registry.json),
  en el mismo commit, con **cuándo SÍ** y **cuándo NO**: el registro es el catálogo ejecutable y este
  documento **no** copia componentes.
- Un componente declara **variantes**, **tamaños**, **estados** y **accesibilidad**; una variante que nadie
  usa se elimina o se justifica. **Ningún control ni copy decorativo**: cada control tiene estado, API y test,
  o se elimina con el motivo escrito.

---

## 15. Legacy: cómo convive la deuda

```text
pantalla legacy no revisada  → puede permanecer
deuda nueva                  → prohibida
pantalla rediseñada          → sale bajo DS v4, completa
pantalla nueva               → DS v4 obligatorio
```

- La deuda existente está **congelada por archivo** (techos que solo bajan) y **no se refactoriza por
  deporte**: se resuelve cuando esa sección se revisa. Lo que **no** se permite es ampliarla, y los techos se
  actualizan **en el mismo commit** en que bajan (subirlos para pasar el CI está prohibido).

---

## 16. Qué NO decide este documento

- **Arquitectura de producto** (módulos, secciones, ownership, navegación) →
  [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md).
- **Contenido de una pantalla** (qué muestra, qué jerarquiza, qué KPI lleva) → su spec, con aprobación del
  owner; y **qué métrica existe** → [`DATA_VISUALIZATION.md`](DATA_VISUALIZATION.md).
- **El código**: este documento dice cómo se diseña; la implementación la guían
  [`ui-change`](../../.agents/skills/ui-change/SKILL.md) y
  [`screen-design`](../../.agents/skills/screen-design/SKILL.md).

---

## 17. Enforcement

Se automatiza **solo lo objetivo** (contratos en `src/shared/contracts/`): que este documento exista y sea la
**única** fuente que se proclama ley visual · que el registro y las skills apunten acá · que `AGENTS.md` lo
cite dentro de su techo de líneas · que el material archivado no sea exigido por ninguna instrucción activa ·
que los tokens existan en los dos modos y tengan utilidad · que los **techos de deuda visual** —incluidos los
de color crudo— y los pares de **contraste** sigan vigentes · y que `prefers-reduced-motion` esté contemplado.

**No se automatiza** —y no se va a inventar un regex para eso—: decidir si una pantalla "se ve premium",
si un texto "explica demasiado" o si una Card "estaba de más". Eso lo resuelve el criterio, con estas leyes
delante y la revisión del owner.
