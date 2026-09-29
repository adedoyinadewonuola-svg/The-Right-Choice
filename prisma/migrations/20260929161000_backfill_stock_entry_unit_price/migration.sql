-- Freeze the price on days recorded before unitPrice existed, using the product prices in
-- force at upgrade time. Rows whose product has no price stay NULL and keep following the
-- price list (see resolvedUnitPrice in src/lib/stock.ts).
UPDATE "StockEntry" s
SET    "unitPrice" = p."price"
FROM   "Product" p
WHERE  p."id" = s."productId"
  AND  p."price" IS NOT NULL
  AND  s."unitPrice" IS NULL;
