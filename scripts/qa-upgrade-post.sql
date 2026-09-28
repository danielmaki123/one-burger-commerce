-- Verificación de la ruta de upgrade: los hechos legacy quedan intactos y la configuración se siembra.
--
-- Es el espejo de lo que D-020 y el § Legacy del brief prometen, y se corre **después** de aplicar las
-- nueve migraciones nuevas sobre una base que ya tenía datos con forma de producción.

\echo '=== 1. Los hechos legacy NO se tocan (montos, monedas y marcas intactos) ==='
SELECT id, method::text, amount, currency, "baseCurrencyCode", "exchangeRate", "baseAmount", "idempotencyKey"
FROM "Payment" ORDER BY id;

\echo '=== 2. Un cobro legacy en dólares queda SIN snapshot: no demostrable, no convertido ==='
SELECT id, currency, "baseAmount" IS NULL AS sin_equivalente FROM "Payment" WHERE id = 'pay_legacy_usd';

\echo '=== 3. El `mixed` histórico se conserva y su `methodKind` queda nulo (no se reescribe) ==='
SELECT id, method::text, "methodKind"::text FROM "Payment" WHERE method = 'mixed';

\echo '=== 4. La devolución legacy conserva su monto y su moneda, sin tasa ni equivalente ==='
SELECT id, amount, currency, status::text, "baseAmount", "idempotencyKey" FROM "Refund";

\echo '=== 5. La factura ya emitida sigue igual: no se re-emite ni se anula ==='
SELECT id, number, status::text, total, "currencyCode" FROM "Invoice";

\echo '=== 6. El banco existente queda en `other` EXPLÍCITO (el tipo no se infiere del nombre) ==='
SELECT id, name, code, "entityType"::text FROM "Bank";

\echo '=== 7. El cierre existente conserva sus montos y queda SIN la tasa (no se re-firma) ==='
SELECT id, status::text, "expectedAmount", "exchangeRate" FROM "Shift";

\echo '=== 8. La configuración se siembra: moneda base copiada de BusinessSettings, sin tocar hechos ==='
SELECT "baseCurrencyCode", locale FROM "BusinessCurrencySettings";

\echo '=== 9. El catálogo de monedas: la que el negocio ya usaba, y el dólar porque tenía tasa ==='
SELECT code, name, symbol, decimals, "isKnown", "isActive" FROM "Currency" ORDER BY "sortOrder";

\echo '=== 10. La tasa vigente pasó a ser el PRIMER HECHO del historial, con fecha declarada ==='
SELECT "fromCurrencyCode", "toCurrencyCode", rate, "effectiveFrom" IS NOT NULL AS con_fecha, "effectiveTo" IS NULL AS vigente
FROM "ExchangeRate";

\echo '=== 11. Los medios de pago que el negocio ya usaba ==='
SELECT name, kind::text, "isActive" FROM "PaymentMethodConfig" ORDER BY "sortOrder";

\echo '=== 12. Ninguna columna nueva quedó con un default inventado en los hechos ==='
SELECT
  (SELECT count(*) FROM "Payment" WHERE "baseAmount" IS NOT NULL) AS cobros_con_equivalente_inventado,
  (SELECT count(*) FROM "Refund" WHERE "baseAmount" IS NOT NULL) AS devoluciones_con_equivalente_inventado,
  (SELECT count(*) FROM "Shift" WHERE "exchangeRate" IS NOT NULL) AS cierres_con_tasa_inventada;
