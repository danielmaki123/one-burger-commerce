# `src/app/(public)`

La app de pedidos que usa el cliente (`https://menu.oneburgernic.com`, PWA mobile-first). El apex
`oneburgernic.com` y `www.` sirven el **landing** y redirigen (307) las páginas de la app a `menu.`.

```
/                    home con el menú y los destacados
/menu · /menu/[productId]     catálogo y detalle (precios del local elegido)
/cart                carrito
/checkout            alta del pedido: retiro, día/hora programable, pago y propina
/success/[orderId]   confirmación (PIN y datos de retiro)
/activity            historial del cliente (sesión por OTP de WhatsApp)
/orders · /orders/track       seguimiento por token o por número + WhatsApp
```

Reglas:

- El **checkout estima** el total, el descuento y el gate operativo; **el servidor decide** al crear el
  pedido. Si ves una regla duplicada en la página, la fuente de verdad es `src/modules/orders`.
- Los datos del negocio y los precios salen de `/admin/settings` y del local: nada hardcodeado
  (colores, nombre, teléfono, horarios, zona horaria).
- Mobile-first (se verifica a 375 px), controles de `min-h-11`, labels asociados y textos en español.
- Si tocás un `page.tsx`, además correr `npm run build:webpack` (Turbopack no valida ese contrato) y
  los E2E: `BASE_URL=... npm run test:e2e:prod:full`.
