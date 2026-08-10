-- CreateTable
CREATE TABLE "Mindmap" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'model',
    "tree" TEXT NOT NULL,
    "nodeCount" INTEGER NOT NULL DEFAULT 1,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mindmap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mindmap_ownerKey_updatedAt_idx" ON "Mindmap"("ownerKey", "updatedAt");

-- CreateIndex
CREATE INDEX "Mindmap_userId_updatedAt_idx" ON "Mindmap"("userId", "updatedAt");
