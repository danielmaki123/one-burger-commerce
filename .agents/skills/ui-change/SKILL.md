# SKILL: ui-change — tocar la interfaz

**Se activa** cuando una TASK toca una pantalla, un componente, un token, un estilo o un flujo
visible. **No** se reescribe el design system: se **usa**.

---

## 1. Antes de escribir UI

0. **Identificar el módulo y la sección de la pantalla**:
   [`../../../ops/product/MODULE_ARCHITECTURE.md`](../../../ops/product/MODULE_ARCHITECTURE.md). Una pantalla
   nueva **no** estrena módulo ni sección: pertenece a uno existente (Menú, Órdenes, Caja, Locales…). Si de
   verdad hace falta algo nuevo, primero pasa el gate de esa TASK y lo aprueba el owner — no se decide
   escribiendo la pantalla.
1. **Leer el sistema de diseño oficial**: [`../../../ops/references/stitch/design-system.md`](../../../ops/references/stitch/design-system.md).
   Gana **siempre** en lo visual. Sus reglas vinculantes son §2, §6, §7 y §8.
2. **Leer el registro de componentes**: `src/shared/ui/registry.json` (campos `file`, `variants`,
   `sizes`, `use_when`, `dont_use_when`).
3. **Buscar antes de crear**: primero `src/shared/ui/`, después `(admin)/admin/_components/` y
   `(public)/_components/`. Si el primitivo existe, se usa.
4. **La referencia visual de Stitch** (`ops/references/stitch/stitch_redise_o_de_secci_n_existente/<pantalla>/code.html`
   y `screen.png`) es **referencia**: se **traduce** a componentes del repo. **Prohibido copiar su
   HTML.**

## 2. Reglas vinculantes

- **Dos modos a propósito**: el **panel** (KDS/POS/Admin) es **oscuro** —su shell lleva
  `class="dark"`— y el **público** es **claro** con la paleta del negocio. Un overlay montado en un
  **portal** tiene que llevar el alcance `dark` o sale en modo claro (hay un contrato que lo verifica).
- **Los números van en `font-mono` con `tabular-nums`**: precios (`C$ 305.00`), cronómetros, IDs de
  ticket, PIN y contadores. Evita que la interfaz «tiemble» cuando cambian solos.
- **Ámbar (`--brand-amber`) vs azul cielo (`--brand-primary`)**: ámbar para identidad, cocina y acción
  de comanda; cielo para administración, navegación y confirmación del POS.
- **`animate-pulse` solo en SLA vencido o pérdida de sincronización.** Prohibido animar tickets
  normales.
- **La cabecera y los filtros no pasan el 20% del alto**: el 80% es operación.
- **Controles de 44 px mínimo** (`h-11`, `min-h-11`): es una interfaz táctil de cocina y mostrador.
- **Los estados operativos son los del sistema** (`--status-pending|prep|ready|sla`), cada uno con
  fondo, borde, texto y punto.
- **Nada de contenedores blancos planos** en el panel: el lienzo es `--bg-canvas` con superficies por
  capas.
- **Los datos del negocio son los reales**: `C$`/`NIO`, `+505` y las sucursales **Camino de Oriente**,
  **Carretera Masaya** y **Casa Antigua**. Prohibido inventar nombres, ciudades o monedas.
- **Prohibido el color fuera de token**: nada de `#hex`, `rgba()`, paleta cruda de Tailwind
  (`slate-*`, `sky-*`, `amber-*`…) donde hay token, ni `fontFamily` inline. Se usan los tokens
  semánticos de `src/app/globals.css`.
- **Componente que existe, componente que se usa**, y **prohibido el HTML crudo equivalente**
  (`<button>`, `<input>`, `<select>`, `<textarea>`) donde el primitivo existe.
- **Componente nuevo = registro previo**: un archivo nuevo en `_components/` se registra en
  `src/shared/ui/registry.json` **en el mismo commit**, con su «cuándo SÍ» y su «cuándo NO».
- **Ningún control decorativo**: cada control se implementa con su estado/API **y su test**, o se
  elimina con el motivo escrito. **Nada de copy decorativo**: lo que no cambia una decisión no va.

## 3. Mobile first y accesibilidad

- **Mobile first real**: se verifica en **navegador real (Playwright) a 375 px y 1280 px**, no en HTML
  estático. Sin scroll horizontal entre 320 y 1280 px.
- **Contraste**: texto/fondo **4.5:1** y borde de control **3:1** (WCAG 1.4.11). Lo mide
  `dark-mode-contract.test.ts` y la deuda del modo claro está declarada en `globals.css`.
- **Foco visible propio** (≥3:1) en todo control. Un `outline` roto no falla el build: revisarlo a
  mano.
- **Labels asociados a sus inputs**, textos de error claros **en español**.
- Un radio nativo testeable se implementa con un overlay `opacity-0`, no con `sr-only` (que no es
  automatizable).

## 4. Los cinco estados

Toda pantalla con datos tiene que dibujar, y cada uno tiene su test:

1. **cargando** (loading),
2. **con datos** (data),
3. **vacío** (empty),
4. **error** (con mensaje del servidor, no un error genérico),
5. **«nada pendiente»** cuando aplica.

## 5. Procedimiento

1. **Test primero**: el componente o el caso de uso, con su rojo observado.
2. Implementar reutilizando primitivos.
3. **Screenshots antes/después** a 375 px y 1280 px (es la evidencia de la TASK).
4. Verificar que los **techos de UI no suban**: `src/shared/config/design-tokens.allow.json` congela
   por archivo las violaciones que quedan. Si bajan, se baja el número **en el mismo commit**; si
   aparece un archivo nuevo con violaciones, el contrato falla.
5. Validación.

```bash
npm run test && npm run lint && npm run typecheck && npm run build && npm run security:secrets
npm run build:webpack        # OBLIGATORIO si tocaste src/app/**/page.tsx
```

**Por qué `build:webpack`**: el build de Turbopack **no valida los exports de una página** y el
problema queda escondido hasta producción. Es una lección pagada (ver
[`../../MEMORY.md`](../../MEMORY.md) § *Lecciones de CI/build*).

## 6. Checklist antes de cerrar

- [ ] ¿Leí el design system y usé los primitivos del registro?
- [ ] ¿**Traduje** el HTML de Stitch en vez de copiarlo?
- [ ] ¿Los **números** van en `font-mono` con `tabular-nums` y los **estados** en
      `--status-pending|prep|ready|sla`?
- [ ] ¿Ámbar solo identidad/cocina/acción y cielo para administración y POS?
- [ ] ¿Cabecera y filtros entran en el **20%** del alto?
- [ ] ¿Controles táctiles **≥44 px** con foco visible propio (≥3:1)?
- [ ] ¿`animate-pulse` aparece **solo** en SLA vencido o desincronización?
- [ ] ¿La pantalla es **oscura** (panel) y los datos son los reales (`C$` / `+505` / las tres
      sucursales)?
- [ ] ¿Hay **una sola** acción primaria y ningún texto decorativo?
- [ ] ¿Están los **cinco estados**?
- [ ] ¿Contraste ≥4.5:1 texto y ≥3:1 borde, sin scroll horizontal entre 320 y 1280 px?
- [ ] ¿Verifiqué en navegador real a 375 px y 1280 px, con captura antes/después?
- [ ] ¿El registro de componentes quedó actualizado (si creé uno)?
- [ ] ¿Los techos de tokens/UI **no** subieron?
- [ ] ¿Corrí `build:webpack` si toqué una página?

## 7. Prohibiciones

- Reescribir el design system o introducir un token nuevo sin pedido del owner.
- Copiar el HTML/CSS de la referencia de Stitch.
- Colores, radios, sombras o tipografías fuera de token.
- Subir un techo de `design-tokens.allow.json` para que el contrato pase.
- Cerrar una pantalla sin verla en navegador real.
- Dejar un control decorativo o texto que no cambia una decisión.
- Tocar `src/app/**/page.tsx` sin correr `build:webpack`.
