
-- CreateTable
CREATE TABLE "mobile_writes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_writes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobile_writes_createdAt_idx" ON "mobile_writes"("createdAt");

