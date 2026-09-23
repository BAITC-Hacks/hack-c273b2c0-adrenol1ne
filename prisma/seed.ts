import { PrismaClient } from "@prisma/client";
import {
  createSeedEmployees,
  seedEvents,
  seedMissions,
  seedRequirements,
  seedSkills,
} from "../lib/seed-data";
const db = new PrismaClient();
async function main() {
  if (await db.employee.count()) {
    console.log(
      "Database already contains employees; seed preserved existing data.",
    );
    const { ensureLearningPaths } = await import("../lib/learning-service");
    await ensureLearningPaths();
    return;
  }
  await db.$transaction(
    async (tx) => {
      for (const skill of seedSkills) await tx.skill.create({ data: skill });
      for (const requirement of seedRequirements)
        await tx.gradeRequirement.create({ data: requirement });
      for (const { gains, ...event } of seedEvents)
        await tx.event.create({ data: { ...event, gains: { create: gains } } });
      for (const { skills, ...mission } of seedMissions)
        await tx.mission.create({
          data: { ...mission, skills: { create: skills } },
        });
      for (const { skills, history, ...employee } of createSeedEmployees())
        await tx.employee.create({
          data: {
            ...employee,
            skills: { create: skills },
            history: {
              create: history.map((h) => ({
                ...h,
                createdAt: new Date(h.createdAt),
                completedAt: h.completedAt ? new Date(h.completedAt) : null,
              })),
            },
          },
        });
    },
    { timeout: 60000 },
  );
  const { ensureLearningPaths } = await import("../lib/learning-service");
  await ensureLearningPaths();
  console.log(
    "Seeded 48 synthetic employees, 24 skills, 20 activities, 2 missions and six months of history.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
