-- DropForeignKey
ALTER TABLE "StockEntry" DROP CONSTRAINT "StockEntry_productId_fkey";

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
