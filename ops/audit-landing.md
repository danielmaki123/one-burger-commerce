# Auditoría del landing — oneburgernic.com

> 2026-09-10 · Alcance: el landing del apex (`/landing`, servido en `/` por rewrite).
> Auditoría **de código y medición**: todos los números salen de correr el sitio real
> (`scripts/audit-landing.mjs` y `scripts/audit-landing-mobile.mjs`). No incluye juicio
> visual: quien la escribió no puede ver la página renderizada.

## Puntaje

| # | Dimensión | Puntaje | Hallazgo principal |
|---|---|---|---|
| 1 | Accesibilidad | 3/4 | El botón se alcanza por teclado y el contraste es 10:1; el texto de ayuda se anuncia sin aportar nada |
| 2 | Performance | 2/4 | La causa de los 11 s no era la precarga sino el peso del JS y las fuentes (abajo) |
| 3 | Theming | 2/4 | Tokens propios del landing, pero hex fijos y desacoplados del color de marca del negocio |
| 4 | Responsive | 3/4 | Verificado a 375 px sin scroll horizontal; `dvh` aplicado |
| 5 | Anti-patrones | 3/4 | El botón acumulaba 4 tells; el resto de la página está limpio |
| **Total** | | **13/20** | **Aceptable, ya corregido lo crítico** |

### Corregido en esta pasada

- **Botón rediseñado**: pastilla ámbar sólida, sin borde, sin degradado, sin brillo
  interior y sin halo. Peso 700 real (antes 950, que no existe), 16 px (antes 15,68),
  tracking 0,06em (antes 0,16em), una sola transición de entrada con curva ease-out.
  Se agregó una flecha que se desplaza al hover y `scale(0.97)` al presionar.
- **`MENU` → `MENÚ`**: faltaba la tilde, en un sitio en español.
- **Ayuda de scroll**: `aria-hidden="true"` y 12 px (antes se anunciaba y medía 11,2 px).
- **`100dvh`** en el shell y la escena, en vez de `100vh`.
- **Póster de espera**: la primera frame a 24 px embebida como data URI (~1 KB) en el
  CSS, difuminada y superpuesta, que se desvanece cuando la imagen real carga. Antes,
  con datos lentos, el cliente miraba negro.
- **Precarga secuenciada**: no se pide ninguna frame de más hasta que la primera
  terminó de cargar, y las siguientes van con `fetchpriority="low"`.

## Lo que hay que arreglar, por severidad

### [P0] El landing tarda 11 segundos en mostrar algo en celular con datos lentos

- **Medición** (375 px, Slow 4G = 400 kbps / 400 ms de latencia), antes del arreglo:

  | Corrida | Primera frame visible |
  |---|---|
  | 1 | 11 418 ms |
  | 2 | 11 403 ms |
  | Sin throttling | 1 652 ms (LCP) |

- **La causa no era la que supuse.** Mi primera hipótesis fue la ráfaga de precarga;
  la secuencié y **el tiempo no cambió**. La cascada real dice otra cosa:

  | Recurso | KB | Termina en |
  |---|---|---|
  | `burger_0045.webp` | 89 | 11 220 ms |
  | chunk JS | 70 | 12 130 ms |
  | chunk JS | 42 | 10 470 ms |
  | `fraunces_bold.ttf` | 41 | 5 508 ms |
  | `fraunces_regular.ttf` | 40 | 5 398 ms |
  | CSS | 17 | 2 788 ms |

  Total: **327 KB**, de los cuales **135 KB son JavaScript** (React + runtime de Next
  para animar 37 imágenes) y **81 KB son dos pesos de Fraunces que el landing no usa**
  (precargados por el layout raíz porque el sitio de pedidos sí los usa).
  A 50 KB/s eso son 6,5 s de ancho de banda mínimo, y la imagen compite con todo lo
  demás: por eso termina a los 11 s.
- **Lo que hice**: un **póster de la primera frame a 24 px, embebido como data URI
  (~1 KB)** en el CSS, difuminado detrás de la imagen y desvanecido cuando la real
  carga. El cliente ya no mira negro. También secuencié la precarga y la marqué
  `fetchpriority="low"`.
- **Lo que queda pendiente y es la causa de fondo**: el landing no debería pagar
  135 KB de JavaScript para hacer scroll sobre 37 imágenes. Las opciones, en orden de
  impacto:
  1. **Animación dirigida por CSS** (`animation-timeline: scroll()` con 37 keyframes):
     elimina el componente cliente entero. Ojo con Firefox, que todavía no lo soporta.
  2. **Script vanilla mínimo** en vez de un componente React para el scroll.
  3. **`preload: false` en Fraunces** o convertirlo a woff2: son 81 KB del camino
     crítico. No lo hice porque el sitio de pedidos sí usa Fraunces y perdería la
     precarga de sus títulos.
- **Ver `$impeccable optimize`.**

### [P1] El botón MENU acumulaba cuatro tells de IA — corregido

Medido sobre el sitio real:

| Señal | Valor medido | Por qué está mal |
|---|---|---|
| Borde + sombra ancha en el mismo elemento | `border: 1px solid` **y** `box-shadow: 0 18px 48px` | Es el patrón "ghost-card", prohibido explícitamente: se elige borde **o** sombra, nunca los dos como adorno |
| Tres capas de sombra | `0 18px 48px` + `0 0 0 8px` (halo) + `inset 0 1px 0` (brillo) | Decoración apilada; el halo y el inset no cumplen ninguna función |
| Degradado blanco superior + `inset` blanco | `linear-gradient(rgba(255,255,255,.68), transparent 34%)` | Gloss skeuomorfo, estética de 2013 |
| `font-weight: 950` | **No existe**: medido, 700 / 900 / 950 dan el mismo ancho (57,61 px); 400 da 57,11 | La fuente incluida solo trae 400 y 700. El peso "ultra negro" es una intención que no se renderiza |
| `letter-spacing: 0.16em` en mayúsculas | 2,5 px sobre 15,68 px | El "caps trackeado" es el andamio tipográfico que la skill marca como tell |
| `font-size: 0.98rem` | 15,68 px | Valor arbitrario, fuera de cualquier escala |

- **Además**: el texto dice **`MENU` sin tilde**. En español es `MENÚ`.
- **Contraste**: 12:1 sobre `#f9c94d` y 10:1 sobre `#ffad3d` — **excelente**, eso está bien.
- **Corregido**: pastilla ámbar sólida, sin borde/sombra/degradado, peso 700 real, 16 px, tracking 0,06em y una flecha. `$impeccable polish`.

### [P1] El texto "Deslizá" se anunciaba a lectores de pantalla y medía 11,2 px — corregido

- No tiene `aria-hidden`, así que un lector de pantalla lee "Deslizá" al entrar: una
  instrucción inútil para quien no ve la animación.
- `font-size: 11.2px` (0.7rem) está por debajo del mínimo legible de 12 px.
- **Corregido**: `aria-hidden="true"` y 12 px.

### [P2] La animación salta dos veces, y se puede medir

Inventario de la secuencia de 37 frames (la que pediste, tal cual el mock):

| Tramo | Frames de origen | Movimiento por frame |
|---|---|---|
| 1 → 25 | 45 a 69 (consecutivos) | 1 |
| 26 | 69 → 80 | **11** |
| 27 → 30 | 80 a 83 | 1 |
| 31 | 83 → 113 | **30** |
| 32 → 37 | 113 a 120 | 1 |

- La secuencia cubre el **32 %** del rango del video (frames 45-120 de 240) y **el
  movimiento por frame llega a ser 30 veces más rápido** que en el tramo fluido: dos
  teleports, uno en el último tercio del scroll.
- Mapeo medido del scroll: con 63 % del recorrido se ven 25 frames consecutivos; el 37 %
  restante se come los dos saltos.
- **No es un bug de implementación**: es la secuencia elegida. Montar los 120 frames del
  export (que ya están en el repo, fuera de git) lo vuelve parejo. Es una decisión tuya.
- **Recomendación**: si se mantiene en 37, suavizar el salto interpolando opacidad entre
  el frame anterior y el siguiente en la transición, o aceptar el corte como "corte de
  montaje" deliberado.

### [P2] `100vh` en vez de `dvh` — corregido

- `.landing-shell` y `.landing-scene` usan `min-height: 100vh`. En iOS Safari `100vh` es
  el viewport **grande**, así que la escena queda más alta que el área visible cuando la
  barra de direcciones está desplegada.
- **No pude medirlo**: la emulación de Chromium no reproduce la barra dinámica de iOS,
  así que lo reporté como riesgo y no como defecto medido. Ya usa `100dvh`.

### [P2] 3,26 MB de frames

37 frames, 81-102 KB cada una (promedio 90 KB), 720×1280. Para un elemento decorativo que
se muestra a 440 px de ancho en celular, es peso alto. Reencodear a calidad ~0.65 bajaría
el total a ~1,8 MB y la primera frame a ~2 s en Slow 4G, pero **no puedo verificar el
resultado visual** (no puedo ver imágenes), así que no lo hice: el riesgo de banding en el
degradado oscuro es real y habría que mirarlo antes de aceptarlo.

### [P3] Otros

- `will-change` en la imagen: el mock lo tenía, la implementación no.
- El `h1` es `sr-only`: para quien ve la página, el landing no muestra el nombre del
  negocio en ningún lado. Es fiel al mock, pero es una oportunidad perdida de marca.
- Cambio de frame con `img.src` sin `decode()` previo: puede producir un parpadeo. **No lo
  medí**, lo dejo como recomendación.

## Lo que está bien y hay que mantener

- **Contraste**: el label del botón da 10:1 y el texto de ayuda 5,7:1. Sin problemas.
- **Target táctil**: 148 × 54 px, por encima del mínimo de 44 px.
- **Sin scroll horizontal** a 375 px, y el escenario acorta a 255vh en móvil.
- **Teclado**: el botón es el único elemento enfocable y se alcanza con Tab sin scrollear.
- **Movimiento reducido**: sin animación y con el botón visible desde el arranque.
- **Marcado**: un solo `<h1>`, la imagen decorativa con `alt=""` y `aria-hidden`, el botón
  con `aria-label`.
- **Sin anti-patrones de página**: nada de grid de tarjetas, gradientes de texto, texto en
  gradiente, eyebrows repetidos ni glassmorphism.

## Acciones recomendadas, en orden

1. **[P0] `$impeccable optimize`** — secuenciar la precarga para matar los 11,4 s de negro.
2. **[P1] `$impeccable polish`** — rediseñar el botón (quitar borde+sombra, gloss, peso
   inexistente y tracking) y arreglar la tilde de `MENÚ`.
3. **[P1] `$impeccable adapt`** — `dvh`, el texto de ayuda a 12 px y `aria-hidden`.
4. **[P2] `$impeccable animate`** — decidir qué hacer con los dos saltos de la secuencia.
