# One Burger — Product, Architecture & Design Roadmap

**Estado:** roadmap maestro de transición  
**Objetivo:** pasar de la estabilización técnica a una evolución ordenada del producto sin rehacer dos veces la misma sección.

---

## 1. Principio central

```text
SEGURIDAD / DINERO ESTABLE
        ↓
ARQUITECTURA DEL PRODUCTO
        ↓
DESIGN SYSTEM
        ↓
DISEÑO DE UNA SECCIÓN
        ↓
IMPLEMENTACIÓN
        ↓
QA
        ↓
SIGUIENTE SECCIÓN
```

No volver a:

```text
programar pantalla
↓
descubrir que estaba mal ubicada
↓
rediseñarla
↓
cambiar componentes
↓
volver a programarla
```

La meta es resolver cada sección una sola vez y con intención.

---

## 2. Fase 0 — cerrar estabilización técnica

Antes de iniciar este roadmap debe terminar A-15.

### A-15 — cancelación, refunds, reversals y métricas netas

Decisiones ya tomadas:

- nunca borrar `Payment`, `Refund`, `Invoice` ni historia financiera;
- cancelar un pedido no mueve dinero automáticamente;
- dinero recibido y posteriormente devuelto → `Refund`;
- cobro registrado que debe invalidarse → `Void/Reversal`;
- actor, fecha y motivo obligatorios;
- inicialmente las operaciones sensibles requieren capability de owner;
- factura original permanece con su estado correspondiente;
- métricas comerciales no pueden contar dinero devuelto o invalidado como ingreso.

Cuando A-15 cierre y `main` esté verde:

> se considera cerrada la fase de estabilización general, salvo aparición de un nuevo P0/P1 crítico.

Backups, monitoring y resiliencia pueden permanecer en backlog sin impedir el trabajo normal del producto, salvo riesgo crítico nuevo.

---

## 3. Fase 1 — ARCH-001: Product & Module Architecture

### Objetivo

Crear una constitución pequeña que responda:

> ¿Dónde pertenece cada capacidad y quién es dueño de sus reglas?

No reorganizar todo el código.  
No rediseñar pantallas.  
No crear módulos futuros por anticipación.

### Fuente normativa futura

```text
ops/product/MODULE_ARCHITECTURE.md
```

### Definiciones oficiales a fijar

**Módulo**  
Capacidad estable del negocio con responsabilidades y reglas propias.

**Sección**  
Agrupación coherente de navegación.

**Pantalla**  
Vista concreta que permite cumplir una tarea.

**Feature**  
Capacidad específica dentro de un módulo.

**Overview**  
Vista transversal que consume información de varios módulos sin convertirse en dueño de ellos.

### Regla de creación

Una feature nueva pertenece por defecto a un módulo existente.

Crear módulo, sección o entrada principal de navegación es la excepción y requiere justificar:

- responsabilidad estable del negocio;
- tareas propias;
- datos/reglas propios;
- necesidad de acceso recurrente;
- imposibilidad de ubicarlo naturalmente en un módulo existente.

### Arquitectura conceptual actual

```text
RESUMEN
→ overview transversal del owner

OPERACIÓN
→ Órdenes
→ POS

CONTROL
→ Caja
→ Cierres
→ Aprobaciones
→ Configuración de Caja

CATÁLOGO
→ Menú

NEGOCIO / CONFIGURACIÓN
→ Locales
→ Usuarios
→ Personalización
→ Alertas
```

No crear todavía `Ventas`, `Analytics`, `Productos` o `Inventario` como secciones nuevas solo porque puedan existir en el futuro.

### Ownership conceptual

Una entidad puede aparecer en varias pantallas, pero su significado se define en un solo dominio.

| Concepto | Owner conceptual |
|---|---|
| Order | Órdenes |
| Shift | Caja |
| Cash count / cierre | Caja |
| Product / Category / Modifier | Catálogo |
| Location | Locales |
| User / Role | Auth / Usuarios |
| BusinessSettings | Configuración |
| Invoice | dominio financiero/facturación |
| Refund | dominio financiero |

### Regla especial de Resumen

`/admin` es transversal.

> Resumen muestra señales; las secciones propietarias muestran y resuelven el detalle.

Ejemplos:

```text
2 pedidos atrasados → Ver Órdenes
1 cierre con diferencia → Ver Cierres
Top productos → señal comercial, no módulo Productos
```

### Navegación

El sidebar no es un sitemap.

Una ruta de detalle puede existir sin entrada propia.

Preferencia:

```text
Sección
  ↓
Pantalla
  ↓
Detalle
```

Si se requieren muchos niveles, revisar la arquitectura antes de seguir.

### Roles

Los roles cambian permisos, scope, acciones e información visible.

No deben crear productos o rutas paralelas.

### Datos dinámicos

Sucursales, productos, categorías, usuarios y otras entidades administrables nunca se enumeran como estructura fija en JSX.

Una nueva sucursal debe aparecer donde corresponda por datos, no por modificar componentes.

### Límite de ARCH-001

No debe:

- mover masivamente carpetas;
- renombrar todas las rutas;
- rediseñar sidebar;
- crear Ventas/Analytics/Productos;
- tocar DB;
- cambiar lógica funcional;
- rediseñar pantallas.

---

## 4. Fase 2 — DS-001: One Burger Design System v4

### Objetivo

Crear la única ley visual vigente.

DS-001 no rediseña ninguna pantalla existente.

### Cadena de autoridad

```text
Owner / regla de producto
        ↓
Seguridad / funcionalidad / accesibilidad
        ↓
MODULE_ARCHITECTURE
        ↓
DESIGN_SYSTEM
        ↓
Spec aprobada de pantalla
        ↓
Registry de componentes
        ↓
Implementación
```

### Stitch

Stitch deja de ser normativo.

Puede conservarse como historia/evidencia, pero:

- no manda;
- no es lectura obligatoria;
- ninguna skill debe exigirlo;
- no decide nuevos diseños.

### Estructura futura

```text
ops/design/
├── DESIGN_SYSTEM.md
├── CONTENT.md
├── PATTERNS.md
├── MOTION.md
├── DATA_VISUALIZATION.md
└── screens/
    └── TEMPLATE.md
```

### Principios visuales

One Burger debe sentirse:

- premium sin ostentación;
- limpio;
- operativo;
- rápido de escanear;
- de alta densidad útil;
- jerárquico;
- con poco texto explicativo;
- accesible;
- responsive;
- consistente.

Premium no significa más cards, colores, sombras o animaciones.

Premium significa:

- menos ruido;
- mejores decisiones;
- mejor jerarquía;
- ritmo espacial consistente;
- feedback preciso;
- tipografía y densidad deliberadas.

### Color y theming

Los componentes consumen intención semántica, no colores concretos.

Ejemplos:

```text
brand-primary
surface
surface-elevated
text-primary
text-muted
status-danger
status-success
chart-primary
```

No hardcodear paletas dentro de componentes.

Separar:

**Brand** — configurable.  
**Structural** — controlado/derivado por el sistema.  
**Semantic** — success/warning/danger/SLA protegidos.

`BusinessSettings` debe poder alimentar la identidad de marca en Menú, Admin, POS, KDS y charts sin que cada componente tenga que modificarse manualmente.

DS-001 prepara la arquitectura; no recolorea todo el producto.

### Content Design

> Si una interacción normal necesita un párrafo para entenderse, primero se rediseña la interacción.

La interfaz debe comunicar por posición, jerarquía, agrupación, estado, números, iconografía y acción antes de añadir explicación textual.

### Botones

Preferir verbo + objeto:

- Crear usuario
- Guardar cambios
- Cerrar turno
- Reembolsar pago

Evitar labels vagos cuando el contexto no sea inequívoco.

Una acción primaria por contexto visual.

Estados mínimos:

- default;
- hover;
- pressed;
- focus-visible;
- disabled;
- loading.

### Motion

Motion es feedback, no decoración.

Debe haber una escala pequeña y compartida.

Obligatorio:

- `prefers-reduced-motion`;
- patrones comunes para menu/popover/sheet/modal/toast;
- evitar rebotes, glows e infinite animation sin propósito funcional.

### Cards

Card significa agrupación semántica.

No usar Card como wrapper universal.

Evitar nesting visual profundo.

### Formularios

Default:

```text
Label
[ Control ]
```

Helper text solo cuando evita error o explica una regla no evidente.

### Progressive disclosure

No mostrar configuración secundaria permanentemente.

Usar cuando corresponda:

- tooltip;
- disclosure;
- sheet;
- drawer;
- modal;
- details.

### Arquetipos

PATTERNS debe definir al menos:

- Dashboard / Overview
- Operational
- Management
- Configuration
- Detail

### Data Visualization

La visualización responde una pregunta de negocio.

| Pregunta | Patrón |
|---|---|
| ¿Cuánto? | Metric/KPI |
| ¿Subió o bajó? | Delta / sparkline |
| ¿Cómo evoluciona? | Line/area |
| ¿Quién rinde mejor? | Bars / ranking |
| ¿Cómo se distribuye? | Donut con pocas categorías |
| ¿Qué requiere atención? | Ranked/alert list |
| ¿Necesito valores exactos? | Table/list |

> Si dos números explican mejor que un gráfico, no usar gráfico.

### No inventar métricas

No crear margen, proyección, conversión u otras métricas si el backend no puede defenderlas con datos reales y fórmula clara.

### Responsive

QA visual mínimo:

- 375 px
- 768 px
- 1280 px

Mobile no es desktop comprimido.

### Legacy policy

```text
pantalla legacy no revisada
→ puede permanecer temporalmente

deuda nueva
→ prohibida

pantalla rediseñada
→ debe salir bajo DS v4

pantalla nueva
→ DS v4 obligatorio
```

---

## 5. Fase 3 — migración sección por sección

No hacer migración masiva.

Cada sección pasa por una única revisión completa:

```text
1. Auditar estado actual
        ↓
2. Arquitectura de la sección
        ↓
3. Information Architecture
        ↓
4. UX
        ↓
5. Screen Spec
        ↓
6. Aprobación owner
        ↓
7. Implementación DS v4
        ↓
8. QA
        ↓
9. Cerrar
```

### Arquitectura de esa sección

Responder:

- ¿a qué módulo pertenece?;
- ¿qué responsabilidad posee?;
- ¿qué cosas actuales no deberían estar ahí?;
- ¿qué features son propias?;
- ¿qué consume de otros módulos?;
- ¿qué permisos requiere?;
- ¿debe aparecer en navegación?

### Information Architecture

Definir:

- información principal;
- secundaria;
- detalle;
- disclosure;
- elementos a eliminar.

### UX

Definir:

- tarea principal;
- decisiones;
- acciones;
- estados;
- errores;
- empty states;
- desktop;
- mobile.

### Screen Spec

Todo rediseño material crea:

```text
ops/design/screens/<screen>.md
```

Debe contener:

- ruta;
- usuario;
- objetivo;
- preguntas;
- datos;
- jerarquía;
- acciones;
- estados;
- responsive;
- qué se elimina;
- fuera de scope.

La spec no crea nuevas leyes de diseño.

### Cambios al Design System

Una pantalla no modifica DS automáticamente.

Primero preguntar:

> ¿Esta necesidad es universal?

Si sí, mejorar DS.  
Si no, resolverla en la spec local.

---

## 6. Primera pantalla — `/admin` Resumen

Después de ARCH-001 y DS-001, la primera migración será Resumen.

No se implementa antes de diseñarla con el owner.

### Principio

> Resumen muestra señales; las secciones muestran el detalle.

### Propósito

Permitir al owner entender en segundos:

- cómo está el negocio;
- qué está pasando;
- qué requiere atención.

No convertirse en Ventas, Caja, Productos, Órdenes o Analytics a la vez.

### Contenido permitido

Solo información respaldada por módulos/datos existentes:

- ventas/valor comercial disponible;
- pedidos;
- pedidos abiertos;
- atrasados;
- tendencias;
- comparación temporal;
- comparación dinámica por sucursal;
- top productos si el dato existe;
- estado resumido de caja;
- excepciones accionables.

### Accesos

No duplicar sidebar.

MAL:

```text
[Usuarios] [Menú] [Locales] [Caja]
```

BIEN:

```text
2 pedidos atrasados
→ Ver pedidos

1 cierre con diferencia
→ Revisar cierre
```

> La navegación dice adónde puedo ir. Resumen dice por qué debería ir.

### Entidades dinámicas

Sucursales y otras entidades configurables se renderizan desde datos.

Si aparece una nueva sucursal, entra automáticamente en filtros, comparaciones y gráficos cuando corresponda.

---

## 7. Nuevos módulos/secciones futuros

Cuando aparezca una necesidad como Ventas, Productos, Analytics o Inventario:

```text
¿Es módulo?
¿Es pantalla?
¿Es feature?
¿Quién es dueño?
¿Necesita navegación?
```

Solo después se diseña e implementa.

No reservar rutas vacías.

---

## 8. Anti-patrones

Evitar:

- crear pantalla y luego decidir dónde pertenece;
- crear sección por cada feature;
- convertir sidebar en sitemap;
- duplicar lógica de dominio en dashboards;
- hardcodear sucursales/productos;
- inventar KPI;
- crear gráficos decorativos;
- explicar cada control con párrafos;
- usar cards para todo;
- permitir que cada agente improvise estilos;
- consultar múltiples sistemas externos en cada TASK;
- rediseñar muchas pantallas simultáneamente;
- mantener documentos contradictorios activos;
- hacer una migración visual masiva antes de definir cada sección.

---

## 9. Roadmap operativo oficial

```text
A-15
│
├── completar
├── merge
├── CI verde
└── cerrar estabilización
        ↓
ARCH-001
│
├── MODULE_ARCHITECTURE
└── cero rediseño
        ↓
DS-001
│
├── Design System v4
├── skills
├── contracts
└── cero rediseño
        ↓
SCREEN-001 — Resumen
│
├── discovery
├── arquitectura
├── IA
├── UX
├── spec
├── aprobación
├── implementación
└── QA
        ↓
SCREEN-002
        ↓
SCREEN-003
        ↓
...
```

---

## 10. Principio final

> One Burger no se seguirá desarrollando como una colección de pantallas independientes.

Se desarrollará como un producto compuesto por capacidades dentro de una arquitectura estable, aplicando un único Design System y resolviendo cada sección de punta a punta una sola vez.
