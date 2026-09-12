# Módulo `menu`

El catálogo: categorías, subcategorías, productos, grupos de modificadores y bloques de marketing
(portada del menú), más la lectura pública que consume la app de pedidos.

```
domain/       menu.types.ts · menu-errors.ts · category-color.ts (color por categoría, con test)
ports/        menu-repository.ts
adapters/     prisma-menu-repository.ts · in-memory-menu-repository.ts
features/
  get-public-menu/        el menú que ve el cliente, con precios ya resueltos para el local
    apply-location-pricing.ts   excepciones de precio por local (T8); sin excepción, precio base
  list-admin-categories/ · list-admin-subcategories/ · list-admin-products/ · get-admin-product/
  create/update/delete de categorías, subcategorías, productos, grupos de modificadores y bloques
  marketing-blocks/validate-marketing-block-input.ts
```

Reglas:

- **La disponibilidad y el precio se resuelven acá**, no en el cliente: `get-public-menu` arma el menú
  por local (`apply-location-pricing`). Si un producto no se vende en ese local, se bloquea y se avisa
  (no se esconde en silencio).
- Los **precios salen de la base**: nunca se hardcodean (lo vigila el contrato anti-hardcode de
  `business-settings`).
- Los productos eliminados se **desactivan**, no se borran: los pedidos históricos los referencian.

Ver `AGENTS.md` (TDD y validación) y `src/modules/orders/README.md` (cómo se usan los precios y los
modificadores al crear un pedido).
