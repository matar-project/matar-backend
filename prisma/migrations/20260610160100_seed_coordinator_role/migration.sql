INSERT INTO "Role" ("name", "createdAt", "updatedAt")
VALUES ('coordinator', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
