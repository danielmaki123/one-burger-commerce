# `src/app/(admin)`

El **panel** (`https://admin.oneburgernic.com`). Next solo renderiza; los datos se piden a `/api/admin/**`
y la autorización se valida en el servidor con `src/modules/auth` (`require-admin-session` +
`admin-permissions`).

```
/admin/login                 único acceso público del grupo
/admin                       overview del día
/admin/orders · [id]         bandeja y detalle (estados, PIN, hora de retiro programada)
/admin/menu/**               categorías, subcategorías, productos, modificadores, bloques de portada
/admin/promotions            promociones y cupones
/admin/locations · [id]      locales (T8): horarios, contacto y precios por local
/admin/settings              personalización del negocio (marca, contacto, horarios, propina)
/admin/users                 usuarios y roles (owner/manager/kitchen)
/admin/dashboard             métricas
```

Fuera del MVP, **accesibles solo por URL directa** y sin entrar en la navegación: `/admin/inventory/**`,
`/admin/reservations/**`, `/admin/tables`, `/admin/delivery-zones/**`. No reactivarlos sin pedido
explícito (`AGENTS.md` → Prohibiciones).

Reglas al tocar una página:

- Si una página (`page.tsx`) cambia, correr también `npm run build:webpack`: con Turbopack el error de
  export inválido queda escondido. Los helpers y componentes van en archivos aparte (así nació
  `orders-page-helpers.ts`).
- Los datos del negocio (`/admin/settings` y los locales) son la **fuente de verdad**: colores,
  contacto, horarios y precios no se hardcodean (lo vigila el contrato anti-hardcode de `business-settings`).
- UI mobile-first con los tokens semánticos de `globals.css` y textos en español.
