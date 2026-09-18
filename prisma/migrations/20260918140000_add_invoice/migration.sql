-- Factura simple (2026-09-18) — el documento que el cliente se lleva.
--
-- Aditiva: tabla nueva (Invoice + InvoiceStatus), la razon social y el RUC del negocio en
-- BusinessSettings y los datos fiscales del cliente en Customer. **No es una factura fiscal**:
-- no hay autorizacion de la DGI ni rango oficial de numeracion.

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('emitted', 'voided');

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "taxId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "taxId" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'emitted',
    "customerName" TEXT NOT NULL,
    "customerLegalName" TEXT,
    "customerTaxId" TEXT,
    "businessName" TEXT NOT NULL,
    "businessLegalName" TEXT,
    "businessTaxId" TEXT,
    "businessAddress" TEXT,
    "businessPhone" TEXT,
    "currencyCode" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "packagingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deliveryFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByUserId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
