-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'fulfilled', 'declined');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('energy', 'protein', 'fibre', 'mineral', 'additive');

-- CreateEnum
CREATE TYPE "FeedChannel" AS ENUM ('internal', 'external');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "EggMoveType" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "VaccinationStatus" AS ENUM ('done', 'due', 'overdue');

-- CreateEnum
CREATE TYPE "MedicationStatus" AS ENUM ('ongoing', 'completed');

-- CreateEnum
CREATE TYPE "InvCategory" AS ENUM ('medication', 'equipment', 'packaging', 'supplies');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "customerId" INTEGER,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cratePrice" INTEGER NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "weeklyCrates" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egg_orders" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "customerId" INTEGER NOT NULL,
    "crates" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "customerId" INTEGER,
    "name" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" TEXT,
    "price" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "orderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL,
    "reorderKg" INTEGER NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_deliveries" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "kg" INTEGER NOT NULL,
    "pricePerKg" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_products" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bagKg" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "feed_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_runs" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "productId" INTEGER NOT NULL,
    "operator" TEXT NOT NULL,
    "outputKg" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_lines" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "kg" INTEGER NOT NULL,
    "pricePerKg" INTEGER NOT NULL,

    CONSTRAINT "run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_sales" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "productId" INTEGER NOT NULL,
    "channel" "FeedChannel" NOT NULL,
    "buyer" TEXT NOT NULL,
    "bags" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "requestId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_requests" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "division" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "bags" INTEGER NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houses" (
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "houses_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "batches" (
    "code" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "received" DATE NOT NULL,
    "birds" INTEGER NOT NULL,
    "mortality" INTEGER NOT NULL DEFAULT 0,
    "houseCode" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "batches_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "egg_production" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "houseCode" TEXT NOT NULL,
    "eggs" INTEGER NOT NULL,
    "cracked" INTEGER NOT NULL,
    "rejects" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egg_moves" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "type" "EggMoveType" NOT NULL,
    "crates" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egg_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layers_feed_deliveries" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "supplier" TEXT NOT NULL,
    "kg" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "layers_feed_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_use" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "houseCode" TEXT NOT NULL,
    "kg" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_use_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_logs" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "houseCode" TEXT NOT NULL,
    "litres" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccinations" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "itemId" INTEGER NOT NULL,
    "batchCode" TEXT NOT NULL,
    "houseCode" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "qtyUsed" INTEGER NOT NULL,
    "status" "VaccinationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "itemId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "qtyUsed" INTEGER NOT NULL,
    "status" "MedicationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_items" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InvCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "reorder" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,

    CONSTRAINT "inv_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inv_moves" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "itemId" INTEGER NOT NULL,
    "fromLoc" TEXT,
    "toLoc" TEXT,
    "qty" INTEGER NOT NULL,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "egg_orders_customerId_date_idx" ON "egg_orders"("customerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_orderId_key" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "invoices_customerId_status_idx" ON "invoices"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_code_key" ON "ingredients"("code");

-- CreateIndex
CREATE UNIQUE INDEX "feed_products_sku_key" ON "feed_products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "production_runs_code_key" ON "production_runs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "feed_sales_requestId_key" ON "feed_sales"("requestId");

-- CreateIndex
CREATE INDEX "egg_production_date_idx" ON "egg_production"("date");

-- CreateIndex
CREATE UNIQUE INDEX "inv_items_sku_key" ON "inv_items"("sku");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_orders" ADD CONSTRAINT "egg_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "egg_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_deliveries" ADD CONSTRAINT "ingredient_deliveries_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_runs" ADD CONSTRAINT "production_runs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "feed_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_lines" ADD CONSTRAINT "run_lines_runId_fkey" FOREIGN KEY ("runId") REFERENCES "production_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_lines" ADD CONSTRAINT "run_lines_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_sales" ADD CONSTRAINT "feed_sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "feed_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_sales" ADD CONSTRAINT "feed_sales_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "feed_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_requests" ADD CONSTRAINT "feed_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "feed_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_houseCode_fkey" FOREIGN KEY ("houseCode") REFERENCES "houses"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_production" ADD CONSTRAINT "egg_production_houseCode_fkey" FOREIGN KEY ("houseCode") REFERENCES "houses"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_use" ADD CONSTRAINT "feed_use_houseCode_fkey" FOREIGN KEY ("houseCode") REFERENCES "houses"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_houseCode_fkey" FOREIGN KEY ("houseCode") REFERENCES "houses"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inv_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_houseCode_fkey" FOREIGN KEY ("houseCode") REFERENCES "houses"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inv_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_batchCode_fkey" FOREIGN KEY ("batchCode") REFERENCES "batches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inv_moves" ADD CONSTRAINT "inv_moves_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inv_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
