import { repositories } from "@backend/repositories";
export async function catalog() {
  const [skills, events, requirements, missions] = await Promise.all([
    repositories.skills.list(),
    repositories.activities.list(),
    repositories.career.requirements(),
    repositories.activities.missions(),
  ]);
  return { skills, events, requirements, missions };
}
