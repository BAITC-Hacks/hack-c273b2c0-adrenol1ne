import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { snapshot } from "@/lib/services";
import { EmployeeWorkspace } from "@/components/employee-workspace";
export const dynamic = "force-dynamic";
export default async function EmployeePage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const session = await requireSession("EMPLOYEE");
  const section = (await params).section?.join("/") ?? "dashboard";
  if (
    !["dashboard", "career", "skills", "activities", "profile"].includes(
      section,
    )
  )
    notFound();
  return (
    <EmployeeWorkspace
      initial={await snapshot(session.employeeId!)}
      section={section}
    />
  );
}
