import {
  getActivityWorkspace,
  startLearningActivity,
  updateLearningUnit,
  verifyLearningActivity,
  getSkillEvidence,
  getLearningCatalog,
  developmentReport,
  reviewLearningApproval,
  draftLearningPath,
  saveLearningPath,
} from "@/lib/learning-service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/request-security";
import { getSession, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { snapshot, workforce, recordActivity } from "@/lib/services";
import { AIExplanationService } from "@/lib/ai-explanation-service";
import { scoreActivity } from "@/lib/recommendation-engine";
import { importDataset, parseImportFiles } from "@/lib/import-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join("/");
  const session = await getSession();
  if (!session) return json({ error: "Please sign in." }, 401);
  try {
    const segments = path.split("/");
    if (path === "learning-catalog") return json(await getLearningCatalog());
    if (path === "evidence") {
      const employeeId =
        session.role === "EMPLOYEE"
          ? session.employeeId
          : request.nextUrl.searchParams.get("employeeId");
      if (!employeeId) return json({ error: "Employee is required." }, 400);
      return json(await getSkillEvidence(employeeId));
    }
    if (
      segments.length === 2 &&
      segments[0] === "learning" &&
      session.role === "EMPLOYEE"
    )
      return json(await getActivityWorkspace(session.employeeId!, segments[1]));
    if (path === "hr/development" && session.role === "HR")
      return json(await developmentReport());
    if (path === "me" && session.role === "EMPLOYEE")
      return json(await snapshot(session.employeeId!));
    if (path === "hr" && session.role === "HR") return json(await workforce());
    if (path === "hr/employee" && session.role === "HR")
      return json(await snapshot(request.nextUrl.searchParams.get("id") ?? ""));
    if (path === "explanation") {
      const employeeId =
        session.role === "EMPLOYEE"
          ? session.employeeId
          : request.nextUrl.searchParams.get("employeeId");
      if (!employeeId) return json({ error: "Employee is required" }, 400);
      const state = await snapshot(employeeId);
      const event = state.events.find(
        (e) => e.id === request.nextUrl.searchParams.get("eventId"),
      );
      if (!event) return json({ error: "Activity not found" }, 404);
      const candidate = scoreActivity(
        state.employee,
        event,
        state.events,
        state.requirements,
        state.skills,
      );
      return json(
        await AIExplanationService.explain(state.employee, candidate),
      );
    }
    return json(
      { error: "This resource is not available for your role." },
      403,
    );
  } catch {
    return json(
      { error: "We could not load this record. Please try again." },
      404,
    );
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!isSameOrigin(request))
    return json({ error: "Invalid request origin" }, 403);
  const path = (await params).path.join("/");
  try {
    if (path === "login") {
      if (process.env.DEMO_LOGIN_ENABLED !== "true")
        return json(
          {
            error:
              "Demo login is disabled. Configure an identity provider for production.",
          },
          403,
        );
      const { role } = z
        .object({ role: z.enum(["EMPLOYEE", "HR"]) })
        .parse(await request.json());
      const employee =
        role === "EMPLOYEE"
          ? await db.employee.findUnique({
              where: { employeeId: "DEMO-AIDAR" },
            })
          : null;
      if (role === "EMPLOYEE" && !employee)
        return json(
          { error: "Demo data is not initialized. Run npm run db:setup." },
          503,
        );
      const response = json({ redirect: role === "HR" ? "/hr" : "/employee" });
      response.cookies.set(
        "talentos_session",
        signSession({
          role,
          employeeId: employee?.id ?? null,
          expires: Date.now() + 8 * 3600000,
        }),
        {
          httpOnly: true,
          sameSite: "strict",
          secure: request.nextUrl.protocol === "https:",
          path: "/",
          maxAge: 8 * 3600,
        },
      );
      return response;
    }
    if (path === "logout") {
      const response = json({ ok: true });
      response.cookies.delete("talentos_session");
      return response;
    }
    const session = await getSession();
    if (!session) return json({ error: "Please sign in." }, 401);

    const segments = path.split("/");
    if (path === "learning/start" && session.role === "EMPLOYEE") {
      const input = z
        .object({ activityId: z.string().min(1).max(120) })
        .strict()
        .parse(await request.json());
      return json(
        await startLearningActivity(session.employeeId!, input.activityId),
      );
    }
    if (
      segments.length === 3 &&
      segments[0] === "learning" &&
      session.role === "EMPLOYEE"
    ) {
      if (segments[2] === "unit") {
        const input = z
          .object({
            unitId: z.string().min(1).max(180),
            action: z.enum(["start", "complete", "submit", "skip"]),
            submission: z.string().max(20000).optional(),
            answers: z.record(z.number().int().min(0).max(20)).optional(),
          })
          .strict()
          .parse(await request.json());
        return json(
          await updateLearningUnit(session.employeeId!, segments[1], input),
        );
      }
      if (segments[2] === "verify") {
        return json(
          await verifyLearningActivity(session.employeeId!, segments[1]),
        );
      }
    }
    if (path === "hr/development/draft" && session.role === "HR") {
      const input = z
        .object({
          skillId: z.string().min(1).max(120),
          fromLevel: z.number().int().min(0).max(4),
          toLevel: z.number().int().min(1).max(5),
          audience: z.string().trim().min(3).max(200),
          title: z.string().trim().min(3).max(200).optional(),
        })
        .strict()
        .parse(await request.json());
      return json(await draftLearningPath(input));
    }
    if (path === "hr/development/save" && session.role === "HR") {
      const input = z
        .object({ draft: z.unknown() })
        .strict()
        .parse(await request.json());
      return json(await saveLearningPath(input.draft));
    }
    if (path === "hr/development/approve" && session.role === "HR") {
      const input = z
        .object({
          enrollmentId: z.string().min(1).max(120),
          approved: z.boolean(),
          comment: z.string().trim().max(1000).optional(),
        })
        .strict()
        .parse(await request.json());
      return json(await reviewLearningApproval(input));
    }
    if (path === "activity" && session.role === "EMPLOYEE") {
      const input = z
        .object({
          eventId: z.string().min(1),
          status: z.enum(["COMPLETED", "IN_PROGRESS", "SKIPPED", "DECLINED"]),
        })
        .parse(await request.json());
      const result = await recordActivity(
        session.employeeId!,
        input.eventId,
        input.status,
      );
      return json({ ...result, state: await snapshot(session.employeeId!) });
    }
    if (path === "target" && session.role === "EMPLOYEE") {
      const target = z
        .object({ role: z.string(), grade: z.string() })
        .parse(await request.json());
      if (
        !(await db.gradeRequirement.count({
          where: { role: target.role, grade: target.grade },
        }))
      )
        return json(
          { error: "No requirements exist for this career target." },
          400,
        );
      await db.$transaction([
        db.employee.update({
          where: { id: session.employeeId! },
          data: { targetRole: target.role, targetGrade: target.grade },
        }),
        db.recommendation.deleteMany({
          where: { employeeId: session.employeeId! },
        }),
      ]);
      return json(await snapshot(session.employeeId!));
    }
    if (path === "hr/import" && session.role === "HR") {
      const length = Number(request.headers.get("content-length") ?? 0);
      if (length > 9 * 1024 * 1024)
        return json({ error: "Upload limit is 8 MB." }, 413);
      const data = await request.formData();
      const files = data.getAll("files");
      if (!files.length || files.length > 5)
        return json({ error: "Choose 1–5 dataset files." }, 400);
      let total = 0;
      const texts = [];
      for (const file of files) {
        if (!(file instanceof File) || file.size > 2 * 1024 * 1024)
          return json({ error: "Each file must be no more than 2 MB." }, 400);
        total += file.size;
        texts.push({ name: file.name, content: await file.text() });
      }
      if (total > 8 * 1024 * 1024)
        return json({ error: "Upload limit is 8 MB." }, 413);
      return json(await importDataset(parseImportFiles(texts)));
    }
    return json({ error: "This action is not available for your role." }, 403);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    if (message.includes("Unique constraint"))
      return json(
        {
          error:
            "A unique ID or code conflicts with an existing record. No import records were saved.",
        },
        400,
      );
    return json(
      {
        error: message.includes("prisma")
          ? "The database could not complete this action. No partial changes were saved."
          : message,
      },
      400,
    );
  }
}
