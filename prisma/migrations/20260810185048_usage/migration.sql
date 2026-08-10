-- CreateTable
CREATE TABLE "usage" (
    "owner" TEXT NOT NULL,
    "mindmaps" INTEGER NOT NULL DEFAULT 0,
    "lessons" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_pkey" PRIMARY KEY ("owner")
);
