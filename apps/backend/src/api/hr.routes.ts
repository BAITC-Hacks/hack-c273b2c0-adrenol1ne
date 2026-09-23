import type { ApiContext } from "./context";
import { json, readJson } from "./http";
import {
  authorize,
  authorizeEnrollment,
  authorizeEmployee,
} from "@backend/middleware/authorization";
import { HRService } from "@backend/services/hr.service";
import { EmployeeService } from "@backend/services/employee.service";
import { employeeView } from "./employee.routes";
import { developmentReport } from "@backend/services/development.service";
import {
  draftLearningPath,
  saveLearningPath,
} from "@backend/services/learning-content.service";
import { reviewLearningApproval } from "@backend/services/manager.service";
import {
  importDataset,
  parseImportFiles,
} from "@backend/services/import.service";
import { AuditService } from "@backend/services/audit.service";
import {
  builderSchema,
  publishSchema,
  approvalSchema,
  scenarioSchema,
} from "@shared/schemas/requests";
import { AppError, ValidationError } from "@backend/errors/app-error";
export async function hrRoutes({
  request,
  url,
  path,
  session,
}: ApiContext): Promise<Response | null> {
  if (path[0] !== "hr") return null;
  const route = path.slice(1).join("/");
  authorize(session, "workforce:read");
  if (request.method === "GET") {
    if (!route || route === "overview") return json(await HRService.overview());
    if (route === "skill-gaps") return json((await HRService.overview()).gaps);
    if (route === "learning-roi") {
      const report = await developmentReport();
      return json({
        skillsDeveloped: report.metrics.skillsDeveloped,
        averageTimeToMasteryMinutes: report.metrics.averageTimeToMasteryMinutes,
        completionRate: report.metrics.completionRate,
        financialROI: null,
        limitation:
          "Costs and causal learning impact are not collected. Financial ROI is not estimated.",
      });
    }
    if (route === "development") return json(await developmentReport());
    if (route === "employee") {
      const id = url.searchParams.get("id") ?? "";
      await authorizeEmployee(session, id);
      return json(employeeView(await EmployeeService.dashboard(id), session));
    }
    if (route === "audit") {
      authorize(session, "audit:read");
      return json(await AuditService.list());
    }
  }
  if (request.method !== "POST") return null;
  if (route === "scenario") {
    const input = await readJson(request, scenarioSchema);
    return json(
      await HRService.scenario(input.skillId, input.needed, input.months),
    );
  }
  if (route === "development/draft") {
    authorize(session, "content:write");
    return json(
      await draftLearningPath(await readJson(request, builderSchema)),
    );
  }
  if (route === "development/save") {
    authorize(session, "content:write");
    return json(
      await saveLearningPath((await readJson(request, publishSchema)).draft),
    );
  }
  if (route === "development/approve") {
    const input = await readJson(request, approvalSchema);
    await authorizeEnrollment(session, input.enrollmentId);
    return json(await reviewLearningApproval(input));
  }
  if (route === "import") {
    authorize(session, "data:import");
    if (Number(request.headers.get("content-length") ?? 0) > 9 * 1024 * 1024)
      throw new AppError("PAYLOAD_TOO_LARGE", "Upload limit is 8 MB.", 413);
    const form = await request.formData(),
      files = form.getAll("files");
    if (!files.length || files.length > 5)
      throw new ValidationError("Choose 1–5 dataset files.");
    const texts = [];
    let total = 0;
    for (const file of files) {
      if (!(file instanceof File) || file.size > 2 * 1024 * 1024)
        throw new ValidationError("Each file must be no more than 2 MB.");
      total += file.size;
      texts.push({ name: file.name, content: await file.text() });
    }
    if (total > 8 * 1024 * 1024)
      throw new AppError("PAYLOAD_TOO_LARGE", "Upload limit is 8 MB.", 413);
    return json(await importDataset(parseImportFiles(texts)));
  }
  return null;
}
