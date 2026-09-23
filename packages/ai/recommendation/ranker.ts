import type { Candidate } from "@shared/types";
export function rankCandidates(candidates: Candidate[], limit = 3) {
  return [...candidates]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.activity.hours - b.activity.hours ||
        a.activity.id.localeCompare(b.activity.id),
    )
    .slice(0, limit);
}
