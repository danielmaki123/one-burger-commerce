# SKILL: security-change — autenticación, autorización y datos sensibles

**Se activa** cuando una TASK toca login, logout, sesiones, cookies, roles o permisos, rate limiting,
secrets, endpoints internos/de staging, datos personales o fiscales del cliente, CSP, o cualquier
decisión de «quién puede ver/hacer esto».

> **Regla que manda: OCULTAR ALGO EN REACT NO EQUIVALE A AUTORIZACIÓN.**
> Esconder un botón, una ruta o un número en la UI **no** protege nada: la misma request se puede
> hacer con `curl`. La frontera es el **servidor**.

---

## 1. Procedimiento

### 1.1 Threat model básico (antes de codear)

Contestar en tres líneas:

1. **¿Qué se protege?** (plata del cajón, datos del cliente, capacidad de administrar, secretos).
2. **¿De quién?** (anónimo en internet, cliente autenticado, staff de otro rol, staff de otra
   sucursal, alguien con la sesión robada).
3. **¿Cuál es el peor caso si falla?** Si la respuesta es «no pasa nada», probablemente la TASK no es
   de seguridad y esta skill no aplica.

### 1.2 Principio de mínimo privilegio

- Cada operación tiene su **puerta propia**, aunque hoy coincida con otra. Las puertas viven en
  `src/modules/auth/domain/admin-permissions.ts` (`canUsePOS`, `canManageCash`, `canRefund`,
  `canApproveRefund`, `canManageCashConfig`, `canPrintCashDocuments`, `canDiscountPosSale`, …).
  Reutilizar una puerta «porque da lo mismo» mezcla dos decisiones y después no se pueden separar.
- Roles reales: `owner`, `manager`, `kitchen`, `cashier`. `kitchen` no maneja plata; `cashier` cobra y
  cierra pero **no** administra caja, **no** devuelve, **no** descuenta a mano y **no** ve el esperado
  del arqueo.
- El **alcance por sucursal** del staff sale de `AdminUserLocation`: fuera de alcance es 403. Sin
  asignación ve todas; `owner` ve todas.
- Nadie aprueba su propia devolución.

### 1.3 Server-side enforcement

La cadena obligatoria de una ruta:

```
HTTP → validación (zod) → auth/authz (sesión + puerta de dominio) → caso de uso → adaptador
```

- La sesión se resuelve con `getAdminSession` / `requireAdminSession`; la cookie es
  `ob_admin_session` (`src/modules/auth/domain/session-cookie.ts`).
- La autorización se aplica **en la ruta y en el caso de uso**, no en el componente.
- Un dato sensible se filtra **en la respuesta del servidor** (como el arqueo ciego del `cashier`), no
  se manda y se esconde en el cliente.

### 1.4 Respuestas correctas

| Situación | Respuesta |
|---|---|
| Sin sesión | **401** (o redirección al login en una página) |
| Con sesión pero sin permiso | **403** |
| Recurso fuera del alcance del usuario | **403**; **404** solo si además no debe poder deducir que existe |
| Endpoint que no corresponde a este entorno | **403** (fail-closed) |

No se devuelve el detalle interno del error ni un stack. Los mensajes de error son claros **para el
usuario** y opacos **para el atacante**.

### 1.5 Endpoints internos y de staging

El patrón del repo (`src/app/api/internal/staging/**`) es **fail-closed**:

- Primer gate: `process.env.APP_ENV !== "staging"` → **403**. Si el entorno no es el correcto, no
  corre.
- Segundo gate: token dedicado, comparado con `timingSafeEqual` (nunca `===` sobre un secreto).
- Los interruptores de desarrollo (`CUSTOMER_OTP_DEV_LOG`, `CUSTOMER_OTP_STAGING_SMOKE_MODE`) escriben
  códigos OTP en claro: con `NODE_ENV=production` el arranque **aborta**. No se relajan.

### 1.6 Sesiones y cookies

- `secure` cuando `NODE_ENV=production`; `httpOnly`; `sameSite` acorde al flujo.
- El logout **borra** la cookie y la sesión del servidor.
- Un pedido público se identifica por su **token**, no por un id adivinable.

### 1.7 Rate limiting

- El limitador vive en `src/shared/lib/rate-limit/` y es **en memoria** (una réplica): es una
  limitación conocida y aceptada, no una defensa fuerte (ver
  [`../../../ops/production-readiness.md`](../../../ops/production-readiness.md) §7).
- Límites por IP: login del panel y alta pública de pedidos. Al agregar uno nuevo, pensar en el caso
  real: el staff comparte una IP pública durante un cambio de turno.
- Un 429 tiene que **decir qué pasó** con su propio mensaje, no un error genérico.

### 1.8 Secrets

- **Solo por entorno.** Nunca en el repo, un commit, un documento, un log ni un chat.
- `npm run security:secrets` corre en local y en el job `verify` del CI.
- Al inspeccionar el panel de producción, `inspectService` devuelve los secretos **en claro**: se usa
  un `grep` acotado, nunca se vuelca la respuesta entera.
- Nada de `BOOTSTRAP_ADMIN_*` ni secretos temporales dejados en el entorno del servicio.

### 1.9 Datos sensibles

- El `payload` del outbox lleva PII del cliente (nombre, teléfono, dirección): el acceso a los eventos
  está restringido a `owner`.
- Los datos fiscales **del cliente** (`taxId`, `legalName`) se congelan en la factura. La factura en sí
  es una **factura simple, no fiscal**: que el documento lleve datos fiscales del cliente no la vuelve
  un comprobante fiscal.
- No imprimir datos sensibles en logs. No loguear tokens ni códigos OTP.

---

## 2. Pruebas negativas (obligatorias)

Un cambio de seguridad **no** se cierra con el camino feliz. Como mínimo:

- **Sin sesión** → 401.
- **Con el rol equivocado** → 403 (p. ej. `kitchen` contra una ruta de caja; `cashier` contra el
  esperado del arqueo; `manager` contra la configuración de caja).
- **Fuera del alcance de sucursal** → 403.
- **Token inválido o ausente** en un endpoint interno → 403/401.
- **Dato sensible ausente en la respuesta** del rol que no debe verlo (no basta con que la UI lo
  esconda): se afirma sobre el **cuerpo de la respuesta**.
- **Toggle de dev apagado** en producción → el arranque falla o el endpoint responde 403.

Los tests de ruta mockean la sesión, pero el **filtro del dato sensible** tiene que estar cubierto
donde vive: hay un ejemplo en `src/app/api/admin/pos/shift/shift-arqueo-role-filter.test.ts`.

---

## 3. Prohibiciones

- Autorizar en el cliente o «proteger» escondiendo en React.
- Devolver el dato sensible y ocultarlo en la UI.
- Comparar secretos con `===`.
- Endpoint interno que corre en cualquier entorno, o que confía en que «nadie conoce la URL».
- Log de tokens, contraseñas, OTP o PII.
- Bajar un rate limit o quitar un gate «para que pase el test».
- Agregar un rol nuevo sin actualizar `ADMIN_ROLES`, `admin-permissions.ts` y sus tests.
- Tocar secrets o el ruleset sin pedido explícito del owner.

---

## 4. Cierre

- [ ] Threat model en tres líneas.
- [ ] Puerta de dominio propia para la operación (no una reutilizada por conveniencia).
- [ ] Enforcement en el servidor; el cliente solo refleja.
- [ ] Respuestas 401/403/404 según el caso, sin filtrar detalle interno.
- [ ] Pruebas negativas escritas y en verde.
- [ ] Dato sensible verificado **en el cuerpo de la respuesta**, no en la UI.
- [ ] `npm run security:secrets` en verde.
- [ ] `MEMORY.md` si la lección es reutilizable.
