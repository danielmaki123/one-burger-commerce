# DESIGN_REFERENCES.md

> **Este archivo es la fuente de verdad visual del proyecto.**
> El agente lo lee ANTES de escribir cualquier UI.
> Si hay conflicto con cualquier otro doc, este gana.
> Se actualiza solo cuando el ADN visual cambia.

---

## 1. Para qué existe este archivo

El agente genera UI genérica porque:

- No tiene las referencias visuales en el repo
- No puede leer imágenes
- No sabe traducir "se ve premium" a hex/padding/tamaños

**Este archivo resuelve los 3 problemas:** traduce el ADN visual a reglas concretas que el agente
puede seguir sin ver imágenes.

---

## 2. Las referencias (solo para humanos)

Ubicación: `ops/references/`

| # | Archivo | Qué muestra |
|---|---|---|
| 1 | `reference-1.png` | Dashboard financiero. Números enormes, sparkline, cards con color |
| 2 | `reference-2.png` | Dashboard de seguros. Cards coloridas (amarillo, púrpura, verde) |
| 3 | `reference-3.png` | Dashboard fitness. Charts, calendario, cards con íconos |

**El agente NO lee estas imágenes.** Todo el ADN visual está traducido a reglas en §3.

---

## 3. ADN visual — Los 10 patrones

Todo UI nuevo debe respetar estos 10 patrones. Sin excepciones.

### Patrón 1 — Números enormes como protagonistas

- El dato principal de una pantalla: **56px, weight 700, fuente Fraunces**
- El dato secundario: **32px, weight 700, fuente Fraunces**
- Nunca texto más grande que el dato principal

**Ejemplo correcto:** `C$ 12.480` en 56px domina la pantalla.
**Ejemplo incorrecto:** dato en 32px con título de 24px arriba.

### Patrón 2 — Cards con personalidad, no todas iguales

- Máximo **2 tipos de card por pantalla**
- Una card puede tener fondo de color suave (success, warning, danger, info)
- Nunca todas las cards del mismo color

**Ejemplo correcto:** card de alerta con fondo `--danger-soft`, cards informativas en blanco.
**Ejemplo incorrecto:** todas las cards blancas con borde gris.

### Patrón 3 — Íconos con fondo de color

- Todo ícono tiene fondo circular o cuadrado con color soft
- Tamaño: **48x48px**, radio 12px
- Nunca íconos sueltos sin fondo

**Ejemplo correcto:** 🍳 dentro de un cuadrado `--warning-soft`.
**Ejemplo incorrecto:** 🍳 solo, sin fondo.

### Patrón 4 — Color con significado

- Verde (`--success-soft` / `--success-strong`): métricas positivas, éxito
- Amarillo (`--warning-soft` / `--warning-strong`): alertas, atención moderada
- Rojo (`--danger-soft` / `--danger-strong`): urgencia, problemas
- Azul (`--info-soft` / `--info-strong`): información neutral
- Nunca color decorativo. Cada color comunica algo.

### Patrón 5 — Jerarquía fuerte (5 niveles por pantalla)

| Nivel | Tamaño | Fuente | Weight | Uso |
|---|---|---|---|---|
| Hero | 56px | Fraunces | 700 | Dato principal |
| KPI | 32px | Fraunces | 700 | Datos secundarios |
| Título | 20px | Inter | 600 | Títulos de sección |
| Body | 14px | Inter | 400 | Texto normal |
| Label | 11px | Inter | 600 | Etiquetas (uppercase, letter-spacing 0.08em) |

**Regla:** una pantalla usa los 5 niveles. Nunca 2-3.
**Nunca:** más de 5 niveles, ni tamaños intermedios.

### Patrón 6 — Badges de tendencia y estado

- Todo dato principal tiene un badge de comparación o estado
- Fondo soft del estado, texto strong del estado
- Incluye ícono (↑ o ↓) si es tendencia

**Ejemplo correcto:** `↑ 18% vs. ayer` en badge `--success-soft` con texto `--success-strong`.
**Ejemplo incorrecto:** `18%` sin badge, o badge con fondo crudo.

### Patrón 7 — Visualización donde hay datos

- Serie temporal → sparkline o línea
- Proporción → donut
- Comparación → barras
- Nunca solo números sin visual

**Excepción:** si no hay datos, no inventar gráfico. Mostrar estado vacío.

### Patrón 8 — Spacing generoso

- **32px** entre secciones
- **24px** padding dentro de cards
- **12-16px** entre items
- **Nunca** 8px entre secciones

### Patrón 9 — Radius consistente

- Cards: **16-20px**
- Íconos: **12px**
- Badges: **999px** (pill)
- Inputs: **12px**
- Nunca radius arbitrario (nada de `rounded-[28px]`)

### Patrón 10 — Dark mode siempre

- Todo componente se ve en light Y dark
- Todo token tiene versión light y dark
- Probar con `<html class="dark">`
- **Regla:** si un componente nuevo no se ve bien en dark, no está terminado

---

## 4. Tokens

### Base (mantener los actuales)

| Token | Light | Dark |
|---|---|---|
| `--background` | `#FBF9F5` | `#0F161C` |
| `--foreground` | `#23303A` | `#E8EBEF` |
| `--card` | `#FFFFFF` | `#16212A` |
| `--card-foreground` | `#23303A` | `#E8EBEF` |
| `--border` | `#E4E2DC` | `#263239` |
| `--muted` | `#EEF0F2` | `#1C262E` |
| `--muted-foreground` | `#5B6670` | `#8A97A3` |
| `--brand` | `#2B6C96` | `#2B6C96` |
| `--brand-foreground` | `#F7FAFC` | `#F7FAFC` |
| `--brand-strong` | `color-mix(in srgb, #2B6C96 84%, black)` | `#4A8BB5` |

### Nuevos — agregar a `src/app/globals.css`

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--success-soft` | `#E8F3EA` | `#12351F` | Fondo de éxito |
| `--success-strong` | `#1F5C3F` | `#6FD89C` | Texto/dato de éxito |
| `--warning-soft` | `#F7ECD6` | `#2A1F0E` | Fondo de alerta |
| `--warning-strong` | `#7A5518` | `#F0C56A` | Texto/dato de alerta |
| `--danger-soft` | `#F7E4DC` | `#2A1612` | Fondo de peligro |
| `--danger-strong` | `#8A3220` | `#F58B7A` | Texto/dato de peligro |
| `--info-soft` | `#EAF1F6` | `#15232E` | Fondo de info |
| `--info-strong` | `#2B6C96` | `#6FAFD5` | Texto/dato de info |

**Regla:** el agente usa estos tokens, nunca valores hardcodeados.

### Fuentes (mantener)

| Uso | Fuente |
|---|---|
| Números grandes (hero, KPI) | Fraunces |
| Todo lo demás | Inter |
| Alternativa | Plus Jakarta Sans |

---

## 5. Reglas que el agente sigue SIEMPRE

### Antes de escribir UI

1. Leer este archivo completo
2. Identificar qué patrones aplican (§3)
3. Verificar que los tokens existen (§4)
4. Si falta un token o un patrón, PARAR y consultar

### Al escribir UI

- Dato principal en Fraunces 56px
- Dato secundario en Fraunces 32px
- Etiquetas en Inter 11px uppercase
- Íconos con fondo de color (48x48)
- Máximo 2 tipos de card por pantalla
- Máximo 5 tamaños de texto por pantalla
- Badges con estado (success/warning/danger/info)
- Spacing 32px entre secciones, 24px en cards
- Radius 16-20px en cards, 12px en íconos
- Probar en light Y dark

### Al terminar UI

- [ ] ¿El dato principal domina (56px)?
- [ ] ¿Los íconos tienen fondo de color?
- [ ] ¿Los colores significan algo?
- [ ] ¿Hay máximo 2 tipos de card?
- [ ] ¿El spacing es 32px entre secciones?
- [ ] ¿Funciona en light?
- [ ] ¿Funciona en dark?
- [ ] ¿Se parece al ADN de §3?

### Si dudás

**PARAR y consultar.** No inventar. No promediar. No copiar de otros lugares.

---

## 6. Lo que el agente NO hace

### UI

- ❌ Todas las cards blancas
- ❌ Íconos sueltos sin fondo
- ❌ Números de 32px cuando deberían ser 56px
- ❌ Texto decorativo ("Armá la venta del mostrador...")
- ❌ Colores decorativos (colores que no significan nada)
- ❌ Más de 2 tipos de card por pantalla
- ❌ Spacing de 8px entre secciones
- ❌ Radius arbitrario (`rounded-[28px]`)
- ❌ Olvidar dark mode
- ❌ Inventar tokens nuevos sin consultar
- ❌ HTML crudo si existe componente

### Código

- ❌ `text-[Npx]` (usar la escala de §3 Patrón 5)
- ❌ Paleta cruda (`bg-white`, `text-red-700`)
- ❌ `window.confirm` (usar Modal)
- ❌ `role="dialog"` / `role="switch"` manual
- ❌ Componente sin registrar en `registry.json`

---

## 7. Qué debe actualizar el agente

Al arrancar, el agente debe:

| # | Archivo | Qué hacer |
|---|---|---|
| 1 | `src/app/globals.css` | Agregar los 8 tokens nuevos (§4) |
| 2 | `src/app/globals.css` | Activar dark mode (ya está definido, se usa con `class="dark"`) |
| 3 | `DESIGN_SYSTEM.md` | Reescribir con ADN visual (§3) + tokens (§4) |
| 4 | `AGENTS.md` | Agregar sección "UI" que apunte a este archivo |
| 5 | `src/shared/ui/registry.json` | Registrar componentes nuevos si aplica |
| 6 | `ops/tasks/audit-ui/mockup-admin-inicio.html` | Recrear el mockup con este ADN |

**Nada más.** No refactorizar el resto todavía.

---

## 8. Cómo se valida

**Paso 1 — El agente recrea el mockup**

Con este ADN aplicado a `/admin`. HTML estático. Sin backend.

**Paso 2 — Vos validás**

Abrís el HTML en el navegador. Cambiás entre light/dark. Comparás con las 3 referencias en
`ops/references/`.

**Paso 3 — Si aprobás**

El agente implementa el mockup en código real.

**Paso 4 — Si no aprobás**

Decís qué cambiar específicamente. El agente ajusta. Máximo 3 iteraciones.

**Paso 5 — Una vez aprobado**

Este ADN se aplica a TODA la UI nueva. Sin excepciones. Sin repetir.

---

## 9. Enforcement

Para que no se degrade:

| Herramienta | Qué hace |
|---|---|
| **Test de contrato** | Falla si aparece `text-[Npx]` o paleta cruda |
| **Test de tokens** | Falla si se usa un token que no existe |
| **Test de cards** | Falla si hay 3+ tipos de card por archivo |
| **Test de dark mode** | Falla si un componente nuevo no se ve en dark |
| **CI job** | Bloquea merge si algún test falla |

Sin esto, el ADN se degrada en 3 semanas.

---

## 10. Cómo se actualiza este archivo

**Solo cuando:**

- Cambian las referencias visuales
- Se agrega un patrón nuevo
- Se descubre un caso que no estaba cubierto

**Nunca:**

- Por preferencia personal
- Por moda
- Porque un skill dice algo distinto

**Regla:** este archivo gana sobre cualquier otro doc, skill o preferencia.

---

## 11. Ejemplos concretos

### Ejemplo: card de KPI

```html
<div class="kpi-card">
  <div class="kpi-icon cooking">🍳</div>  <!-- Patrón 3: ícono con fondo 48x48 -->
  <div>
    <div class="kpi-label">En cocina</div> <!-- Patrón 5: label 11px uppercase -->
    <div class="kpi-value">4</div>         <!-- Patrón 1: número 32px Fraunces -->
  </div>
</div>
```

### Ejemplo: card de alerta

```html
<div class="alert-card">                    <!-- Patrón 2: card con fondo danger-soft -->
  <div class="alert-title">⚠️ Necesita atención</div>
  <span class="badge danger">Tarde</span>   <!-- Patrón 6: badge con estado -->
</div>
```

### Ejemplo: hero de ventas

```html
<div class="hero-card">
  <div>
    <div class="hero-label">Ventas de hoy</div>
    <div class="hero-value">C$ 12.480</div>  <!-- Patrón 1: 56px Fraunces -->
    <span class="badge-up">↑ 18% vs. ayer</span> <!-- Patrón 6: badge tendencia -->
  </div>
  <svg class="sparkline">...</svg>           <!-- Patrón 7: visualización -->
</div>
```

---

## 12. La regla de oro

Si el agente duda entre 2 opciones, elige la que respeta los 10 patrones.

No la más fácil. No la más rápida. La que respeta el ADN.

Fin del documento. El agente lo lee siempre. Vos lo actualizás solo cuando cambia el ADN visual.
