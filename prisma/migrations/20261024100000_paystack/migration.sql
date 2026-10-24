-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'paystack';

-- CreateTable
CREATE TABLE "paystack_charges" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "invoiceId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAmount" INTEGER,
    "channel" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paystack_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paystack_charges_reference_key" ON "paystack_charges"("reference");

-- CreateIndex
CREATE INDEX "paystack_charges_invoiceId_idx" ON "paystack_charges"("invoiceId");

-- AddForeignKey
ALTER TABLE "paystack_charges" ADD CONSTRAINT "paystack_charges_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paystack_charges" ADD CONSTRAINT "paystack_charges_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

