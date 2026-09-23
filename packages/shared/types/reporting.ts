import type * as R from "./persistence";
import type { Skill } from "./index";
import type { Enrollment } from "./reporting-base";
export type ReportPath = R.LearningPathRecord & {
  skill: Skill;
  event: R.EventRecord;
  units: R.LearningUnitRecord[];
  enrollments: (Enrollment & {
    employee: R.EmployeeRecord;
    assessments: R.AssessmentResultRecord[];
  })[];
};

export type ManagerTeamView = {
  departments: string[];
  workforce: import("./index").Workforce;
  development: import("./learning").DevelopmentReport;
};
