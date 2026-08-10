-- One worked solution, kept the way a lesson or a map is.
--
-- The solutions already existed as finished `math` rows in "Job"; they were
-- simply never listed, because that table is a queue and a finished job leaves
-- the live feed a minute after it lands. This gives them the same home the
-- other two have.
CREATE TABLE "Solution" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Solution_ownerKey_updatedAt_idx" ON "Solution"("ownerKey", "updatedAt");
CREATE INDEX "Solution_userId_updatedAt_idx" ON "Solution"("userId", "updatedAt");

-- Carry over what already exists.
--
-- The solutions were never lost: every finished `math` job holds the whole
-- document, so this is a move rather than a regeneration. Rows whose result is
-- not obviously JSON are skipped rather than cast — a migration that fails on
-- one bad row leaves the table half made and the deploy stuck.
INSERT INTO "Solution" ("id", "ownerKey", "userId", "title", "topic", "content", "stepCount", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    j."ownerKey",
    j."userId",
    COALESCE(NULLIF(left(j.result::jsonb -> 'solution' ->> 'title', 120), ''), 'A problem'),
    COALESCE(left(j.input::jsonb ->> 'question', 400), ''),
    (j.result::jsonb -> 'solution')::text,
    COALESCE(jsonb_array_length(j.result::jsonb -> 'solution' -> 'steps'), 0),
    j."createdAt",
    j."updatedAt"
FROM "Job" j
WHERE j.kind = 'math'
  AND j.status = 'done'
  AND j.result IS NOT NULL
  AND j.result ~ '^\s*\{'
  AND j.input ~ '^\s*\{'
  AND jsonb_typeof(j.result::jsonb -> 'solution' -> 'steps') = 'array';
