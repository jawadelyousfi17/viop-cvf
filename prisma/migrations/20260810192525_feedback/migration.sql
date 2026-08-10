-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "rating" INTEGER NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "from" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_createdAt_idx" ON "feedback"("createdAt");
