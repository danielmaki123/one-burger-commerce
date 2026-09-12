# `coupons` (carpeta reservada, sin código)

Esta carpeta está **vacía a propósito**: hoy no hay un módulo `coupons`.

Los cupones y las promociones viven en `src/modules/orders/`:

- `domain/coupon-eligibility.ts` — si un cupón aplica a un pedido (alcance, mínimo, usos, vigencia).
- `domain/promo-bogo.ts` · `domain/promotion-rules.ts` — promos 2x1, porcentaje y monto fijo.
- `features/validate-coupon/` — la validación que usa el checkout para estimar el descuento.
- `features/{create,update,delete,list}-promotions/` — el ABM de promociones del admin.

El modelo `Coupon`/`Promotion` de Prisma también se administra desde ahí. **El servidor decide** el
descuento real al crear el pedido; el checkout solo lo estima (`POST /api/coupons/validate`).

Si algún día los cupones crecen al punto de justificar su propio módulo, se mueven con task asignada:
no crear estructura vacía por las dudas.
