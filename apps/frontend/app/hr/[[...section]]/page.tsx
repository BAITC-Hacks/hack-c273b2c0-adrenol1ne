import { notFound } from "next/navigation";
import { requireSession } from "@frontend/lib/auth";
import { serverApi } from "@frontend/lib/server-api";
import { HrWorkspace } from "@frontend/features/analytics/hr-workspace";
import { EmployeeWorkspace } from "@frontend/features/career/employee-workspace";
import { DevelopmentWorkspace } from "@frontend/components/hr/development-workspace";
import type { Snapshot, Workforce } from "@shared/types";
import type {
  DevelopmentReport,
  SkillEvidenceView,
} from "@shared/types/learning";
import type { LearningCatalogEntry } from "@shared/types/api";
export const dynamic = "force-dynamic";
export default async function HrPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  await requireSession("HR");
  const parts = (await params).section ?? [];
  if (parts.length === 1 && parts[0] === "development")
    return (
      <DevelopmentWorkspace
        initial={await serverApi<DevelopmentReport>("/api/hr/development")}
      />
    );
  if ((parts.length === 2 || parts.length === 3) && parts[0] === "employees") {
    const section = parts[2] ?? "dashboard";
    if (
      !["dashboard", "career", "skills", "activities", "profile"].includes(
        section,
      )
    )
      notFound();
    const id = encodeURIComponent(parts[1]);
    const [state, evidence, learningCatalog] = await Promise.all([
      serverApi<Snapshot>("/api/employees/" + id + "/dashboard"),
      serverApi<SkillEvidenceView[]>("/api/evidence?employeeId=" + id),
      section === "activities"
        ? serverApi<LearningCatalogEntry[]>("/api/learning-catalog")
        : Promise.resolve([]),
    ]);
    return (
      <EmployeeWorkspace
        key={state.employee.id}
        initial={state}
        section={section}
        initialEvidence={evidence}
        learningCatalog={learningCatalog}
      />
    );
  }
  const section = parts.join("/") || "overview";
  if (
    ![
      "overview",
      "skills",
      "employees",
      "activities",
      "scenarios",
      "import",
    ].includes(section)
  )
    notFound();
  return (
    <HrWorkspace
      initial={await serverApi<Workforce>("/api/hr/overview")}
      section={section}
    />
  );
}
