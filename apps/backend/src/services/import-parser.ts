import { ValidationError } from "@backend/errors/app-error";
import Papa from "papaparse";
import { importSchema, type ImportBundle } from "@shared/schemas/import";
export function parseImportFiles(
  files: { name: string; content: string }[],
): ImportBundle {
  const bundle: Record<string, unknown[]> = {
    employees: [],
    skills: [],
    events: [],
    history: [],
    requirements: [],
  };
  for (const file of files) {
    if (file.name.endsWith(".csv")) {
      if (file.name !== "activity_history.csv")
        throw new ValidationError(
          "CSV files must be named activity_history.csv",
        );
      const parsed = Papa.parse<Record<string, string>>(file.content, {
        header: true,
        skipEmptyLines: "greedy",
      });
      if (parsed.errors.length)
        throw new ValidationError(`CSV: ${parsed.errors[0].message}`);
      bundle.history.push(
        ...parsed.data.map((r) => ({
          ...r,
          completedAt: r.completedAt || null,
        })),
      );
    } else if (file.name.endsWith(".json")) {
      let data: unknown;
      try {
        data = JSON.parse(file.content);
      } catch {
        throw new ValidationError(`${file.name}: invalid JSON`);
      }
      if (Array.isArray(data)) {
        const key = file.name.replace(".json", "");
        if (!(key in bundle))
          throw new ValidationError(`Unsupported file ${file.name}`);
        bundle[key].push(...data);
      } else if (data && typeof data === "object") {
        const object = data as Record<string, unknown>;
        if ("id" in object && "targetRole" in object) {
          bundle.employees.push(object);
          continue;
        }
        if (Object.keys(object).some((key) => !(key in bundle)))
          throw new ValidationError(`${file.name}: unknown dataset property`);
        for (const [key, value] of Object.entries(object)) {
          if (!Array.isArray(value))
            throw new ValidationError(`${key} must be an array`);
          bundle[key].push(...value);
        }
      } else
        throw new ValidationError(
          `${file.name}: expected an array or dataset object`,
        );
    } else throw new ValidationError("Only JSON and CSV files are supported");
  }
  const result = importSchema.safeParse(bundle);
  if (!result.success)
    throw new ValidationError(
      result.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  if (!Object.values(result.data).some((a) => a.length))
    throw new ValidationError("The dataset is empty");
  for (const key of ["employees", "skills", "events"] as const) {
    const ids = result.data[key].map((v) => v.id);
    if (new Set(ids).size !== ids.length)
      throw new ValidationError(`Duplicate IDs in ${key}`);
  }
  for (const e of result.data.employees)
    if (new Set(e.skills.map((s) => s.skillId)).size !== e.skills.length)
      throw new ValidationError(`Duplicate skills for ${e.id}`);
  for (const e of result.data.events)
    if (new Set(e.gains.map((s) => s.skillId)).size !== e.gains.length)
      throw new ValidationError(`Duplicate gains for ${e.id}`);
  return result.data;
}
