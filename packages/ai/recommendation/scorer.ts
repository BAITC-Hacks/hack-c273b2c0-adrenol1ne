import type { Factors } from "@shared/types";
import { WEIGHTS } from "@shared/constants/recommendation";
export function scoreFactors(factors: Factors): number {
  return Number(
    Math.min(
      1,
      Math.max(
        0,
        Object.entries(WEIGHTS).reduce(
          (sum, [key, weight]) =>
            sum + weight * factors[key as keyof typeof WEIGHTS],
          0,
        ) - factors.skip_penalty,
      ),
    ).toFixed(4),
  );
}
