import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "@backend/middleware/session";
describe("Signed demo sessions", () => {
  it("accepts a valid role-scoped session", () => {
    const s = {
      role: "EMPLOYEE" as const,
      employeeId: "E1",
      expires: Date.now() + 10000,
    };
    expect(verifySession(signSession(s))).toEqual(s);
  });
  it("rejects tampering and expiry", () => {
    const token = signSession({
      role: "HR",
      employeeId: null,
      expires: Date.now() + 10000,
    });
    expect(verifySession(token + "x")).toBeNull();
    expect(
      verifySession(signSession({ role: "HR", employeeId: null, expires: 1 })),
    ).toBeNull();
  });
  it("rejects missing and malformed tokens", () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession("malformed")).toBeNull();
  });
});
