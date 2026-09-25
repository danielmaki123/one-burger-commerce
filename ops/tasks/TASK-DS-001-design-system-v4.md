# TASK-DS-001 — One Burger Design System v4

## TASK ID

`TASK-DS-001` (fase 2 del [roadmap de producto](../roadmap/PRODUCT-UX-ROADMAP.md)).

## Título

Crear la única ley visual vigente y retirar a Stitch de la cadena normativa.

## Prioridad

`P2` — no rompe nada hoy, pero sin esto el rediseño sección por sección (fase 3) vuelve a improvisar y a
rediseñar dos veces.

## Clase de riesgo

`docs/CI` + `UI` **no funcional**: se tocan tokens (aditivo), documentos, skills y contratos. **Cero
rediseño de pantallas, cero cambios de lógica, cero migraciones, cero deploy.**

---

## PROBLEMA

El repo tiene **tres cosas que se declaran fuente de verdad visual y no coinciden** —`design-system.md`
(v3.0.0 de Stitch, citada por AGENTS/skills/contratos), `ops/references/stitch/README.md` ("esta carpeta es
la fuente de verdad", sin citas) y `registry.json:5-6` (`source_of_truth`)— y la doctrina aprobada por el
owner (`D-003`) ya dice que Stitch **no manda**, pero la regla activa lo sigue exigiendo: hasta `DS-001`, la
skill `ui-change` obliga a leer Stitch y a traducir su HTML. Sin una ley propia, cada sección nueva decide
otra vez.

Además, hay reglas visuales que **solo existen como prosa** (tipografía numérica, `animate-pulse`,
reduced motion, touch targets) y tokens que faltan (`chart-primary`, motion), mientras que otros conceptos
están duplicados con cuatro nombres equivalentes.

## EVIDENCIA (radiografía del sistema real, 2026-09-25)

### Clasificación

| Clase | Qué entró |
|---|---|
| **REAL** | `globals.css` (597 líneas: capa de estructura del panel, capa del público, alias, `.dark`); `BusinessSettings` → `businessSettingsStyleVariables()` → `--brand`/`--accent`/`--background`/`--foreground`/`--card` + tipografías en `<html>`; 4 familias reales (Fraunces, Inter, Plus Jakarta, JetBrains Mono); `registry.json` (42 componentes, 36 archivos, 10 campos); 21 primitivos de `src/shared/ui/`; 17 componentes de `_components/` del admin y 4 del público; `--status-*` (4 estados + inactivo); `--chart-1..5`; `--radius-stitch-*`; `--shadow-elevation-1..4`; `text-st-*` (8 niveles) y la escala del público (display/kpi/title/headline/body/label/caption); `.dark` **solo** en el shell del panel |
| **OBSOLETO** | `ops/references/stitch/README.md` como autoridad ("SIEMPRE GANA"); `one_burger_directivas_y_tokens_de_dise_o_design.md` (**v2.0.0** del mismo sistema, sin citas); el mensaje de `registry-contract.test.ts:282` que manda a un `DESIGN_SYSTEM.md §3` que ya no existe; `TASK-201-ui-inventory.md` desactualizado (afirma que no hay `select`/`textarea`; lista `AdminStatusDonut`, borrado) |
| **DUPLICADO** | `DESIGN.md` y `kitchen_dispatch_operational_hub/DESIGN.md` (**byte-idénticos**, SHA256 `AAD9F723…F344`); dos escalas tipográficas en paralelo (`--text-*` del público y `--text-st-*` del panel) con alias (`title-sm`, `headline-md`, `label-xs`); cuatro vocabularios de estado (`--status-*`, `--status-nueva/…`, `--success|warning|danger|info`, `--pickup-*`); 16 alias de compatibilidad (`--background`, `--card`, `--muted`, `--accent`, `--border`, `--input`, `--foreground`, `--muted-foreground`, …) |
| **CONTRADICTORIO** | `--brand` (configurable por el negocio) vs `--brand-primary` (constante del panel): en `.dark` el panel reescribe `--brand`, así que la marca configurada **no llega** al admin/POS/KDS; el techo declarado por `AGENTS.md` de controles ≥44 px contra el primitivo real (`Button` `md` = 40 px, `sm` = 32 px); `animate-pulse` documentado como "solo SLA" con 20 usos de `animate-*` en 15 archivos y sin guardrail |
| **HISTÓRICO** | `ops/references/stitch/**` completo (7 pantallas con `code.html` + `screen.png`), `ops/DESIGN_LOG.md`, `ops/tasks/audit-ui/**` (285 archivos, 275 PNG), los briefs de UI cerrados, los comentarios de código que citan `design-system.md §N` |
| **FALTANTE** | Ley de content design, arquetipos de pantalla, ley de motion (sin tokens ni escala), ley de data visualization (los charts eligen colores de `--chart-N` sin vocabulario semántico), tokens `chart-*` semánticos, tokens de motion, `prefers-reduced-motion` en `globals.css`, `z-index` con nombre, plantilla de spec de pantalla, skill `screen-design`, contrato de reduced motion, contrato de tipografía numérica, contrato de touch targets |

### Guardrails que ya existen (y **sobreviven**: su autoridad es el código, no Stitch)

Contraste medido y borde de control 3:1 (`dark-mode-contract`) · techos de deuda visual por archivo
(`design-guardrails` + `design-tokens.allow.json`: 8 reglas, 109 filas) · `#hex` y controles HTML crudos con
techo (`ui-contract`) · registro de componentes (`registry-contract`) · dark mode solo en el panel · techos de
líneas de documentos (`agent-system-contract`) · links internos (`docs-sync-contract`) · aserciones de
accesibilidad del panel (`admin-ui-contract`: `inert`, focus trap, `aria-*`, `min-h-11` en 7 puntos).

### Guardrails que **no** existían y ahora sí

Reduced motion (0 contratos; `globals.css` sin la media query, aunque `landing.css:232` ya la tiene) ·
tipografía numérica (174 usos de `tabular-nums`, **0 aserciones**) · escala de motion (faltante) · tokens
semánticos de chart (faltantes) · autoridad visual única (3 declaraciones en conflicto).

## CAUSA RAÍZ

El sistema visual se construyó **por pantalla** y su ley vivía en un documento **de terceros** (Stitch)
adoptado como autoridad. Cuando el sistema dejó de ser Stitch, no se escribió la ley propia: quedó un
documento histórico citado como norma, tres cabeceras que se proclaman fuente de verdad, reglas universales
sin token ni contrato, y una skill que manda leer material que ya no decide.

## INVARIANTE

1. **Una sola** ley visual: `ops/design/DESIGN_SYSTEM.md`. Ningún otro documento se proclama autoridad visual.
2. Stitch **no es lectura obligatoria** ni decide diseños nuevos.
3. Los componentes consumen **intención** (token/utilidad), nunca un valor concreto.
4. **BRAND** configurable ≠ **STRUCTURE** del sistema ≠ **SEMANTIC** protegido: la marca no puede reescribir un
   estado.
5. **Ninguna pantalla cambia de aspecto** como consecuencia de esta TASK.

## BOUNDED CONTEXT

N/A — documentación, skills, contratos y tokens (aditivos). No cambia ninguna capa de `src/modules/`.

---

## SCOPE IN

- **Nuevo**: `ops/design/{README,DESIGN_SYSTEM,CONTENT,PATTERNS,MOTION,DATA_VISUALIZATION}.md` y
  `ops/design/screens/TEMPLATE.md`.
- **Nuevo**: `.agents/skills/screen-design/SKILL.md` y este brief.
- **Tokens aditivos** en `src/app/globals.css`: `chart-{primary,secondary,tertiary,muted,positive,negative}`
  (alias de los `--chart-N` actuales), `--motion-{fast,standard,emphasized}` y sus curvas, y la media query
  global de `prefers-reduced-motion`. **Nada de lo existente cambia de valor.**
- **Contratos**: `stitch-system-contract.test.ts` → **`design-system-contract.test.ts`** (reescrito: la ley
  existe y es única, las skills y el registro apuntan a ella, el archivo archivado está marcado, tokens y
  escala tipográfica en los dos modos, dark solo en el panel, mono de números, reduced motion, piso de
  tipografía numérica); ajustes en `docs-sync`, `agent-system`, `registry-contract` y `dark-mode-contract`
  (solo la referencia al documento).
- **Instrucciones activas**: `AGENTS.md` (misma cantidad de líneas), `.agents/CONTEXT.md`, `.agents/MEMORY.md`,
  `.agents/skills/ui-change/SKILL.md`, `ops/CURRENT.md` (≤250 líneas), `ops/tasks/START-HERE.md`,
  `ops/roadmap/README.md`, `ops/product/MODULE_ARCHITECTURE.md` §14, `src/shared/ui/registry.json` (cabecera).
- **Archivo de Stitch**: banner `ARCHIVED / NON-NORMATIVE` en los 5 documentos rastreados de
  `ops/references/stitch/` (incluido el `README.md`, que se reescribe como índice del archivo).

## SCOPE OUT

Ninguna pantalla, componente, primitivo, route handler, caso de uso, consulta, API ni migración. **No** se
tocan: el sidebar, Resumen, Usuarios, Alertas, Menú, Caja, POS ni su navegación (los hallazgos de `ARCH-001`
siguen documentados); **no** se recolorea nada; **no** se migra ningún componente a los tokens nuevos; **no**
se mueve ni se borra ningún asset de Stitch (se marca); **no** se crean specs de pantalla reales.

## DEPENDENCIAS

`ROADMAP-001` y `ARCH-001` mergeados. Ninguna credencial. Ninguna migración.

## ARCHIVOS PROBABLES

Ver *SCOPE IN*. Radio de impacto: `AGENTS.md` y `ops/CURRENT.md` los lee toda sesión nueva; los contratos
corren en el CI (`contracts`, `verify`); `globals.css` lo consumen **todas** las pantallas (por eso los
tokens nuevos son aditivos y los valores actuales no se tocan).

---

## TEST ROJO

Primero los contratos, después los documentos:

- `src/shared/contracts/design-system-contract.test.ts` (nuevo, reemplaza al de Stitch): falla mientras
  `ops/design/DESIGN_SYSTEM.md` y sus auxiliares no existan y mientras `AGENTS.md`/el registro/las skills
  sigan apuntando a Stitch.
- Extensión en `agent-system-contract.test.ts`: una sola declaración de autoridad visual.

**Rojo esperado y observado**: `falta ops/design/DESIGN_SYSTEM.md` y `AGENTS.md todavía cita Stitch como
sistema oficial: no puede haber dos autoridades visuales` (se observa antes de escribir los documentos).

## ESTRATEGIA

Escribir la ley **desde el código real** (los tokens que existen son los canónicos; lo que falta se declara
faltante), automatizar solo propiedades objetivas, y **retirar** Stitch de la cadena de autoridad sin borrar
su historia: se marca como archivado, se deja de exigir y se explican los guardrails que **sí** se conservan.

## DDD

N/A — no cambia ninguna capa. Los tokens viven en `src/app/globals.css` (capa de estilos) y el catálogo en
`src/shared/ui/registry.json` (compartido).

## TRANSACCIÓN / CONCURRENCIA / IDEMPOTENCIA

`N/A — no hay operaciones de escritura de producto.`

## AUTORIZACIÓN

`N/A — la TASK no toca autorización.` El Design System **no** define permisos: qué ve cada rol lo deciden la
arquitectura de producto y las puertas server-side.

## MIGRACIÓN

`N/A — sin cambios de esquema.`

## OBSERVABILIDAD

`N/A — sin operaciones nuevas.`

---

## TESTS UNITARIOS

Los contratos del § *TEST ROJO* (16 tests en `design-system-contract` + 4 de enforcement retocados), verdes
al cerrar.

## TESTS DE INTEGRACIÓN / E2E

`N/A — no toca PostgreSQL ni flujos`. Los E2E existentes de tokens (`tests/e2e/design-tokens.spec.ts`) siguen
midiendo la escala del público y **no se tocan**.

## MUTATION CHECK

1. Quitar la cita de `AGENTS.md` → falla el contrato de la ley visual.
2. Reapuntar `registry.json:source_of_truth` a Stitch → falla el contrato del registro.
3. Devolver el mandato de Stitch a `ui-change` (`code.html`) → falla el contrato del sistema.
4. Declarar la autoridad visual en otro documento → falla el contrato de autoridad única.
5. Borrar la media query de reduced motion → falla el contrato de motion.

Las cinco se restauran y **no** se commitean.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
```

Sin `build:webpack` (no se toca ninguna página) y sin E2E (no se toca ningún flujo). **Sin deploy.**

## CRITERIOS DE ACEPTACIÓN

Los 26 puntos del pedido del owner (§40), verificados uno por uno: fuente visual única · Stitch no normativo ·
docs legacy sin competir · theme architecture definida · brand/structure/semantic separados · ownership de
tokens · color raw ratcheted · tipografía · spacing/densidad · botones y estados · motion · reduced motion ·
content design · progressive disclosure · arquetipos · data visualization · accesibilidad protegida ·
responsive · `screen-design` · `ui-change` actualizada · plantilla de pantalla · registry apuntando al sistema
nuevo · contratos útiles conservados · **cero rediseños** · CI verde.

## REGRESIÓN

Si alguien reapunta el registro a Stitch, vuelve a exigir Stitch en una skill, borra la media query de
reduced motion, deja de citar la ley desde `AGENTS.md` o proclama la autoridad visual en un segundo
documento, el CI falla.

## ROLLBACK

Revert del commit. Nada que deshacer en la base. Los tokens nuevos son aditivos: si se revierten, ninguna
pantalla cambia.

## DOCUMENTACIÓN

Este brief (la radiografía), `ops/design/**`, `AGENTS.md`, `.agents/{CONTEXT,MEMORY}.md`, la skill
`ui-change` y la nueva `screen-design`, `ops/CURRENT.md`, `ops/roadmap/README.md`,
`ops/product/MODULE_ARCHITECTURE.md` §14, `registry.json` y los contratos.

## MEMORY

Una lección reutilizable para `.agents/MEMORY.md`: *adoptar como ley un documento de terceros deja la ley
fuera del repo; cuando el sistema cambia, la ley se escribe propia, se marca la historia como archivada y se
conservan los guardrails que no dependían del documento.*

## REVISIÓN DEL OWNER (2026-09-25) — cuatro correcciones aplicadas

Antes del merge, el owner pidió cerrar cuatro puntos. **No se amplió el scope y no se tocó ninguna pantalla.**

1. **Color configurable vs defaults**: se eliminó del carácter normativo toda regla que fijara ámbar/azul como
   asignación permanente por superficie. La ley pide **intención** (`brand-primary`, `brand-accent`); el tema
   vigente (acento = ámbar, primario = azul) queda **documentado como tema, no como ley**. Se agregó
   `--brand-accent{,-hover,-soft}` como alias aditivo de los `--brand-amber*` (mismo valor: cero cambios
   visuales).
2. **Stitch fuera del vocabulario canónico**: se definió vocabulario **neutral** para el panel
   (`--text-panel-*`, alias del mismo valor que `--text-st-*`) y se declaró `text-st-*` / `rounded-stitch-*`
   como **nomenclatura histórica de compatibilidad** (no recomendada para código nuevo). Sin migración masiva
   y sin cambios de valor.
3. **Regla mobile corregida**: se reemplazó "sin scroll" por la **ley del primer viewport** —estado crítico,
   acción principal y lo mínimo para iniciar la tarea visibles a 375 px—; el contenido secundario **puede**
   requerir scroll vertical. Se mantiene la prohibición de scroll **horizontal**.
4. **Enforcement de color crudo**: la ley prohíbe `#hex`, `rgb()`, `rgba()`, `hsl()` y `hsla()`, y el ratchet
   ganó la regla `raw-color-function` con la línea base medida (10 en `landing.css`, 3 en el público) y
   **exclusiones explícitas** donde el color es dato (fuente de tokens, presets/defaults del negocio,
   herramientas de contraste y color de categoría, tests). No se subió ningún techo y no se obliga a limpiar
   la deuda existente.

## DEFINITION OF DONE

Ver [`../../AGENTS.md`](../../AGENTS.md) § *Definition of Done*. Excepciones documentadas: no hay capturas
antes/después porque **ninguna pantalla se rediseña** (la verificación es que el CSS actual no cambia de
valor); y **este PR no se mergea**: queda abierto, con CI verde, para revisión del owner.
