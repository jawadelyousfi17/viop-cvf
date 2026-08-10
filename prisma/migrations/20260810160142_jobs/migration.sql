-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "input" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "lessonId" TEXT,
    "mindmapId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_ownerKey_status_updatedAt_idx" ON "Job"("ownerKey", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Job_userId_status_updatedAt_idx" ON "Job"("userId", "status", "updatedAt");
