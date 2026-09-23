import { notFound } from "next/navigation";
import "server-only";
import { headers } from "next/headers";
import { ApiClientError, apiErrorMessage } from "./api-client";
export async function serverApi<T>(path: string): Promise<T> {
  if (!path.startsWith("/api/"))
    throw new Error("Only local API routes are supported.");
  // The runtime sets PORT; never use an untrusted Host header as an outbound destination.
  const port = process.env.PORT || "3000";
  if (!/^\d{1,5}$/.test(port)) throw new Error("Invalid internal API port.");
  const incoming = await headers();
  const response = await fetch("http://127.0.0.1:" + port + path, {
    headers: { cookie: incoming.get("cookie") ?? "" },
    cache: "no-store",
  });
  const body = await response.json();
  if (response.status === 404) notFound();
  if (!response.ok)
    throw new ApiClientError(
      body.error?.code ?? "REQUEST_FAILED",
      apiErrorMessage(body.error),
      response.status,
    );
  return body as T;
}
