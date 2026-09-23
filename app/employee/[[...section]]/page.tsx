import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { snapshot } from "@/lib/services";
import {
  getActivityWorkspace,
  getLearningCatalog,
  getSkillEvidence,
} from "@/lib/learning-service";
import { EmployeeWorkspace } from "@/components/employee-workspace";
import { ActivityWorkspace } from "@/components/activity-workspace";
export const dynamic = "force-dynamic";
export default async function EmployeePage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const session = await requireSession("EMPLOYEE");
  const parts = (await params).section ?? [];
  if (parts.length === 2 && parts[0] === "activities") {
    const state = await getActivityWorkspace(
      session.employeeId!,
      parts[1],
    ).catch(() => null);
    if (!state) notFound();
    return <ActivityWorkspace key={state.activity.id} initial={state} />;
  }
  const section = parts.join("/") || "dashboard";
  if (
    !["dashboard", "career", "skills", "activities", "profile"].includes(
      section,
    )
  )
    notFound();
  const [state, evidence, learningCatalog] = await Promise.all([
    snapshot(session.employeeId!),
    getSkillEvidence(session.employeeId!),
    section === "activities" ? getLearningCatalog() : Promise.resolve([]),
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
