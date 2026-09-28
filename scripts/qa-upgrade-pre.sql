-- Datos con forma de producción sobre el esquema VIEJO (8f535d5), para probar la ruta de upgrade.
--
-- No es un seed de demo: reproduce los casos que D-020 y el § Legacy del brief declaran —
-- un cobro legacy EN DÓLARES sin snapshot, un `mixed` histórico, una devolución sin tasa, una factura ya
-- emitida y un banco sin tipo de entidad— y se corre **antes** de aplicar las nueve migraciones nuevas.

UPDATE "BusinessSettings"
SET "name" = 'One Burger',
    "currencyCode" = 'NIO',
    "currencySymbol" = 'C$',
    "locale" = 'es-NI',
    "usdExchangeRate" = 36.5
WHERE "id" = 'default';

INSERT INTO "Location" ("id", "name", "slug", "businessHours", "updatedAt")
VALUES ('loc_1', 'Camino de Oriente', 'camino', '[]', CURRENT_TIMESTAMP);

INSERT INTO "AdminUser" ("id", "name", "email", "passwordHash", "role", "updatedAt")
VALUES ('u1', 'Owner', 'o@x.test', 'h', 'owner', CURRENT_TIMESTAMP);

INSERT INTO "Shift" ("id", "locationId", "userId", "status", "openedAt", "openingAmount", "updatedAt")
VALUES ('sh_1', 'loc_1', 'u1', 'closed', CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP);

INSERT INTO "Order" ("id", "orderNumber", "type", "status", "customerName", "customerWhatsapp", "locationId", "subtotal", "total", "updatedAt")
VALUES ('ord_1', 'P-OLD-1', 'pickup', 'picked_up', 'Cliente viejo', '+50588887777', 'loc_1', 365, 365, CURRENT_TIMESTAMP);

-- El caso central de D-020: un cobro legacy en dólares, sin tasa ni equivalente.
INSERT INTO "Payment" ("id", "orderId", "method", "amount", "currency", "tip", "changeAmount", "shiftId", "createdAt")
VALUES ('pay_legacy_usd', 'ord_1', 'cash', 10, 'USD', 0, 0, 'sh_1', CURRENT_TIMESTAMP);

-- El `mixed` histórico: se conserva y NO cuenta como medio (D-017).
INSERT INTO "Payment" ("id", "orderId", "method", "amount", "currency", "tip", "changeAmount", "shiftId", "createdAt")
VALUES ('pay_legacy_mixed', 'ord_1', 'mixed', 100, 'NIO', 0, 0, 'sh_1', CURRENT_TIMESTAMP);

-- Una devolución legacy: sin tasa, sin equivalente, sin clave.
INSERT INTO "Refund" ("id", "paymentId", "orderId", "shiftId", "kind", "method", "amount", "currency", "reason", "status", "createdAt")
VALUES ('ref_legacy', 'pay_legacy_mixed', 'ord_1', 'sh_1', 'partial', 'cash', 20, 'NIO', 'Motivo viejo', 'approved', CURRENT_TIMESTAMP);

-- Una factura ya emitida bajo la regla vieja: no se re-emite ni se anula.
INSERT INTO "Invoice" ("id", "number", "orderId", "status", "customerName", "businessName", "currencyCode", "subtotal", "discount", "packagingAmount", "deliveryFeeAmount", "tipAmount", "total", "issuedAt")
VALUES ('inv_1', 'F-000001', 'ord_1', 'emitted', 'Cliente viejo', 'One Burger', 'NIO', 365, 0, 0, 0, 0, 365, CURRENT_TIMESTAMP);

-- Un banco cargado sin tipo de entidad (la columna todavía no existe).
INSERT INTO "Bank" ("id", "name", "code", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES ('bank_bac', 'BAC Credomatic', 'BAC', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "LocationCashConfig" ("id", "locationId", "usdEnabled", "blindCount", "updatedAt")
VALUES ('cc_1', 'loc_1', true, true, CURRENT_TIMESTAMP);

-- Las denominaciones ya vienen sembradas por la migración de cash-config: no se reinsertan.
SELECT count(*) AS denominaciones FROM "CashDenomination";
