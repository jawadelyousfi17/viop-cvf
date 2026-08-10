-- Counts what every account has already made.
--
-- The tally table arrived after people had been using the app, so their maps
-- and lessons were never counted: the tally read zero while five maps sat
-- there, and `allowance` falls back to counting live rows precisely so that
-- nobody's existing work goes unnoticed. But live rows disappear when you
-- delete them, which is the hole this closes — delete all five and the fallback
-- honestly reports none, and the allowance comes back.
--
-- Seeding the tally from what exists now means the fallback never has to
-- answer for an old account again.
--
-- GREATEST, not overwrite: a row already counted by the app is ahead of the
-- live count by exactly the things that have been deleted since, and that is
-- the number worth keeping.
INSERT INTO "usage" ("owner", "mindmaps", "lessons", "createdAt", "updatedAt")
SELECT owner, SUM(maps)::int, SUM(lessons)::int, now(), now()
FROM (
  SELECT COALESCE("userId", "ownerKey") AS owner, COUNT(*) AS maps, 0 AS lessons
  FROM "Mindmap" GROUP BY 1
  UNION ALL
  SELECT COALESCE("userId", "ownerKey") AS owner, 0 AS maps, COUNT(*) AS lessons
  FROM "Lesson" GROUP BY 1
) counted
GROUP BY owner
ON CONFLICT ("owner") DO UPDATE SET
  "mindmaps" = GREATEST("usage"."mindmaps", EXCLUDED."mindmaps"),
  "lessons"  = GREATEST("usage"."lessons",  EXCLUDED."lessons"),
  "updatedAt" = now();
