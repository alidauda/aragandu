-- CreateTable
CREATE TABLE "email_log" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "to" TEXT[],
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_log_at_idx" ON "email_log"("at");

-- CreateIndex
CREATE INDEX "email_log_status_at_idx" ON "email_log"("status", "at");

