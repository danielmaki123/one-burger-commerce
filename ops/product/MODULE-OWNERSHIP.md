# MODULE-OWNERSHIP — qué posee cada módulo, hoy y en el objetivo

> **Qué es**: el inventario de **módulos de dominio** —cuáles existen, cuáles faltan, qué posee cada uno y quién
> consume a quién—. Sale de
> [`MODULE_ARCHITECTURE.md`](MODULE_ARCHITECTURE.md) §4 para que la constitución quede corta; la **ley** sigue
> enunciada ahí y acá no se repite.
>
> **Qué NO es**: no es el catálogo de capacidades (eso es
> [`CAPABILITY-REUSE-MAP.md`](CAPABILITY-REUSE-MAP.md)), ni la secuencia de trabajo (eso es el
> [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md) y su [mapa de ejecución](../roadmap/EXECUTION-MAP.md)).
>
> ⚠️ **Snapshot** verificado contra `main` = `461cc49` (2026-09-30). Se revalida al iniciar la TASK que lo use.

## 1. Estado de cada módulo

| Módulo | Estado | Qué posee |
|---|---|---|
| `money` | **creado** (órdenes 4 y 5) | Moneda, **moneda base** (`BusinessCurrencySettings`, fila única), locale, **FX con vigencia e historial** (`ExchangeRate`), conversión, redondeo y formato |
| `payments` | **creado** (órdenes 4 y 5) | `Payment`, saldo, cobro parcial, refund, void, **snapshot obligatorio**, estado financiero canónico, idempotencia durable y catálogo de medios con su alcance por local |
| `banks` | **creado, ampliado** | El **catálogo de entidades de cobro** con su **tipo** (banco, adquirente, proveedor digital, otro). **No** hay un catálogo paralelo |
| `orders` | **creado** | `Order`, items y **ciclo de vida**. Consume `money` (moneda congelada) y `payments` (estado financiero). **Presta** todavía el turno y el arqueo |
| `pos` | **creado** | La venta del mostrador: cotiza, decide y **compone**; no es dueño de ninguna regla de dinero |
| `cash-config` | **creado** | Los **billetes y monedas** del negocio y qué monedas cuenta cada sucursal (`countedCurrencyCodes`) |
| `invoices` | **creado** | Documentos y sus **snapshots**; exige `paid` estricto (`D-021`) |
| `menu` · `locations` · `customers` · `notifications` · `audit` | **creados** | Catálogo y precios · autoridad operativa por sucursal · clientes · outbox y avisos · asiento de auditoría |
| `auth` | **creado** | Sesión, roles y las **puertas** de dominio (`admin-permissions`) |
| `dashboard` | **creado** | Read model del negocio: **nunca** dueño de reglas ni de conversión |
| `business-settings` | **creado** | Marca, contacto, horarios, propina y zona horaria. **Dejó de ser** la autoridad monetaria (`A-84`) |
| `cash` | **pendiente** (orden 7) | `Shift`, apertura, movimientos, conteo, cierre, handover y conciliación — hoy vive bajo `orders` |
| `promotions` | **pendiente** (orden 10) | Elegibilidad, alcance, límites, canje y **BOGO** — hoy `coupons` es un cascarón y la elegibilidad vive en el alta de pedidos |
| `inventory` · `reservations` · `tables` · `table-ordering` | **existentes, fuera del MVP** | Se clasifican y sanean en el orden 12; **no se reactivan** sin pedido del owner |

## 2. Quién consume a quién

```text
                    ┌──────────────┐        ┌──────────────┐
                    │    money     │        │   payments   │
                    │ moneda base  │        │  snapshot    │
                    │ tasas, FX    │        │  estado      │
                    └──────┬───────┘        └──────┬───────┘
                           │  dato ya resuelto     │  proyección
        ┌──────────────────┼───────────────┬───────┴────────┐
        ▼                  ▼               ▼                ▼
      pos              orders           invoices        dashboard
   (cobra)          (pedido + vida)   (documento)      (lee, no convierte)
        │                  │
        └────────┬─────────┘
                 ▼
         cash-config / cash (orden 7)
         (cuenta y cierra; consume money para convertir)

      banks ──► payments (entityId)  ·  money (catálogo de monedas)
```

**Reglas que el grafo deja ver**:

1. `money` y `payments` **no consumen** a nadie del resto: son la base.
2. `pos` **no** es dueño de nada de dinero: compone y cobra con lo que le dan.
3. `orders` **presta** el turno y el arqueo hasta el orden 7; después los cede a `cash`.
4. `invoices` y `dashboard` **consumen**: ninguno recalcula ni reconvierte.
5. `banks` es el **único** catálogo de entidades; `payments` lo referencia, no lo copia.
