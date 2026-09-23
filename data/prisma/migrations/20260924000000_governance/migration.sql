CREATE TABLE "ManagerTeam" ("managerId" TEXT NOT NULL, "department" TEXT NOT NULL, PRIMARY KEY ("managerId", "department"));
CREATE TABLE "AuditEvent" ("id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT NOT NULL, "actorRole" TEXT NOT NULL, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" TEXT NOT NULL);
CREATE INDEX "AuditEvent_entityType_entityId_timestamp_idx" ON "AuditEvent"("entityType", "entityId", "timestamp");
CREATE INDEX "AuditEvent_actorId_timestamp_idx" ON "AuditEvent"("actorId", "timestamp");
