-- Non-destructive backfill so an already-seeded (live) database picks up the
-- Canvas Kings insert without a reseed. Runs in its own migration (after the
-- ADD VALUE migration committed) so the new enum value is usable here.
-- On a fresh DB these are no-ops (no players/products yet); seed handles that case.

-- 1) Create the unnumbered Canvas Kings template for every existing player.
INSERT INTO "CardTemplate" ("id", "playerId", "parallel", "printRun", "valueMultiplier", "nextSerial")
SELECT gen_random_uuid()::text, p."id", 'ART_CANVAS_KINGS'::"Parallel", NULL, 18, 0
FROM "Player" p
ON CONFLICT ("playerId", "parallel") DO NOTHING;

-- 2) Add the Canvas Kings pull weight to the live Artistry product (~1:24 packs).
UPDATE "Product"
SET "pullRates" = "pullRates" || '{"ART_CANVAS_KINGS": 76}'::jsonb
WHERE "setKey" = 'artistry'
  AND NOT ("pullRates" ? 'ART_CANVAS_KINGS');
