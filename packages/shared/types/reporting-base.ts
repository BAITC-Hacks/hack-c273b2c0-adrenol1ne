import type * as R from "./persistence";
export type Enrollment = R.LearningEnrollmentRecord & {
  progress: R.LearningUnitProgressRecord[];
};
