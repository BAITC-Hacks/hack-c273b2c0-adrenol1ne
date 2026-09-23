/** Compare the browser Origin to the actual request Host, not Next's normalized loopback URL. */
export function isSameOrigin(request: {
  url: string;
  headers: Headers;
}): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const expected = new URL(request.url);
    if (!["http:", "https:"].includes(expected.protocol)) return false;
    expected.host = host;
    return origin === expected.origin;
  } catch {
    return false;
  }
}
