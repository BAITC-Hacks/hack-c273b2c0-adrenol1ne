import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { snapshot, workforce } from "@/lib/services";
import { HrWorkspace } from "@/components/hr-workspace";
import { EmployeeWorkspace } from "@/components/employee-workspace";
export const dynamic = "force-dynamic";
export default async function HrPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  await requireSession("HR");
  const parts = (await params).section ?? [];
  if ((parts.length === 2 || parts.length === 3) && parts[0] === "employees") {
    const view = parts[2] ?? "dashboard";
    if (
      !["dashboard", "career", "skills", "activities", "profile"].includes(view)
    )
      notFound();
    const exists = await snapshot(parts[1]).catch(() => null);
    if (!exists) notFound();
    return (
      <EmployeeWorkspace
        key={exists.employee.id}
        initial={exists}
        section={view}
        hrView
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
  return <HrWorkspace initial={await workforce()} section={section} />;
}
