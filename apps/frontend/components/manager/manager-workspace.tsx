"use client";
import { useState } from "react";
import Link from "next/link";
import { Shell } from "@frontend/components/shared/shell";
import {
  Heading,
  Empty,
  Badge,
} from "@frontend/components/shared/presentation";
import { Button } from "@frontend/components/shared/ui/button";
import { apiClient } from "@frontend/lib/api-client";
import type { ManagerTeamView } from "@shared/types/reporting";
export function ManagerWorkspace({ initial }: { initial: ManagerTeamView }) {
  const [data, setData] = useState(initial),
    [comments, setComments] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function review(enrollmentId: string, approved: boolean) {
    setBusy(enrollmentId);
    setError("");
    try {
      setData(
        await apiClient<ManagerTeamView>("/api/manager/validate", {
          method: "POST",
          body: JSON.stringify({
            enrollmentId,
            approved,
            comment: comments[enrollmentId] ?? "",
          }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save validation.");
    } finally {
      setBusy("");
    }
  }
  return (
    <Shell role="MANAGER" name="Team Manager">
      <Heading
        eyebrow="TEAM DEVELOPMENT"
        title="Support your team's next step."
        description="Review development context and assessed work within your assigned team."
      />
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <div className="chip-row">
        {data.departments.map((d) => (
          <Badge key={d}>{d}</Badge>
        ))}
      </div>
      <section className="card section-gap">
        <h2>One-on-one preparation</h2>
        <p>
          Open an employee to review their target, remaining skills,
          recommendations and evidence.
        </p>
        {data.workforce.employees.length ? (
          <div className="activity-grid">
            {data.workforce.employees.map((e) => (
              <article className="card" key={e.id}>
                <h3>{e.name}</h3>
                <p>
                  {e.role} · {e.grade}
                </p>
                <p>
                  {e.routeLabel} · {e.readiness}% readiness
                </p>
                <p>{e.criticalGaps} critical skill gaps</p>
                <Link className="text-link" href={"/manager/employees/" + e.id}>
                  View development context →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="No team assigned"
            description="Demo manager visibility is defined by persisted team assignments."
          />
        )}
      </section>
      <section className="section-gap">
        <h2>Manager validation</h2>
        <p>
          Approval records reviewed evidence. The employee verifies their skill
          gain separately.
        </p>
        {data.development.approvals.length ? (
          data.development.approvals.map((item) => (
            <article className="card section-gap" key={item.enrollmentId}>
              <h3>
                {item.employeeName} · {item.activityName}
              </h3>
              <p>
                {item.masteryPoints} mastery points · Project{" "}
                {item.projectScore ?? "—"}%
              </p>
              <details>
                <summary>Review submitted project</summary>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {item.projectSubmission ?? "No written submission."}
                </p>
              </details>
              <label className="lrn-field">
                Manager comment
                <textarea
                  value={comments[item.enrollmentId] ?? ""}
                  onChange={(e) =>
                    setComments({
                      ...comments,
                      [item.enrollmentId]: e.target.value,
                    })
                  }
                  maxLength={2000}
                />
              </label>
              <div className="lrn-actions">
                <Button
                  disabled={!!busy}
                  onClick={() => review(item.enrollmentId, true)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={!!busy || !comments[item.enrollmentId]?.trim()}
                  onClick={() => review(item.enrollmentId, false)}
                >
                  Request revision
                </Button>
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="No reviews waiting"
            description="Eligible projects from your team appear after the required assessed work is complete."
          />
        )}
      </section>
    </Shell>
  );
}
