-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'Engineering',
    "tenureMonths" INTEGER NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetGrade" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "employeeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    PRIMARY KEY ("employeeId", "skillId"),
    CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL,
    "weight" REAL NOT NULL,
    CONSTRAINT "GradeRequirement_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "businessPriority" REAL NOT NULL,
    "minTenureMonths" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "EventSkillGain" (
    "eventId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "gain" INTEGER NOT NULL,
    "maxLevel" INTEGER NOT NULL,

    PRIMARY KEY ("eventId", "skillId"),
    CONSTRAINT "EventSkillGain_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventSkillGain_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "explanation" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recommendation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recommendation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "commitment" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "MissionSkill" (
    "missionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL,

    PRIMARY KEY ("missionId", "skillId"),
    CONSTRAINT "MissionSkill_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_skillCode_key" ON "Skill"("skillCode");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRequirement_role_grade_skillId_key" ON "GradeRequirement"("role", "grade", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_eventCode_key" ON "Event"("eventCode");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityHistory_employeeId_eventId_key" ON "ActivityHistory"("employeeId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_employeeId_eventId_key" ON "Recommendation"("employeeId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_eventId_key" ON "Mission"("eventId");
