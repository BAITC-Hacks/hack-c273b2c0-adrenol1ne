import { notFound } from "next/navigation";
import { requireSession } from "@frontend/lib/auth";
import { serverApi } from "@frontend/lib/server-api";
import { ManagerWorkspace } from "@frontend/components/manager/manager-workspace";
import { EmployeeWorkspace } from "@frontend/features/career/employee-workspace";
import type { ManagerTeamView } from "@shared/types/reporting";
import type { Snapshot } from "@shared/types";
import type { SkillEvidenceView } from "@shared/types/learning";
import type { LearningCatalogEntry } from "@shared/types/api";
export const dynamic = "force-dynamic";
export default async function ManagerPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  await requireSession("MANAGER");
  const parts = (await params).section ?? [];
  if (!parts.length)
    return (
      <ManagerWorkspace
        initial={await serverApi<ManagerTeamView>("/api/manager/team")}
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
      serverApi<Snapshot>("/api/manager/employees/" + id),
      serverApi<SkillEvidenceView[]>("/api/evidence?employeeId=" + id),
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
  notFound();
}
