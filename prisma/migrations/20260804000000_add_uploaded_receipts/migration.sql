CREATE TABLE "UploadedReceipt" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UploadedReceipt_createdById_idx" ON "UploadedReceipt"("createdById");
CREATE INDEX "UploadedReceipt_createdAt_idx" ON "UploadedReceipt"("createdAt");
