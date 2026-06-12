ALTER TABLE "LibraryItem" ADD COLUMN "sourceRequestId" INTEGER;

CREATE UNIQUE INDEX "LibraryItem_sourceRequestId_key"
ON "LibraryItem"("sourceRequestId");

ALTER TABLE "LibraryItem"
ADD CONSTRAINT "LibraryItem_sourceRequestId_fkey"
FOREIGN KEY ("sourceRequestId") REFERENCES "Request"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "LibraryItem" (
  "title",
  "description",
  "country",
  "itemType",
  "fileUrl",
  "fileName",
  "fileSize",
  "published",
  "sourceRequestId",
  "createdAt",
  "updatedAt"
)
SELECT
  COALESCE(r."bookName", r."title", 'كتاب محوّل'),
  r."details",
  r."country",
  'WORD_DOC'::"LibraryItemType",
  '/api/library/request/' || r."id" || '/download',
  r."outputOriginalName",
  r."outputFileSize",
  TRUE,
  r."id",
  NOW(),
  NOW()
FROM "Request" r
WHERE r."status" = 'DONE'::"RequestStatus"
  AND r."requestType" = 'PDF_TO_WORD'::"RequestType"
  AND r."outputStoredName" IS NOT NULL
  AND r."outputOriginalName" IS NOT NULL
ON CONFLICT ("sourceRequestId") DO NOTHING;
