-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "cashSalesAmount" DECIMAL(10,2),
ADD COLUMN     "expectedByCurrency" JSONB;