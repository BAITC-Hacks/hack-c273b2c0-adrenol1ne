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
  "/employee/activities/EV017",
  "/employee/profile",
  "/missions",
]) {
  assert.equal(
    (await request(path, { headers: { Cookie: employee } })).status,
    200,
    path,
  );
}
const learning = await request("/api/learning/EV017", {
  headers: { Cookie: employee },
});
assert.equal(learning.status, 200);
const workspace = await learning.json();
assert.equal(workspace.activity.id, "EV017");
assert.equal(workspace.employee.id, state.employee.id);
assert(workspace.units.length >= 7);
for (const unit of workspace.units) {
  assert(!("assessmentConfig" in unit));
  for (const question of unit.content.questions ?? [])
    assert(!("correctAnswer" in question));
}
const directCompletion = await request("/api/activity", {
  method: "POST",
  headers: {
    Cookie: employee,
    Origin: origin,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ eventId: "EV017", status: "COMPLETED" }),
});
assert.equal(
  directCompletion.status,
  400,
  "Legacy completion must not bypass mastery",
);
const fabricatedScore = await request("/api/learning/EV017/unit", {
  method: "POST",
  headers: {
    Cookie: employee,
    Origin: origin,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    unitId: workspace.units[0].id,
    action: "complete",
    score: 100,
    employeeId: "EMP002",
  }),
});
assert.equal(
  fabricatedScore.status,
  400,
  "Client-provided scores and identities must be rejected",
);
assert.equal(
  (await request("/api/hr/development", { headers: { Cookie: employee } }))
    .status,
  403,
);
assert.equal(
  (await request("/api/evidence", { headers: { Cookie: employee } })).status,
  200,
);
const hr = await login("HR");
assert.equal(
  (await request("/api/learning/EV017", { headers: { Cookie: hr } })).status,
  403,
);
assert.equal(
  (await request("/api/hr/development", { headers: { Cookie: hr } })).status,
  200,
);
const workforce = await request("/api/hr", { headers: { Cookie: hr } });
assert.equal(workforce.status, 200);
assert((await workforce.json()).employees.length >= 20);
for (const path of [
  "/hr",
  "/hr/skills",
  "/hr/employees",
  "/hr/activities",
  "/hr/development",
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
