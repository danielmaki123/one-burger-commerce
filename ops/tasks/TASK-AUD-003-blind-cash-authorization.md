# TASK-AUD-003 — Blind Cash Authorization

## TASK ID

`TASK-AUD-003`

## Título

Verificar y cerrar el arqueo ciego: que un `cashier` no pueda **determinar** el esperado por ninguna vía.

## Prioridad

`P1` — dinero / fuga de dato. Primera TASK del bloque financiero.

## Clase de riesgo

`dinero` + `auth/datos`. **No toca el significado del dinero**: aplica una decisión ya tomada por el owner.

---

## PROBLEMA

A-45 (2026-09-23) cerró la mitad del arqueo ciego: el `cashier` dejó de recibir `expectedAmount`,
`expectedByCurrency` y la diferencia. La TASK entró como **auditoría de seguridad** para verificar que no
quedara ningún camino. **Quedaban dos, y las dos son reales.**

El esperado es una suma de campos que viajaban en la misma respuesta:

```
esperado = fondo + efectivo del turno + movimientos + devoluciones
```

1. **Los sumandos viajaban al cajero.** `filterArqueoForRole` escondía el total y la diferencia, pero
   `openingAmount`, `cashSalesAmount`, `cashMovementsAmount`, `refundsAmount` y `paymentMix` (que trae el
   efectivo adentro) seguían en la respuesta del corte X y del cierre. Esconder el total y mandar las partes
   deja el ciego a **una resta** de distancia. La propia pantalla dibujaba las cuatro filas juntas.
2. **El traspaso de caja no se filtraba.** `GET`/`POST /api/admin/pos/shift/handover` devolvían el registro
   completo —con `expectedAmount` y `expectedByCurrency`— y su puerta es **la del mostrador**
   (`requirePosScope`), así que el cajero leía el esperado sin pasar por el corte X.

## EVIDENCIA

- **Superficies auditadas** (todas las que un `cashier` alcanza con `canUsePOS`):
  `GET /api/admin/pos/shift` (turno abierto: el esperado todavía no existe, `null`), `GET .../shift/x`
  (corte X), `POST .../shift/close` (cierre), `POST .../shift/open`, y `GET`/`POST .../shift/handover`
  (traspaso). Las superficies de consulta —`/api/admin/cash/**`, `/api/admin/history/**`,
  `/api/admin/dashboard/**`— están detrás de `canManageCash` / `canViewCashHistory` / `canViewActivityFeed`
  (owner y manager): el cajero recibe **403**, verificado en `admin-permissions.ts`.
- **El filtro, antes**: `expectedAmount`, `expectedByCurrency`, `difference`, `bankChargedByCurrency`,
  `bankDifferenceByCurrency`, `bankDifferenceAmount`.
- **La fuga, medida**: `close-shift.ts` devuelve el arqueo con `expectedAmount = openingAmount +
  cashSalesAmount + cashMovementsAmount + refundsAmount` (líneas 444-482) y el payload de la ruta agrega
  `openingAmount` (`preview-shift-arqueo.ts:74`). Con la respuesta en la mano, la suma da **1300 exacto**
  (test `shift-blind-count.test.ts`, «no se puede reconstruir por aritmética»).
- **La fuga del traspaso**: `ShiftHandover` persiste `expectedAmount`/`expectedByCurrency`
  (`prisma-shift-handover-repository.ts:27-28`) y la ruta los devolvía sin filtro.
- **La fuga en la UI**: `cash-partial-reading-modal.tsx` dibujaba Fondo / Efectivo del turno / Movimientos /
  Devoluciones **sin** la guarda del ciego (el bloque del esperado sí la tenía), y `shift-handovers-list.tsx`
  dibujaba el monto del traspaso siempre.

## CAUSA RAÍZ

El arqueo ciego se implementó como una **lista de lo que no viaja** (denylist) pensada para el **total**, no
para el **cálculo**. El total y sus sumandos son la misma información: mientras no se declare explícitamente
cuál es la frontera —«nada que permita leer o reconstruir el esperado»—, cada campo nuevo que participe del
cálculo vuelve a abrir la fuga. Y la regla se aplicó ruta por ruta, así que el traspaso —que firma con el
arqueo completo— quedó afuera.

## INVARIANTE

> **Un `cashier` no puede leer ni reconstruir el esperado del arqueo por ninguna superficie.** No recibe el
> total, ni la diferencia, ni los sumandos, ni el desglose por medio de pago, ni el monto del traspaso.
> Manager y Owner —que auditan la caja— siguen viendo el arqueo completo.

## BOUNDED CONTEXT

`orders` (arqueo y traspaso) · `cash-config` (arqueo ciego) · `auth` (roles). Las superficies HTTP viven en
`src/app/api/admin/pos/**` y la pantalla en `src/app/(admin)/admin/cash/**`.

---

## SCOPE IN

1. `shift-arqueo-role-filter.ts`: la frontera pasa a incluir **todo lo que determina el esperado**
   (sumandos, desglose por medio, tips y lo cobrado fuera del cajón).
2. `handover-composition.ts` + `handover/route.ts`: el traspaso se filtra por rol, igual que el corte X y el
   cierre. El **asiento de auditoría sigue guardando el esperado completo** (es del servidor y solo lo lee el
   dueño).
3. `cash-partial-reading-modal.tsx`: en modo ciego no se dibujan las filas de los sumandos.
4. `shift-handovers-list.tsx`: un traspaso sin monto (el caso del cajero) se dibuja sin número y sin `NaN`.

## SCOPE OUT

- **No** se toca el significado del dinero ni la fórmula del arqueo.
- **No** se cambia quién puede operar el POS (`canUsePOS` queda igual).
- **No** se toca producción, la base ni el ruleset.
- **No** se agrega una puerta nueva de permisos: la decisión del owner («quien cobra no ve el esperado») ya
  existía; lo que faltaba era aplicarla a todo lo que lo determina.
- **No** se toca el `cashier`-no-filtrado de roles desconocidos (política ya documentada): el enum
  `AdminRole` es cerrado y `isAdminRole` lo valida, así que hoy es inalcanzable.

## DEPENDENCIAS

Ninguna. `A-45` (cerrado) es el antecedente.

## ARCHIVOS PROBABLES

`src/app/api/admin/pos/shift/shift-arqueo-role-filter.ts` (+ su test) ·
`src/app/api/admin/pos/shift/shift-blind-count.test.ts` (nuevo barrido) ·
`src/app/api/admin/pos/shift/handover/{route,handover-composition}.ts` (+ test) ·
`src/app/(admin)/admin/cash/cash-partial-reading-modal.tsx` (+ test) ·
`src/app/(admin)/admin/cash/shift-handovers-list.tsx` (+ test) · `ops/CURRENT.md` · `ops/audit-backlog.md`.

---

## TEST ROJO

`shift-blind-count.test.ts` (nuevo, 8 tests) con el filtro viejo: **4 en rojo** — las dos superficies con
campos que determinan el esperado, la reconstrucción por aritmética y el filtrado en profundidad. Y en la UI,
`cash-partial-reading-modal.test.tsx`: **1 en rojo** (el cajero seguía viendo los sumandos).

## ESTRATEGIA

Declarar la frontera en un solo lugar (`HIDDEN_FROM_BLIND_COUNT`), aplicarla en la **respuesta** de todas las
rutas que un cajero alcanza, y hacer que las pantallas **no dibujen** lo que el servidor ya no manda. El
barrido de la invariante vive aparte (`shift-blind-count.test.ts`) para que agregar un campo al arqueo obligue
a decidir si entra o no en la frontera.

## RIESGOS DE FALSO POSITIVO

| Riesgo | Mitigación |
|---|---|
| Ocultar de más y dejar al cajero sin lo que necesita | hay tests que exigen que conserve identidad del turno, fondo, `closingAmount` y lo que declaró en los bancos |
| Romper la pantalla con campos ausentes | la UI se actualiza en el mismo commit y los tipos pasan a opcionales donde el servidor ya no garantiza el campo |
| Romper el aviso al dueño o el asiento de auditoría | el filtro se aplica sólo en la respuesta HTTP; hay un test de «no muta la respuesta original» |
| Afectar a Manager/Owner | test explícito: el payload completo se devuelve igual |

## TRANSACCIÓN / CONCURRENCIA / IDEMPOTENCIA / MIGRACIÓN

**N/A** — es autorización de lectura sobre una respuesta ya calculada. No hay escritura nueva, ni transacción,
ni carrera, ni esquema.

## OBSERVABILIDAD

Ninguna nueva: el asiento de auditoría del traspaso sigue registrando el esperado completo del lado del
servidor (solo lo lee el dueño por el feed de actividad).

---

## TESTS UNITARIOS

- `shift-blind-count.test.ts` (nuevo, 8): ningún campo determinante en corte X ni en cierre; la aritmética no
  reconstruye (y el control de que con el payload completo **sí** da 1300); el cajero conserva lo suyo;
  Manager/Owner sin cambios; filtrado en profundidad; no muta el original.
- `shift-arqueo-role-filter.test.ts`: **cambió el contrato** — dos aserciones que afirmaban que al cajero le
  llegaban `cashSalesAmount` y `paymentMix` se invirtieron, con el motivo escrito en el archivo. No es «cambiar
  el test para conseguir verde»: es el contrato que el owner pidió cerrar (§ *Regla de evidencia* del brief).
- `handover/route.test.ts`: el rol viaja a la composición (es lo que aplica el filtro) y el alta conserva sus
  argumentos.
- UI: `cash-partial-reading-modal.test.tsx` (el ciego no dibuja sumandos; quien audita sí) y
  `shift-handovers-list.test.tsx` (sin monto → sin `NaN`).

## TESTS DE INTEGRACIÓN

**N/A** — la propiedad es de forma de la respuesta, no de la base. Los tests de ruta cubren la composición.

## E2E

No se agrega: el flujo del cajero en producción necesita una caja abierta y credenciales. Queda cubierto por
los tests de ruta y de componente, y por el E2E existente de caja (que no se toca).

## MUTATION CHECK

Quitar `cashSalesAmount` de la frontera → **3 tests en rojo**; restaurado, 8/8. La mutación **no** se
commiteó. (Es además la misma condición que produjo el RED original.)

## ADVERSARIAL REVIEW

- **¿El test seguiría verde si vuelvo a meter el bug?** No: el barrido enumera los campos determinantes y
  reconstruye el esperado por aritmética; el mutation check lo demuestra.
- **¿El test usa la misma función para el `expected`?** No: el `expected` de la reconstrucción se calcula a
  mano en el test (1300) y la suma la hace el propio test, no el helper de producción.
- **¿El mock oculta el problema?** El barrido llama al filtro real; los tests de ruta usan la composición
  mockeada **sólo** para verificar que el rol se propaga, y el filtro tiene su propio test.
- **¿Una API alternativa filtra el dato?** Se auditaron las cinco rutas del mostrador y las de consulta; las
  de consulta están detrás de permisos de auditoría (403 para el cajero).
- **¿Queda autorización sólo en React?** No: la frontera es del servidor; la UI acompaña.
- **¿Se modificó un test existente sólo para obtener verde?** Sí se modificaron dos aserciones, y está dicho
  arriba: el contrato cambió por instrucción explícita del owner.
- **¿Aumentó una allowlist o un techo?** No: ni el inventario de AUD-001 ni `design-tokens.allow.json` se
  tocaron. El `route.ts` del traspaso quedó en **50 líneas** (el tope) recortando su comentario, no agregando
  una excepción.

## VALIDACIÓN

`npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build`

## CRITERIOS DE ACEPTACIÓN

- [ ] Ningún campo que determine el esperado llega a un `cashier` por corte X, cierre ni traspaso.
- [ ] Manager y Owner siguen viendo el arqueo completo.
- [ ] El asiento de auditoría del traspaso conserva el esperado.
- [ ] Las pantallas no dibujan lo que el servidor no manda.
- [ ] Validación completa en verde y CI del PR verde.

## REGRESIÓN

`shift-blind-count.test.ts` es la regresión: si alguien vuelve a mandar un sumando al cajero, se pone rojo
(probado por mutación).

## ROLLBACK

Revertir el commit: es un cambio de forma de respuesta y de dos pantallas, sin estado ni migración.

## DOCUMENTACIÓN

`ops/audit-backlog.md` (A-45 gana la corrección de AUD-003 con su evidencia) y `ops/CURRENT.md`.

## MEMORY

Lección candidata: «esconder un total y mandar sus sumandos no esconde nada: una regla de confidencialidad se
define por lo que permite **calcular**, no por el nombre del campo que se omite».

## DEFINITION OF DONE

- [ ] Evidencia reproducida y registrada (incluida la reconstrucción aritmética).
- [ ] RED observado, GREEN, mutation check y review adversarial sin blockers.
- [ ] Validación completa y CI verde; PR mergeado con squash; `main` verde.
- [ ] Sin deploy, sin migración, sin cambio de producto.
