# MOTION.md — ley de movimiento

**Qué es**: cuánto y para qué se mueve la interfaz. Motion es **feedback, continuidad y jerarquía**, nunca
decoración.

**Regla de oro**: si el movimiento no ayuda a entender un cambio de estado, una entrada/salida o una
confirmación, se quita.

---

## 1. Escala (tres pasos, ni uno más)

| Token | Valor | Para qué |
|---|---|---|
| `--motion-fast` | **120 ms** | feedback inmediato: hover, pressed, foco, check, chip |
| `--motion-standard` | **180 ms** | transición de estado y de superficie: tabs, disclosure, toast |
| `--motion-emphasized` | **240 ms** | entrada/salida de una capa: modal, sheet, drawer, popover |

Curvas: `--motion-ease-standard` (`cubic-bezier(0.2, 0, 0, 1)`) para casi todo; `--motion-ease-emphasized`
(`cubic-bezier(0.2, 0, 0, 1.2)`) **solo** en la entrada de una capa, nunca en un bucle.

**Estado real del repo**: los componentes usan hoy las duraciones de Tailwind
(`transition-colors` = 150 ms, `duration-200`, `duration-300`; 62 `transition-*`, 7 `duration-*`, 1 `ease-*`).
Eso **corresponde** a la escala de arriba y **no se migra en bloque**: los tokens son el vocabulario y cada
sección los adopta cuando se revisa. Cambiar el timing de todas las pantallas de una vez está prohibido.

## 2. Qué se anima

- **Hover / pressed**: cambio de color o de superficie con `transition-colors` (fast). Nada de escala ni de
  desplazamiento en desktop.
- **Foco**: el anillo aparece **sin** animación (es accesibilidad, no efecto).
- **Cambio de estado operativo** (pendiente → preparación → listo): transición de color de fondo, borde y
  texto; el punto del estado **en reposo es estático**.
- **Entrada/salida de capas**: modal, sheet, popover, drawer y toast entran con opacidad + desplazamiento
  corto (8–16 px) en `emphasized`; salen más rápido que como entran (fast).
- **Toast**: entra y se va solo; no se queda pegado ni rebota.
- **Loading**: esqueleto (`Skeleton`) o spinner donde el contenido todavía no existe; el **botón** que carga
  conserva su tamaño (§ [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §10).
- **Continuidad**: al abrir un detalle desde una lista, lo que ya estaba en pantalla no salta; si algo
  cambia de tamaño, el layout se reserva con anticipación.

## 3. Qué NO se anima

- Nada ornamental: `bounce`, `scale` exagerado, `glow` permanente, parallax, entrada escalonada de tarjetas.
- Ninguna animación en bucle **salvo** que represente un estado funcional real: `loading`, **SLA vencido** o
  **sincronización perdida**.
- `animate-pulse` **solo** en SLA vencido o desincronización (y en esqueletos de carga). El pulso
  decorativo está prohibido.
- Ninguna animación que retrase una acción del usuario: el feedback es inmediato, aunque el resultado llegue
  después.
- Nada de animar dinero, contadores o cronómetros **cambiando el valor**: el número cambia, no "rueda".

## 4. `prefers-reduced-motion` (obligatorio)

El sistema declara el modo reducido **una sola vez**, global, en `src/app/globals.css`: cuando el sistema
operativo lo pide, se neutralizan duraciones de animación y transición y el desplazamiento suave. Es una
garantía de accesibilidad, no una preferencia estética — y cubre también lo que se escriba en el futuro.

Además, un componente que anima de forma **propia** (un `animate-pulse`, un `transition` con
desplazamiento) declara su variante `motion-reduce:*`. Hoy lo hacen el esqueleto, el toggle, las tabs, el
shell del panel y varios bloques del KDS (47 usos de `motion-reduce:`); los que **no** lo hacen quedan
cubiertos por la regla global y se corrigen cuando su sección se revise.

El landing público tiene además su propia regla de reduced-motion, por ser una superficie con animación de
scroll propia.

## 5. Cómo se verifica

- **Contrato**: `prefers-reduced-motion` está declarado en `globals.css`, este documento lo explica y la
  cantidad de usos de `motion-reduce:` no cae por debajo de un piso (deuda ratcheteada).
- **Manual (navegador real)**: con la preferencia activada, ninguna acción deja de ser comprensible y nada
  queda animándose en bucle.
- **No se automatiza** "se siente fluido": eso se mira en la pantalla, con el owner.
