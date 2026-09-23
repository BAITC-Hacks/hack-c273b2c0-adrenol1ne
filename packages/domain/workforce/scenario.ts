import type { WorkforceEmployee } from "@shared/types/index";
export function simulateWorkforce(
  employees: WorkforceEmployee[],
  skillId: string,
  needed: number,
  months: number,
) {
  let existing = 0,
    threeMonths = 0,
    sixMonths = 0,
    mobility = 0;
  for (const e of employees) {
    const level = e.skills.find((s) => s.skillId === skillId)?.level ?? 0;
    if (level >= 4) existing++;
    else if (level === 3 && months >= 3) threeMonths++;
    else if (level === 2 && months >= 6) sixMonths++;
    else if (level === 1 && e.engagement >= 70 && months >= 9) mobility++;
  }
  // Disjoint cohorts. Existing talent is reported separately from the additional hiring goal.
  const upskill3 = Math.min(needed, threeMonths);
  const upskill6 = Math.min(needed - upskill3, sixMonths);
  const internal = Math.min(needed - upskill3 - upskill6, mobility);
  const external = Math.max(0, needed - upskill3 - upskill6 - internal);
  const percent = (count: number) =>
    needed > 0 ? Math.round((100 * count) / needed) : 0;
  return {
    internalCoveragePercent: percent(upskill3 + upskill6 + internal),
    percentages: {
      threeMonths: percent(upskill3),
      sixMonths: percent(upskill6),
      mobility: percent(internal),
      external: percent(external),
    },
    existing,
    threeMonths: upskill3,
    sixMonths: upskill6,
    mobility: internal,
    external,
    needed,
    months,
  };
}
