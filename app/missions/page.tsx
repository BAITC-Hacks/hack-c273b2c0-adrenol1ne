import { requireSession } from "@/lib/auth";
import { snapshot } from "@/lib/services";
import { EmployeeWorkspace } from "@/components/employee-workspace";
export const dynamic = "force-dynamic";
export default async function Missions() {
  const session = await requireSession("EMPLOYEE");
  return (
    <EmployeeWorkspace
      initial={await snapshot(session.employeeId!)}
      section="missions"
    />
  );
}
