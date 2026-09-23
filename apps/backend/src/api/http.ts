import { ZodError } from "zod";
import { AppError, ValidationError } from "@backend/errors/app-error";
import type { ApiErrorBody } from "@shared/types/api";
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function readJson<T>(
  request: Request,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  const raw = await request.text();
  if (raw.length > 256000)
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      "Request payload is too large.",
      413,
    );
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ValidationError("Malformed JSON request.");
  }
  return schema.parse(value);
}
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request.",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      } satisfies ApiErrorBody,
      400,
    );
  if (error instanceof AppError)
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      } satisfies ApiErrorBody,
      error.status,
    );
  // ORM failures and provider details never cross the HTTP boundary.
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    return json(
      {
        error: {
          code: "CONFLICT",
          message:
            "A unique ID or code conflicts with an existing record. No import records were saved.",
        },
      },
      409,
    );
  console.error(
    "Unexpected API error",
    error instanceof Error ? error.name : "Unknown",
  );
  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed. Please try again.",
      },
    } satisfies ApiErrorBody,
    500,
  );
}
