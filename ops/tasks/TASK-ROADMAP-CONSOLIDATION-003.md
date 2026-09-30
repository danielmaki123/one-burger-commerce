# TASK-ROADMAP-CONSOLIDATION-003 — consolidación del roadmap

> **Estado**: **cerrada y mergeada** (`main` = `d3932b4`,
> [PR #101](https://github.com/danielmaki123/one-burger-commerce/pull/101)). **Delivery Mode**: `docs-only`.
> **Cero runtime**: no tocó `src/`, `prisma/`, `tests/` ni CI, y no hubo deploy.
>
> **Por qué existe**: un agente nuevo tiene que poder continuar **sin el chat**. Los documentos decisivos
> afirmaban cosas que el código ya contradecía, así que el mapa con el que arrancaba una sesión era falso.

## Problema

| Documento | Lo que decía | Lo que es |
|---|---|---|
| `PRODUCT-UX-ROADMAP.md` §2 | `3b` «SIGUIENTE TASK»; `4` y `5` «SIGUIENTE: runtime» | los tres **cerrados y desplegados** |
| `PRODUCT-UX-ROADMAP.md` (dependencias) | «el estado financiero canónico **no existe hoy** en ninguna capa» | existe desde el runtime de Money/Payments |
| `MODULE_ARCHITECTURE.md` §4.1 | «**Ninguno existe todavía**» | `money` y `payments` existen; faltan `cash` (7) y `promotions` (10) |
| `design/screens/finance.md` | «**Nada de esta spec está implementado**»; catálogo de monedas, de medios e historial de tasas «no existen» | los tres existen y la pantalla está desplegada |
| `design/screens/orders.md` | `Order.source` «no existe hoy»; «no existe un estado financiero canónico» | el canal se escribe (`D-015`) y el estado existe |

## Alcance

1. **`ops/product/CAPABILITY-REUSE-MAP.md`** (creado): capacidad → dueño canónico → implementación canónica →
   consumidores, con `REUSE`/`MOVE`/`CONSOLIDATE`/`NEW`/`FROZEN` y **qué está prohibido duplicar**. Separa
   **dato** de **regla**. **No decide orden.**
2. **`ops/roadmap/EXECUTION-MAP.md`** (creado): para cada orden **5b→16**, objetivo, estado real auditado,
   dependencias, `REUSE` obligatorio, `MOVE`/`CONSOLIDATE`, `NEW` real, deuda asignada, fuera de alcance,
   decisiones del owner y **gate de cierre**. Toda la evidencia marcada como **snapshot** a revalidar.
3. **`ops/product/MODULE-OWNERSHIP.md`** (creado): qué posee cada módulo hoy y en el objetivo, con el grafo de
   consumo. `MODULE_ARCHITECTURE.md` **baja** de 422 a 413 líneas: su techo solo baja y el inventario se muda.
4. **Una sola pasada documental**: `PRODUCT-UX-ROADMAP.md`, `MODULE_ARCHITECTURE.md`, `design/screens/finance.md`,
   `design/screens/orders.md`, `CURRENT.md`, `NEXT.md`, `START-HERE.md`, `roadmap/README.md` y
   `audit-backlog.md`.
5. **Higiene del backlog**: sólo donde el código ya lo desmiente. `A-81`…`A-90` quedaron cerrados con su
   evidencia; `A-91` y `A-92` se registraron como **deuda del arnés de E2E**, con lo medido.

## Reuse Audit (ley 2)

**`REUSE`**: los documentos existentes y su jerarquía de autoridad (`AGENTS.md` enuncia las leyes; los demás
enlazan y no las repiten). **`MOVE`**: el inventario de módulos, de `MODULE_ARCHITECTURE.md` a
`MODULE-OWNERSHIP.md`. **`NEW`**: sólo los dos mapas; **no** se crea un segundo roadmap, ni un segundo dueño,
ni una tabla de capacidades dentro del roadmap.

## Gate de cierre

- [x] Los dos mapas existen y están enlazados desde el roadmap, la arquitectura y `START-HERE`.
- [x] Ninguna afirmación autoritativa falsa sobre Cocina, Money/Payments, `Order.source`, el estado financiero
      o Finanzas.
- [x] `CURRENT.md` y `MODULE_ARCHITECTURE.md` **no crecieron** para meter detalle de los dos documentos nuevos
      (`MODULE_ARCHITECTURE.md` **bajó** a 413 líneas).
- [x] Los contratos documentales en verde: techos, **una sola autoridad por ley**, `NEXT.md` con a lo sumo una
      TASK activa.
- [x] `ACTIVE: Ninguno` · `NEXT: Pedidos runtime 5b` · `LATER: 6→16`.
- [x] Deuda asignada al mapa futuro, tras revalidación.
- [x] Los hallazgos operativos (`A-57`) y de arnés (`A-91`, `A-92`) **siguen visibles** y **no** se metieron
      en una feature.
- [x] Un solo PR, CI verde (los cuatro checks), squash merge, `main` limpio.

## Verificación

`test:contracts` **156** en verde; suite completa **519 archivos / 3788 tests**; `typecheck` y `lint` en verde.
CI del PR: `verify` 4m8s, `contracts` 44s, `migrations` 1m21s, `container` 2m5s.

## Estado documental final (tras el merge)

`main` = `d3932b4`. Producción sirve `build-20260929-040610` (el código de `32ca238`): **el diff entre lo
desplegado y `main` es sólo `ops/`** — cero archivos de `src/`, `prisma/`, `tests/` o CI— así que **no hace
falta otro rebuild**.
