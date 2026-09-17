# Roadmap POS · Fase 2 — 13 bloques

> **Qué es este archivo**: el roadmap funcional del **POS completo (Fase 2)** que definió el owner.
> Es un documento de **producto/alcance**, distinto de `ops/audit-backlog.md` (que es el backlog de
> hallazgos de UI y deuda). Los dos conviven, pero se priorizan distinto.
>
> **Origen**: se pasó por chat el 2026-09-17 y **nunca se había guardado como `.md` en el repo**
> (error de proceso). Se guarda acá **verbatim** para que el inventario de
> [`ops/tasks/audit-ui/pos-fase2-status.md`](audit-ui/pos-fase2-status.md) tenga su fuente.
>
> **Estado**: **no es un plan aprobado para ejecutar** todavía: primero se mide (inventario) y después
> el owner decide. Lo que no esté en este archivo no es alcance de Fase 2.

---

Necesito un inventario COMPLETO del estado actual del proyecto
para saber qué está hecho y qué falta. Esto define Fase 2.

NO escribas código. NO propongas cambios. Solo inventario.

## Output

Un archivo: ops/tasks/audit-ui/pos-fase2-status.md

## Estructura del reporte

Para cada tarea de los 13 bloques de abajo, respondé:

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1.1 | ... | HECHO / PARCIAL / NO EXISTE / DIFERENTE | ruta:línea |

Categorías:
- HECHO: existe y funciona
- PARCIAL: existe a medias
- NO EXISTE: no está
- DIFERENTE: existe con otra forma/alcance

## Bloques a auditar

### Bloque 1 — Caja (núcleo)
1.1 Persistir expectedByCurrency en Shift
1.2 Calcular y persistir ventas por método al cerrar
1.3 /admin/cash con historial de cierres
1.4 Detalle de un cierre (/admin/cash/history/[id])
1.5 Reporte diario consolidado
1.6 PDF del cierre bajo demanda
1.7 Cierre obligatorio configurable
1.8 Alerta al dueño si turno sin cerrar >24h
1.9 Operario NO ve detalles al cerrar
1.10 Reabrir turno cerrado (canManageCash + motivo)
1.11 Cierre ciego (no mostrar esperado antes de contar)
1.12 Cierre X (lectura parcial sin cerrar)
1.13 Handover entre cajeros

### Bloque 2 — Movimientos de caja
2.1 Modelo CashMovement
2.2 Movimientos afectan el expected
2.3 UI de movimientos en /admin/cash
2.4 Categoría de movimiento
2.5 Límite de retiro sin aprobación
2.6 Aprobación de movimiento grande

### Bloque 3 — Devoluciones
3.1 Modelo Refund
3.2 Refund con aprobación owner/manager
3.3 Refund parcial (1 ítem)
3.4 Void antes del cierre (anular cobro)
3.5 Notificación al admin en cancelación de pedido cobrado
3.6 /admin/approvals con refunds pendientes
3.7 Notificación al dueño si refund >X monto

### Bloque 4 — Métodos de pago
4.1 Transferencia en UI (sale-payload.ts)
4.2 Split payment (1 pedido, N pagos)
4.3 Mixto con múltiples tarjetas

### Bloque 5 — Factura editable
5.1 BusinessSettings: taxId, legalName, taxAddress, taxPhone
5.2 Customer: taxId, legalName
5.3 Generador PDF de factura
5.4 Modelo Invoice (draft + emitted)
5.5 Flujo editable (POS + detalle)

### Bloque 6 — Dólares
6.1 Saldo por moneda en cierre
6.2 Sin arrastre automático

### Bloque 7 — Permisos
7.1 canManageCash, canRefund, canViewCashHistory
7.2 Aplicar permisos en rutas nuevas
7.3 Helper E2E acepta cashier

### Bloque 8 — Sidebar
8.1 Grupos: OPERACIÓN, CONTROL, CATÁLOGO, CONFIGURACIÓN
8.2 Renombrar "Caja" → "POS"
8.3 Rutas /admin/cash, /admin/cash/history, /admin/approvals
8.4 Visibilidad por rol

### Bloque 9 — POS (venta)
9.1 POS limpio (sin tab de Caja)
9.2 Banner si no hay caja abierta + bloqueo cobro
9.3 Venta rápida (producto sin carrito)
9.4 Guardar pedido en espera (hold)
9.5 Retomar pedido en espera
9.6 Aplicar promociones/cupones
9.7 Descuentos manuales con permiso
9.8 Producto agotado bloqueado en POS
9.9 Cliente recurrente (vincular a historial)

### Bloque 10 — Impresión
10.1 Impresión de ticket de cocina
10.2 Impresión de ticket de cliente
10.3 Impresión separada por estación
10.4 Reimpresión
10.5 Cola de reintentos si falla impresora

### Bloque 11 — Cuadre y conciliación
11.1 Cuadre de tarjeta (contra lote de terminal)
11.2 Cuadre de transferencia
11.3 Export CSV de cierres
11.4 Envío por email al dueño
11.5 Cierre del día consolidado
11.6 Comparativa entre sucursales

### Bloque 12 — Offline y resiliencia
12.1 Modo offline del POS (IndexedDB + sync)
12.2 Rate limiting en cobros (anti doble submit)
12.3 Reconexión sin perder pedido en curso
12.4 Indicador de estado de conexión

### Bloque 13 — Auditoría y log
13.1 Log de acciones sensibles
13.2 Historial de movimientos del turno
13.3 Firma digital (nombre impreso en el cierre)

## Sección final — Resumen ejecutivo

Al final del archivo, agregá:

### Lo que está HECHO
- Lista de números (ej: 1.1, 1.3, 4.1)

### Lo que está PARCIAL
- Lista con qué falta en cada uno

### Lo que NO EXISTE
- Lista priorizada: 🔴 crítico, 🟡 importante, 🟢 nice to have

### Lo que EXISTE DIFERENTE
- Lista con qué cambia

### Estadística
- Total tareas: N
- Hechas: N (%)
- Parciales: N (%)
- No existen: N (%)
- Diferentes: N (%)

## Reglas

- NO escribir código
- NO proponer cambios
- Solo inventario + clasificación
- Cada afirmación con ruta:línea o "NO EXISTE"
- Si algo es ambiguo → "AMBIGUO"
- Si algo es parcial → explicar qué falta

## Output final

ops/tasks/audit-ui/pos-fase2-status.md

Cuando termines, PARÁ y reportá:
- Cuántas tareas auditadas
- Cuántas hechas/parciales/no existen/diferentes
- Top 10 tareas críticas que faltan

No sigas. Esperá OK.
