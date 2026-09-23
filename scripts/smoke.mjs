import assert from "node:assert/strict";
const origin = process.env.APP_URL || "http://127.0.0.1:3000";
async function request(path, options = {}) {
  return fetch(origin + path, { redirect: "manual", ...options });
}
async function login(role) {
  const response = await request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ role }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert(cookie);
  return cookie;
}
assert.equal((await request("/api/me")).status, 401);
const protectedPage = await request("/employee");
const protectedBody = await protectedPage.text();
assert(
  protectedPage.status === 307 ||
    (protectedPage.status === 200 &&
      protectedBody.includes("__next-page-redirect")),
);
assert(!protectedBody.includes("Aidar Sarsenov"));
const employee = await login("EMPLOYEE");
const me = await request("/api/me?employeeId=SOMEONE_ELSE", {
  headers: { Cookie: employee },
});
assert.equal(me.status, 200);
const state = await me.json();
assert.equal(state.employee.employeeId, "DEMO-AIDAR");
assert(state.recommendations.length > 0);
assert.equal(
  (await request("/api/hr", { headers: { Cookie: employee } })).status,
  403,
);
assert.equal(
  (
    await request("/api/hr/employee?id=EMP002", {
      headers: { Cookie: employee },
    })
  ).status,
  403,
);
assert.equal(
  (
    await request("/api/activity", {
      method: "POST",
      headers: {
        Cookie: employee,
        Origin: "https://foreign.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ eventId: "EV017", status: "COMPLETED" }),
    })
  ).status,
  403,
);
for (const path of [
  "/employee",
  "/employee/skills",
  "/employee/career",
  "/employee/activities",
  "/employee/profile",
  "/missions",
]) {
  assert.equal(
    (await request(path, { headers: { Cookie: employee } })).status,
    200,
    path,
  );
}
const hr = await login("HR");
const workforce = await request("/api/hr", { headers: { Cookie: hr } });
assert.equal(workforce.status, 200);
assert((await workforce.json()).employees.length >= 20);
for (const path of [
  "/hr",
  "/hr/skills",
  "/hr/employees",
  "/hr/activities",
  "/hr/scenarios",
  "/hr/import",
  "/hr/employees/EMP001/skills",
]) {
  assert.equal(
    (await request(path, { headers: { Cookie: hr } })).status,
    200,
    path,
  );
}
console.log(
  "HTTP smoke passed: protected routes, employee isolation, foreign-origin rejection, employee pages and HR pages.",
);
