import { describe, expect, it } from "vitest";
import { isSameOrigin } from "../lib/request-security";
const request = (origin: string, host = "127.0.0.1:3000") => ({
  url: "http://localhost:3000/api/login",
  headers: new Headers({ origin, host }),
});
describe("Mutation origin guard", () => {
  it("accepts the actual browser loopback host despite Next URL normalization", () =>
    expect(isSameOrigin(request("http://127.0.0.1:3000"))).toBe(true));
  it("rejects foreign origins, scheme changes and port changes", () => {
    for (const origin of [
      "https://evil.example",
      "http://127.0.0.1:3001",
      "https://127.0.0.1:3000",
      "null",
    ])
      expect(isSameOrigin(request(origin))).toBe(false);
  });
  it("rejects missing origin or host", () => {
    expect(
      isSameOrigin({ url: "http://localhost:3000", headers: new Headers() }),
    ).toBe(false);
  });
});
