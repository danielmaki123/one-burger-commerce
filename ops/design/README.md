# ops/design/ — la ley visual de One Burger

**Qué es esta carpeta**: la **fuente normativa visual** del producto (Design System v4, `DS-001`, 2026-09-25).
Reemplaza como autoridad al material de Stitch, que queda **archivado** en
[`../references/stitch/`](../references/stitch/README.md) como historia y evidencia.

## Documentos y qué responde cada uno

| Documento | Responde |
|---|---|
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | **La constitución visual**: principios, color, theming, tokens, tipografía, spacing, surfaces, bordes, radios, elevación, botones, estados, iconografía, responsive, accesibilidad, componentes y legacy |
| [`CONTENT.md`](CONTENT.md) | **Cómo se escribe la interfaz**: títulos, labels, helper, botones, errores, estados vacíos, progressive disclosure y presupuesto de texto |
| [`PATTERNS.md`](PATTERNS.md) | **Arquetipos**: Dashboard/Overview, Operational, Management, Configuration y Detail |
| [`MOTION.md`](MOTION.md) | **Movimiento**: escala, qué se anima y qué no, y `prefers-reduced-motion` |
| [`DATA_VISUALIZATION.md`](DATA_VISUALIZATION.md) | **Datos**: qué patrón responde qué pregunta, tokens de chart, labeling y métricas defendibles |
| [`screens/TEMPLATE.md`](screens/TEMPLATE.md) | **Plantilla de spec de pantalla** para rediseños y pantallas nuevas |

## Cadena de autoridad

```text
Owner / decisión de producto
        ↓
Seguridad / integridad / accesibilidad
        ↓
../../AGENTS.md
        ↓
../product/MODULE_ARCHITECTURE.md
        ↓
DESIGN_SYSTEM.md   ← la ley visual
        ↓
screens/<pantalla>.md   ← la spec aprobada de esa pantalla
        ↓
../../src/shared/ui/registry.json
        ↓
implementación
```

## Cómo se usa

- **Feature o bugfix visual chico** → [`../../.agents/skills/ui-change/SKILL.md`](../../.agents/skills/ui-change/SKILL.md).
- **Pantalla nueva o rediseño material** → [`../../.agents/skills/screen-design/SKILL.md`](../../.agents/skills/screen-design/SKILL.md):
  primero la spec (con aprobación del owner), después la implementación.
- **Cambio al lenguaje visual** (un token, un patrón, una regla universal) → se modifica **este paquete**
  explícitamente, con su justificación. Una pantalla **no** cambia el Design System por su cuenta: primero se
  pregunta *¿esta necesidad es universal?*.

## Qué NO vive acá

Arquitectura de producto, módulos, navegación y ownership de reglas
([`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)); el estado operativo
([`../CURRENT.md`](../CURRENT.md)); el historial visual ([`../DESIGN_LOG.md`](../DESIGN_LOG.md), que **no es
ley**); y el catálogo de componentes, que es ejecutable
([`../../src/shared/ui/registry.json`](../../src/shared/ui/registry.json)).

## Estado

`v4` — creado por `DS-001`. **Ninguna pantalla fue rediseñada por este paquete**: la migración se hace
sección por sección, con el owner, y la deuda visual existente está congelada por contrato hasta que su
sección se revise.
