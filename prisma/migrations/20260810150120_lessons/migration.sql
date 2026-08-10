-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "scenes" TEXT NOT NULL,
    "sceneCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lesson_ownerKey_updatedAt_idx" ON "Lesson"("ownerKey", "updatedAt");

-- CreateIndex
CREATE INDEX "Lesson_userId_updatedAt_idx" ON "Lesson"("userId", "updatedAt");
