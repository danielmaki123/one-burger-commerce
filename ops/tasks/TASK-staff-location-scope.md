# TASK-staff-location-scope — A: cada usuario del staff ve las sucursales que tiene asignadas

> **Estado: CERRADA (2026-09-13).** Brief acordado con el owner antes de codear. Decisiones ya
> resueltas (no se re-preguntan): **varias sucursales por usuario** · **sin asignar = ve todas** ·
> el dueño ve todas y su asignación se ignora · pedido fuera de alcance = **403 con mensaje claro**.
> El sonido/avisos de la banda son de la tarea siguiente (`TASK-orders-console.md`, B).
> **Agregado del owner durante la tarea (2026-09-13)**: *"la habilidad para el dueño de poder
> activar o desactivar sucursales"* → fase A10 (ya existía el interruptor en el formulario; se sumó
> el toque único y la guarda del último local activo).

## 1. Qué pidió el owner

> «Los usuarios nuevos, si cae una orden ¿la verán todas las sucursales? Tenemos multi-sucursal, pero
> puede haber confusión si todos ven caer órdenes en todas las sucursales… así que a cada usuario
> debería asignársele una sucursal; el dueño puede ver todas.»

## 2. Lo que se midió antes de tocar nada

- **Hoy no hay ninguna regla por sucursal**: `AdminUser` no tiene local y `GET /api/admin/orders`,
  `GET /api/admin/orders/[id]` y `PATCH /api/admin/orders/[id]/status` solo comprueban el **rol**
  (`canManageOrderOperations`). Cualquier `manager` o `kitchen` ve y opera los pedidos de todas las
  sucursales.
- **Bug vivo en producción**: el filtro por local de la bandeja **no filtra**. `src/app/api/admin/orders/route.ts`
  declara `locationId` en el zod pero nunca lo lee de `searchParams`; lo introdujo `ad0074d` (T8 fase 7),
  cuyo mensaje afirma que el filtro viaja al servidor. Medido contra el server local:
  **650 órdenes con `locationId=loc_que_no_existe` y 650 sin filtro**; con el rango del día, **31 y 31**.
- **El E2E que decía verificarlo es un falso positivo**: mientras el refetch está en vuelo la bandeja
  desmonta la lista (`loading`), así que `toHaveCount(0)` pasa trivialmente y después la fila vuelve.
  Tampoco existe un test de la ruta (`route.test.ts`).

## 3. Regla de visibilidad (dominio puro)

`src/modules/orders/domain/order-visibility.ts` — `resolveOrderLocationScope({ role, assignedLocationIds, requestedLocationId })`:

| Quién | Alcance | `locationId` pedido |
|---|---|---|
| `owner` | todas | se honra tal cual |
| `manager` / `kitchen` **con** asignadas | solo las asignadas | si está fuera del alcance **se ignora** (no es error de datos) |
| `manager` / `kitchen` **sin** asignar | todas | se honra tal cual |

La decisión "sin asignar = ve todas" es a propósito: el día del deploy nadie queda ciego (hoy no hay
ninguna asignación cargada) y el admin lo muestra explícito ("Sin asignar · ve todas"). Un pedido
**puntual** (detalle o cambio de estado) fuera del alcance se rechaza con **403** y mensaje en español:
es personal autenticado del propio negocio, el mensaje honesto ayuda más que ocultar la existencia.

## 4. Modelo y migración

```
model AdminUserLocation {
  adminUserId String
  locationId  String
  createdAt   DateTime @default(now())
  adminUser   AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  location    Location  @relation(fields: [locationId], references: [id], onDelete: Cascade)
  @@id([adminUserId, locationId])
  @@index([locationId])
}
```

Migración `add_admin_user_locations`: **aditiva y sin backfill** (sin BOM). Borrar un local o un usuario
borra sus asignaciones en cascada, así que no quedan filas huérfanas.

## 5. Fases (TDD en cada una)

1. **A1 · dominio**: `order-visibility.ts` + tests (owner / 1 asignada / 2 asignadas / sin asignar ×
   pedido dentro y fuera; una asignada que ya no existe no rompe). ✅
2. **A2 · modelo**: schema + migración + `prisma generate`. ✅
3. **A3 · sesión y repositorio**: `locationIds` en `AdminUserRecord` y `AuthenticatedAdminUser`,
   `findSessionByTokenHash` con las asignaciones, `setUserLocations` en el puerto y en los dos
   adaptadores (el compilador obliga al doble en memoria). ✅
4. **A4 · puerto de pedidos**: `ListOrdersFilter.locationId` → `locationIds?: string[]` (una sola forma
   de filtrar); `delete-location` pasa a `{ locationIds: [id] }`; `list-admin-orders` sin cambios de
   contrato público. ✅
5. **A5 · rutas**: leer `locationId` de `searchParams` y aplicar el alcance (list), 403 fuera de alcance
   (detalle y cambio de estado). Test de ruta nuevo: **sin la lectura del parámetro queda rojo**. ✅
6. **A6 · usuarios**: `POST /api/admin/users` y `PATCH /api/admin/users/[id]` aceptan `locationIds`
   validados contra locales existentes (400 con `fields.locationIds`); el dueño se guarda pero se ignora. ✅
7. **A7 · UI**: selector de sucursales en `/admin/users` (alta y por fila, 44 px, mobile-first, con
   "Ve todas" / "Sin asignar · ve todas"); el filtro de local de la bandeja se dibuja con las
   sucursales del alcance y la lista expone `aria-busy` mientras carga. ✅
8. **A8 · E2E**: arreglar el falso positivo (esperar a que el refetch termine antes de afirmar) y un
   caso nuevo: cocina asignada a una sucursal no ve los pedidos de la otra **ni por URL directa**. ✅
9. **A10 · activar/apagar (pedido del owner)**: toggle de un toque en la lista de locales + guarda
   "no se puede apagar el único local activo" (simétrica de la del borrado). ✅

### Hallazgos del camino (medidos, no supuestos)

- **El filtro por local nunca filtró**: `src/app/api/admin/orders/route.ts` declaraba `locationId` en
  el zod y no lo leía de `searchParams` (lo introdujo `ad0074d`, T8 fase 7). Medición: 650 órdenes con
  `locationId=loc_que_no_existe` y 650 sin filtro. Ahora hay test de ruta (no existía) y el E2E espera
  a que el refetch termine (antes pasaba por una carrera: la lista se desmonta mientras carga).
- **El alcance y el filtro aplicado no son lo mismo**: la primera versión de la pantalla usaba
  `meta.locationIds` (el filtro aplicado) como si fuera el alcance del usuario, y al elegir una
  sucursal el control desaparecía (se quedaba con una sola opción). Se separó en
  `meta.locationScope` (lo que puede ver) y `meta.locationIds` (lo que pidió), con su test de regresión.
- **El mapper del usuario estaba copiado en cinco lugares** (login, alta, listado, cambio de rol y la
  sesión): ahora es `toAuthenticatedAdminUser` con su test, que además fija que el `passwordHash`
  nunca salga.

## 6. Criterios de aceptación

- Un `kitchen`/`manager` con una sucursal asignada ve **solo** esa; el dueño ve todas.
- Abrir por URL el pedido de otra sucursal, o intentar cambiarle el estado, responde 403 con mensaje
  claro; el listado no lo incluye.
- El filtro por local de la bandeja **filtra de verdad** (test de ruta + E2E que no puede pasar por la
  carrera de carga).
- Un usuario sin asignar sigue viendo todo (no se rompe la operación actual).
- Sin datos del negocio hardcodeados, sin controles decorativos, UI verificada a 375 px y 1280 px.

## 7. Fuera de alcance (anotado, no escondido)

- El alcance de **menú, promos y locales** no cambia: un `manager` sigue editando el catálogo global.
  Si el owner quiere eso por sucursal, es una decisión aparte.
- Los avisos/sonido, las acciones en la fila, el modo cocina y los umbrales de demora son
  `TASK-orders-console.md` (B), que arranca cuando A cierre.
