# Spec de pantalla — Finanzas (`/admin/finance`)

> **Plantilla**: [`TEMPLATE.md`](TEMPLATE.md). **Estado**: creada por
> `TASK-MONEY-PAYMENTS-FOUNDATIONS-001` (docs-only, 2026-09-28) a partir de la **referencia aprobada por el
> owner el 2026-09-27** ([`finance-reference.html`](finance-reference.html), versión byte a byte de
> `one-burger-finanzas-desktop-reference.html`, SHA-256 `3964f097…68e09`, 33.528 bytes). **Nada de esta spec
> está implementado**: la ruta `/admin/finance` **no existe hoy**, no hay entrada de navegación y el backend
> **no tiene** el catálogo de monedas, el de medios de pago ni el historial de tasas que la pantalla
> administra (§ *Datos disponibles*).
>
> **Qué es**: la SPEC de la superficie de **configuración financiera**. Consume dos módulos que hoy **no
> existen** (`money`, `payments`), un catálogo que **sí existe** (`banks`) y la configuración actual del
> negocio (`business-settings`). **No crea módulos**: la creación de `money` y `payments` es dirección de
> [`MODULE_ARCHITECTURE.md`](../../product/MODULE_ARCHITECTURE.md) §4.1 y la decide el roadmap, no esta spec.
>
> **Qué NO es**: no es un tablero de resultados, no muestra ventas ni arqueos (eso es Caja y Cierres), no
> emite facturas (eso es Facturas) y **no recategoriza el dinero ya cobrado**. Es una pantalla de
> **Configuration**: cambia cómo funciona el sistema hacia adelante.
>
> **Prohibiciones que esta spec respeta**: no inventa monedas, tasas, entidades ni medios como estructura
> cerrada de la UI; **no** presenta el cambio de moneda base como un input que reinterprete hechos
> históricos; no hardcodea `NIO`, `USD`, `C$` ni `Nicaragua` como ley del producto; no mueve ninguna regla de
> dinero a React; y no define «pagado» (el estado financiero del pedido es de `payments`).

---

## Reuse audit

**Objetivo**: que el dueño pueda administrar, en un solo lugar y sin tocar código, **cómo entra la plata** —
qué monedas acepta el negocio, a qué tasa, con qué medios de pago y contra qué entidades de cobro — y que esa
configuración sea la **única autoridad** que el resto del sistema consume.

**Capacidad existente** (verificada en el código, 2026-09-28):

| Capacidad | Dónde vive hoy | Estado |
|---|---|---|
| Moneda base, símbolo y locale | `BusinessSettings.currencyCode` / `currencySymbol` / `locale` (`prisma/schema.prisma:829-831`), pantalla **Personalización** (`/admin/settings`) | REAL, pero es **un solo valor** y no hay catálogo |
| Tipo de cambio | `BusinessSettings.usdExchangeRate` (`prisma/schema.prisma:833`), editable en `/admin/settings` | REAL: **un escalar**, sin historial y sin moneda asociada |
| Conversión | `src/shared/lib/money-conversion.ts` (aritmética única) + `pos/domain/payment-conversion.ts` (traducción a error del POS) | REAL y compartida por POS y Caja |
| Formato de plata | `src/shared/lib/format-currency.ts` (`formatCurrency(amount, {symbol, locale})`) + `useCurrencyFormat()` (`src/shared/lib/business-settings.tsx:50`) | REAL, consumido por ~50 superficies |
| Monedas que la caja cuenta | `cash-config` (`KNOWN_CASH_CURRENCIES`, `DEFAULT_CASH_DENOMINATIONS`) | REAL, con `"NIO"`/`"USD"` **hardcodeados** |
| Entidades de cobro | **`banks`**: `Bank` (`prisma/schema.prisma:1075`) + `LocationBank` (`:1096`), casos de uso `get-bank-catalog` / `save-bank-catalog`, API `GET|PUT /api/admin/cash/banks`, UI `cash-banks-section.tsx` en `/admin/cash/config` | REAL: nombre, código, activo y **qué bancos liquida cada sucursal** |
| Medios de pago | **Nada persistido**: el enum `PaymentMethodType` (`prisma/schema.prisma:433`) y la lista `POS_PAYMENT_METHODS` (`src/modules/pos/domain/pos-sale.ts:17`) | REAL pero **como enum cerrado de código** |

**Se reutiliza**: el catálogo `banks` **tal como está** (se le agrega el concepto de *tipo* de entidad, no se
crea un segundo catálogo bancario); `get-bank-catalog` / `save-bank-catalog` con su validación de nombres y
códigos duplicados (`src/modules/banks/domain/bank-catalog.ts`); `formatCurrency` y `useCurrencyFormat` para
todo lo que se muestra; la aritmética de `money-conversion.ts` como base del módulo `money`; y el patrón de
pantalla de **Config de Caja** (`/admin/cash/config`: `AdminPageHeader` + secciones + guardado explícito con
estado «guardado / sin guardar»).

**Realmente nuevo**:

1. El **catálogo de monedas** (hoy no existe: hay una sola moneda base con un símbolo y un locale).
2. El **catálogo de medios de pago** persistido, con su **tipo canónico** (hoy no existe: es un enum).
3. El **historial de tasas** (hoy no existe: `usdExchangeRate` es un escalar que se pisa).
4. El **tipo de entidad de cobro** (banco / adquirente / proveedor digital / otro) sobre `Bank`.
5. La **ruta** `/admin/finance`, su entrada de navegación y sus tres vistas.
6. La **moneda base como operación explícita** con preservación de historia (hoy es un campo de texto en
   Personalización que cualquier guardado reinterpreta hacia atrás).

**Lo que se elimina y por qué**: los campos `currencyCode` / `currencySymbol` / `locale` / `usdExchangeRate`
**dejan de editarse en Personalización** cuando esta pantalla exista: una configuración mutable tiene **un solo
dueño actual** ([`AGENTS.md`](../../../AGENTS.md) § *Leyes del repo*, ley 7) y hoy la moneda se edita donde
también se edita el color de la marca. La **pantalla** de Personalización no se rediseña en esta TASK.

**Lo que esta spec NO decide**: que `mixed` deje de existir en el enum, qué migración agrega cada tabla y
cómo se tratan los hechos históricos (decisiones de `TASK-MONEY-PAYMENTS-FOUNDATIONS-001` § *Legacy* y del
runtime; acá solo se dice qué muestra la pantalla).

---

## Ruta

`/admin/finance` (**nueva**; se implementa en la TASK de runtime de Money/Payments). Sin subrutas: la edición
de una moneda, un medio o una entidad va en **modal** (§ *Acciones*), como en la referencia aprobada.

## Módulo

**`money` y `payments`** — los dos módulos objetivo de
[`MODULE_ARCHITECTURE.md`](../../product/MODULE_ARCHITECTURE.md) §4.1, que **hoy no existen**:

| Vista | Módulo dueño de la regla | Qué consume |
|---|---|---|
| **Medios de pago** | `payments` (el medio es un hecho del cobro) | `money` (monedas admitidas) · `banks` (entidad) |
| **Monedas y tasas** | `money` | `business-settings` (hoy) |
| **Entidades de cobro** | `banks` (existe) | `locations` (asignación por sucursal) |

**Ningún módulo nuevo nace en esta pantalla**: la ruta es una **superficie de configuración** que consume
casos de uso de `money`, `payments` y `banks`. **Prohibido** crear `modules/finance`.

## Usuario / roles

| Rol | Qué ve y qué hace acá | Por qué |
|---|---|---|
| **owner** | Las tres vistas, con edición completa | Administrar la configuración financiera es del dueño, igual que la de caja (`canManageCashConfig`) |
| **manager** | Nada (redirige a Órdenes) | Puede cobrar y devolver, pero no cambia las reglas del arqueo ni la moneda del negocio |
| **cashier** | Nada | Cobra; no configura |
| **kitchen** | Nada | No maneja plata |

**Alcance**: es configuración **del negocio**, no por sucursal, **excepto** la asignación de entidades de cobro
a locales (`LocationBank`), que ya es por sucursal y se conserva. La pantalla **no** filtra por local salvo en
esa asignación.

**La autorización es del servidor**: la puerta objetivo es `canManageFinanceConfig` (§ *Permisos* del brief).
Ocultar la entrada de navegación no autoriza nada.

## Propósito

Que el dueño cambie **cómo entra la plata** —monedas, tasas, medios y entidades— sin tocar código, y que esa
configuración sea la única que el resto del sistema consulta.

## Preguntas

1. ¿En qué moneda opera el negocio y qué otras acepta? (moneda base + monedas aceptadas)
2. ¿A qué tasa se convierte cada moneda aceptada, y cuál era la tasa anterior? (tasa vigente + historial)
3. ¿Cómo puede pagar un cliente y cómo debe tratarlo el sistema? (medios, con su tipo canónico)
4. ¿Contra qué entidades de cobro se concilia cada medio? (bancos, adquirentes, proveedores digitales)

## Decisiones

Lo que se decide **acá** y qué pasa después:

| Decisión | Efecto |
|---|---|
| Agregar / editar / activar una **moneda** | Pasa a ofrecerse como moneda de cobro habilitable. **No** reinterpreta ningún cobro anterior |
| Registrar una **tasa** | Crea un **hecho nuevo** de tasa con su vigencia. **No** reescribe cobros, cierres ni facturas ya firmados |
| **Cambiar la moneda base** | Operación **explícita y auditada** con su momento de vigencia (§ *Cambio de moneda base*). Los hechos históricos conservan su moneda, su tasa y su equivalente |
| **Cambiar el formato regional** (locale) | Cambia **cómo se ve** la plata, no su valor. No altera ningún monto guardado |
| Crear / editar / activar un **medio de pago** | Pasa a ofrecerse en el POS y en el cobro de un pedido existente. **No** cambia los cobros ya registrados |
| Crear / editar / activar una **entidad de cobro** | Pasa a estar disponible para asociarla a un medio y para el cierre de banco |

Lo que **no** se decide acá: qué significa «pagado» (es de `payments`, no de esta pantalla); el arqueo del
turno (Caja); la emisión de documentos (Facturas); reactivar módulos fuera del MVP.

### Cambio de moneda base (la regla, no un input)

La referencia lo dice en dos lugares (`baseModal`, y el resumen de *Moneda base*): **«Los hechos históricos
conservan su moneda y equivalencia original»** y «Este mock no recalcula datos históricos». La spec lo
congela como **regla de pantalla**:

1. La moneda base **no se edita** en el formulario de la moneda: tiene su propia operación («Cambiar moneda
   base»), su propia confirmación y su propia auditoría.
2. La operación **no recalcula** nada existente: abre un período de vigencia desde el momento elegido.
3. La pantalla **informa el alcance** antes de confirmar: qué cambia hacia adelante y qué **no** se toca.
4. **Prohibido** implementarla como un campo de texto que luego reinterpreta hacia atrás lo guardado.

## Datos disponibles

**Leyenda**: **HOY** = el backend ya lo tiene; **FALTA** = no existe y hay que crearlo en el runtime; **PARCIAL**
= existe pero no alcanza para lo que la referencia muestra.

| Dato de la pantalla | Fuente | Estado |
|---|---|---|
| **Moneda base** (código, nombre, símbolo) | `BusinessSettings.currencyCode` / `currencySymbol` (`prisma/schema.prisma:829-830`) | **PARCIAL**: hay un código y un símbolo; **no hay nombre** de moneda en la base |
| **Formato regional** (locale) | `BusinessSettings.locale` (`:831`), validado con `LOCALE_PATTERN` (`business-settings.schema.ts:208-212`) | **HOY** |
| **Catálogo de monedas conocidas** (para el select «Buscar conocida») | — | **FALTA** |
| **Moneda personalizada** (código interno + nombre + símbolo + decimales) | — | **FALTA** (el código se valida como ISO de 3 letras: `business-settings.schema.ts:184-191`) |
| **Decimales por moneda** | — | **FALTA**: el formato está fijo en 2 (`format-currency.ts:25-28`) |
| **Tasa vigente por moneda** | `BusinessSettings.usdExchangeRate` (un escalar **solo para USD**) | **PARCIAL**: una sola moneda extranjera y sin relación con un catálogo |
| **Historial de tasas** (fecha, valor, actor) | — | **FALTA** |
| **Medios de pago** (nombre, tipo, entidad, monedas admitidas, referencia requerida, activo, disponibilidad por local) | — (hoy son el enum `PaymentMethodType` y la lista `POS_PAYMENT_METHODS`) | **FALTA** |
| **Tipo canónico del medio** (`cash` / `card` / `bank_transfer` / `wallet` / `other`) | — | **FALTA** como dato; existe el enum `PaymentMethodType` (`cash`/`card`/`transfer`/`mixed`/`other`) que **no** es lo mismo (tiene `mixed` y le falta `bank_transfer`/`wallet`) |
| **Entidades de cobro** (nombre, código, activo) | `Bank` (`prisma/schema.prisma:1075-1089`) + `banks/get-bank-catalog` | **HOY** |
| **Tipo de entidad** (banco / adquirente / proveedor digital / otro) | — | **FALTA** |
| **«Utilizada por N medios de pago»** | — | **FALTA** (depende del catálogo de medios) |
| **Disponibilidad por local** del medio | `LocationBank` existe para **bancos**, no para medios | **PARCIAL**: el patrón existe; la relación medio↔local no |
| **Asignación de entidad a sucursales** | `LocationBank` (`:1096`) + `cash-banks-section.tsx` | **HOY** |
| **Auditoría de la última tasa** («Último cambio de tasa: … · … · owner») | `AdminAuditLog` (módulo `audit`) | **PARCIAL**: el log existe; hoy **no se escribe** un asiento por cambio de tasa |

**Nota de honestidad de copy**: mientras un dato sea **FALTA**, la pantalla **no se muestra** (la ruta no
existe todavía). La regla para el runtime es que **ningún campo de la referencia se dibuje con datos
inventados**: o el backend lo tiene, o el campo no está.

## Jerarquía

La referencia es **una sola superficie con tres vistas conmutadas por tabs** (`Medios de pago` ·
`Monedas y tasas` · `Entidades de cobro`), y esa composición es **contrato**:

```text
Encabezado:  Finanzas · Configuración financiera        [ KPIs: base · N monedas · N medios · N entidades ]
Tabs:        Medios de pago | Monedas y tasas | Entidades de cobro
────────────────────────────────────────────────────────────────────────────────
Vista: título corto + una línea de propósito              [ acción primaria ]
       (en Monedas y tasas: dos tarjetas de resumen — moneda base y formato regional)
       tabla: identidad · tipo · entidad · monedas · estado · acciones
       (en Monedas y tasas, al pie: la línea de auditoría de la última tasa)
```

- **Lo primero** es el **estado actual** (qué moneda base, cuántas monedas, cuántos medios): los tres KPIs de
  la cabecera y las dos tarjetas de resumen de *Monedas y tasas*.
- **Lo segundo**, la lista de la vista activa, con una fila por entidad.
- **Lo tercero**, la acción por fila (menú `···`) y la baja/alta (el interruptor de estado).
- Se **elimina** el peso visual de lo que no se decide acá: no hay gráficos ni métricas comerciales.

## Acciones

| Acción | Vista | Label exacto (referencia) | Tipo |
|---|---|---|---|
| Crear medio | Medios de pago | `+ Nuevo medio` | primaria |
| Crear moneda | Monedas y tasas | `+ Agregar moneda` | primaria |
| Crear entidad | Entidades de cobro | `+ Nueva entidad` | primaria |
| Buscar | Medios de pago · Entidades de cobro | `Buscar medio de pago...` · `Buscar entidad...` | filtro |
| Editar / menu de fila | las tres | `···` | secundaria (por fila) |
| Activar / desactivar | las tres | interruptor de estado | por fila, **guardado inmediato** |
| Registrar tasa | Monedas y tasas | `Guardar tasa` (modal `Tipo de cambio`) | de la fila de moneda |
| Cambiar moneda base | Monedas y tasas | `Cambiar moneda base` (tarjeta) | **operación explícita**, con confirmación |
| Cambiar formato | Monedas y tasas | `Cambiar formato` (tarjeta) | modal |
| Guardar en modal | las tres | `Guardar medio` · `Guardar moneda` · `Guardar entidad` | dentro del modal |
| Cancelar | modales | `Cancelar` · `×` | descarta |

**Regla de controles**: todo control es un primitivo del registro (`Button`, `Input`, `Select`, `Checkbox`,
`Toggle`, `Modal`, `Tabs`, `Badge`, `Card`, `Toast`, `HelpText`, `AdminPageHeader`, `AdminEmptyState`).
**Prohibido** el `<input>`/`<select>`/`<button>` crudo y **prohibido** copiar el HTML de la referencia.

**Copy que la referencia fija** (es contrato, no relleno):

- «“Mixto” no es un medio. El sistema lo deriva cuando una venta usa más de un Payment.»
- «El catálogo conocido es conveniencia, no una restricción. Una moneda personalizada puede usar un código
  interno.»
- «En runtime, guardar una tasa nueva crea historia; no reescribe cobros anteriores.»
- «**Historia protegida.** Los movimientos anteriores conservarán moneda, tasa y equivalente con los que
  fueron registrados.»
- «Este nivel no almacena credenciales, números de cuenta ni secretos de procesadores.»

## Estados

| Estado | Qué dice y qué se puede hacer |
|---|---|
| **Cargando** | Esqueleto de la tabla (`Skeleton`), sin textos de relleno |
| **Vacío** | «Todavía no hay monedas cargadas» / «…medios de pago» / «…entidades de cobro», con la acción primaria como única salida |
| **Con datos** | Tabla de la vista activa |
| **Error de lectura** | Mensaje del servidor y reintento; **no** se dibuja una lista vacía como si no hubiera datos |
| **Error de guardado** | Se queda en el modal, con el error del campo; nada se guarda a medias |
| **Sin permiso** | El servidor redirige a Órdenes (no hay vista «sin permiso» para una configuración del dueño) |
| **Parcial** | Si una tabla no puede completar una columna por **FALTA** de dato, el campo **no se dibuja** (la ruta no se abre hasta que el dato exista) |
| **Sin cambios pendientes / con cambios** | La referencia muestra «Sin cambios pendientes» en la cabecera: se implementa como el estado del **guardado** que el sistema de diseño ya exige en una pantalla de Configuration |

## Empty / error / loading

- **Vacío**: una línea + la acción primaria. Sin ilustraciones decorativas.
- **Error de lectura**: una línea con el motivo real y `Reintentar`. Nunca «no hay datos» por un 500.
- **Cargando**: `Skeleton` con la forma de la tabla, para que el layout no salte.

## Desktop

A **1280** (y a **1366×768**): las tres vistas usan **todo el ancho del panel**, con el sidebar del panel a la
izquierda. Composición de la referencia, que es contrato:

- Cabecera: `Finanzas` + `Configuración financiera` a la izquierda; los **tres KPIs** centrados; el estado de
  guardado a la derecha. Debajo, la fila de **tabs**.
- **Medios de pago** (6 columnas): medio (nombre + referencia requerida) · tipo · entidad · monedas · estado ·
  acciones.
- **Monedas y tasas** (6 columnas): código · moneda (nombre + rol) · símbolo · tasa vigente · estado ·
  acciones. Arriba, **dos tarjetas** de resumen (moneda base y formato regional). Al pie de la tabla, la línea
  de auditoría de la última tasa.
- **Entidades de cobro** (5 columnas): nombre (con código) · tipo · utilizada por · estado · acciones.
- La **tabla scrollea dentro del panel** que crece; la **página no scrollea**.

## Tablet

A **768×1024**: los mismos tres bloques, con la tabla conservando **todas las columnas** y `overflow-x` **solo
en el contenedor de la tabla** (nunca en la página); el sidebar del panel colapsa a íconos como en el resto
del panel. Los KPIs de la cabecera pasan a una segunda línea si no entran.

## Mobile

A **375×812**: **sin scroll horizontal**. La tabla de la referencia **no se copia**: cada fila se convierte en
una **tarjeta compacta** con la misma información y la misma jerarquía (identidad → tipo/rol → moneda/entidad →
estado y acciones), y la acción primaria queda alcanzable. Las tarjetas de resumen de *Monedas y tasas* se
apilan. El patrón es el de **Management** en móvil, no una tabla amputada.

## Viewport contract

Es una superficie de **configuración** (no operativa con el reloj corriendo), pero se verifica igual en los
cuatro viewports porque el panel es una superficie real:

| Viewport | Qué tiene que verse en el **primer** viewport | Qué scrollea |
|---|---|---|
| `1366×768` | Titular + KPIs + tabs + el encabezado de la tabla + **las primeras filas** | el cuerpo de la tabla, dentro del panel |
| `1280×720` | Ídem anterior | ídem |
| `768×1024` | Titular + KPIs + tabs + la tabla con sus filas | el cuerpo de la tabla |
| `375×812` | Titular + el estado de guardado + tabs + **la primera tarjeta entera** + la acción primaria | el panel (nunca la página, nunca en horizontal) |

**Medición de cierre** (runtime): `document.scrollWidth === 375` a 375 px, `document.scrollingElement.scrollHeight`
igual al alto del viewport (scroll de página **0**), y las capturas antes/después en los cuatro.

## Referencia aprobada

**`finance-reference.html`** (al lado de esta spec), aprobada por el owner el **2026-09-27**. Es **contrato**
de composición, jerarquía, densidad, copy y comportamiento de los modales:

- **Congelado**: las tres vistas y sus tabs; las columnas de cada tabla; las dos tarjetas de resumen de
  *Monedas y tasas*; la línea de auditoría de tasa; los cinco modales (`methodModal`, `currencyModal`,
  `rateModal`, `baseModal`, `localeModal`, `entityModal`) con sus campos; los cuatro toasts de confirmación;
  y el **copy** citado en § *Acciones*.
- **No congelado** (la referencia es un mock de escritorio): la composición a 768 y 375 (§ *Tablet* y
  § *Mobile*), que se resuelve con los arquetipos y se **congela con esta spec**.
- **Divergencias deliberadas** (ninguna material, todas de implementación): los datos del mock son
  simulados y **no** se copian; el `<select>` de «Buscar conocida» del mock **no** es una lista cerrada en el
  producto (es conveniencia, y el copy lo dice); y el mock **no** implementa la operación real de cambio de
  moneda base (su `changeBaseCurrency` solo cambia una variable): acá se congela como la operación explícita
  de § *Cambio de moneda base*.

**Cierre**: la implementación se compara contra esta spec **y** contra `finance-reference.html` —composición,
jerarquía, copy y comportamiento de los modales— antes de cerrar la TASK; el merge no es la comparación.

## Qué se elimina

1. **La edición de la moneda y del tipo de cambio en `/admin/settings`** (Personalización): pasa a ser de
   `/admin/finance`. Personalización conserva la marca, el contacto y la operación.
2. **El enum `mixed` como valor elegible** de un cobro: la semántica objetivo es *derivado* de más de un
   `Payment` de la misma venta, y la referencia lo dice explícitamente. Qué pasa con el enum y con sus
   consumidores lo decide el runtime (el brief de fundaciones lo audita y lo deja enumerado, **no
   implementado**).
3. **Los literales `"NIO"`, `"USD"`, `"C$"` y las tasas** como estructura de la UI: pasan a leerse del
   catálogo. `cash-config` deja de tener su propia lista de monedas conocidas.
4. **La lista hardcodeada de monedas del POS** (`pos-payment.tsx:167-170`) y la del cobro de un pedido
   existente: las monedas ofrecidas salen de la configuración.

Nada de esto se borra en esta TASK: la TASK es **docs-only** y esto es la deuda que el runtime cobra.

## Fuera de scope

- **Implementar** la pantalla, la ruta, la navegación, las APIs o las migraciones.
- El **rediseño de Personalización** (`/admin/settings`): pierde campos, no cambia de diseño acá.
- **Caja**, **Cierres**, **Facturas**, **POS** y **Pedidos**: consumen la configuración; su UI no se toca.
- La **factura fiscal** y cualquier reforma fiscal.
- El **diseño del sistema**: si algo de esta pantalla pareciera necesitar un token o un patrón nuevos, se
  propone como TASK aparte (`screen-design` §2).
- **Reactivar** módulos fuera del MVP: esta pantalla no los menciona.
