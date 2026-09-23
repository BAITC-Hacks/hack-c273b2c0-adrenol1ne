import { notFound } from "next/navigation";
import { requireSession } from "@frontend/lib/auth";
import { serverApi } from "@frontend/lib/server-api";
import { EmployeeWorkspace } from "@frontend/features/career/employee-workspace";
import { ActivityWorkspace } from "@frontend/features/activities/activity-workspace";
import type { Snapshot } from "@shared/types";
import type {
  ActivityWorkspace as Workspace,
  SkillEvidenceView,
} from "@shared/types/learning";
import type { LearningCatalogEntry } from "@shared/types/api";
export const dynamic = "force-dynamic";
export default async function EmployeePage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const session = await requireSession("EMPLOYEE"),
    parts = (await params).section ?? [];
  if (parts.length === 2 && parts[0] === "activities")
    return (
      <ActivityWorkspace
        initial={await serverApi<Workspace>(
          "/api/learning/" + encodeURIComponent(parts[1]),
        )}
      />
    );
  const section = parts.join("/") || "dashboard";
  if (
    !["dashboard", "career", "skills", "activities", "profile"].includes(
      section,
    )
  )
    notFound();
  const [state, evidence, learningCatalog] = await Promise.all([
    serverApi<Snapshot>("/api/employees/" + session.employeeId + "/dashboard"),
    serverApi<SkillEvidenceView[]>("/api/evidence"),
    section === "activities"
      ? serverApi<LearningCatalogEntry[]>("/api/learning-catalog")
      : Promise.resolve([]),
  ]);
  return (
    <EmployeeWorkspace
      initial={state}
      section={section}
      initialEvidence={evidence}
      learningCatalog={learningCatalog}
    />
  );
}
