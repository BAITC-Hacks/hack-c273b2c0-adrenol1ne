import { requireSession } from "@frontend/lib/auth";
import { serverApi } from "@frontend/lib/server-api";
import type { Snapshot } from "@shared/types";
import { EmployeeWorkspace } from "@frontend/features/career/employee-workspace";
export const dynamic = "force-dynamic";
export default async function Missions() {
  const session = await requireSession("EMPLOYEE");
  return (
    <EmployeeWorkspace
      initial={await serverApi<Snapshot>(
        "/api/employees/" + session.employeeId + "/dashboard",
      )}
      section="missions"
    />
  );
}
