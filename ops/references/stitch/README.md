# STITCH — material ARCHIVED / NON-NORMATIVE

> **ARCHIVED / NON-NORMATIVE.** Esta carpeta **ya no es la fuente de verdad visual** de One Burger. La ley
> vigente es [`../../design/DESIGN_SYSTEM.md`](../../design/DESIGN_SYSTEM.md) (Design System v4, `DS-001`,
> 2026-09-25), con sus leyes auxiliares en `ops/design/`.
>
> En la práctica: **no manda**, **no es lectura obligatoria**, **ninguna skill la exige**, **no decide diseños
> nuevos** y su HTML **no se copia** (si alguna vez se usa como referencia, se traduce a componentes del
> repo). Se conserva como **historia y evidencia** de cómo se llegó al sistema actual.

## Qué hay acá

| Archivo | Qué es |
|---|---|
| [`design-system.md`](design-system.md) | El sistema **v3.0.0** que estuvo vigente hasta `DS-001`: los tokens, escalas y estados que siguen vivos en `src/app/globals.css` |
| [`DESIGN.md`](DESIGN.md) | Export del mock de origen (YAML + prosa en inglés). **No** es del producto |
| `stitch_redise_o_de_secci_n_existente/` | Las **7 pantallas** del panel migrado (cada una con `code.html` y `screen.png`) y el `DESIGN.md` duplicado del mock |
| [`one_burger_directivas_y_tokens_de_dise_o_design.md`](one_burger_directivas_y_tokens_de_dise_o_design.md) | La **v2.0.0** del mismo sistema (versión anterior, sin uso) |

## Qué sigue vigente de todo esto

Nada **como documento**. Lo que sobrevivió vive en otro lado y con otra autoridad:

- Los **tokens** (`--bg-*`, `--text-*`, `--border-*`, `--brand-*`, `--status-*`, `--radius-stitch-*`,
  `--shadow-elevation-*`, `--text-st-*`) siguen en `src/app/globals.css`, y su ley es el Design System v4.
- El **panel oscuro** y el **público claro** son decisiones del owner que el Design System ratifica.
- Las reglas vinculantes que importaban (contraste, foco, números en mono, 20 % de cabecera, `animate-pulse`
  solo en SLA) están en [`../../design/DESIGN_SYSTEM.md`](../../design/DESIGN_SYSTEM.md).
- El **registro de componentes** (`src/shared/ui/registry.json`) nunca dependió de esta carpeta: apunta al
  Design System v4.

## Prohibiciones

- **No** recrear acá documentos que proclamen autoridad visual.
- **No** volver a exigir esta carpeta desde una skill, un README activo o un contrato.
- **No** borrar este archivo ni los assets: es el archivo histórico del sistema anterior.
