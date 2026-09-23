import type { ApiErrorBody } from "@shared/types/api";
export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function apiErrorMessage(
  value: unknown,
  fallback = "Request failed.",
): string {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  )
    return value.message;
  return fallback;
}
export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, {
    ...options,
    headers: {
      ...(options.body && typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const error = (result as ApiErrorBody).error;
    throw new ApiClientError(
      error?.code ?? "REQUEST_FAILED",
      apiErrorMessage(error),
      response.status,
    );
  }
  return result as T;
}

export function apiFetch(path: string, options: RequestInit = {}) {
  if (!path.startsWith("/api/"))
    throw new Error("Only same-origin API paths are supported.");
  return fetch(path, options);
}
