"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileCheck2,
  FlaskConical,
  GraduationCap,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import type {
  ActivityWorkspace as WorkspaceData,
  AssessmentEvaluation,
  LearningUnitAction,
  LearningUnitView,
  SkillEvidenceView,
} from "@/lib/learning-types";
import { Shell } from "./shell";
import { Badge, Empty } from "./shared";
import { Button } from "./ui/button";

const tabs = [
  { id: "overview", label: "Overview", icon: Layers3 },
  { id: "path", label: "Learning Path", icon: BookOpen },
  { id: "practice", label: "Practice", icon: FlaskConical },
  { id: "assessment", label: "Assessment", icon: FileCheck2 },
  { id: "evidence", label: "Evidence", icon: ShieldCheck },
] as const;
type WorkspaceTab = (typeof tabs)[number]["id"];
const practiceTypes = new Set([
  "AI_TASK",
  "CASE_STUDY",
  "CODING_TASK",
  "PROJECT",
  "MENTOR_SESSION",
]);
const assessmentTypes = new Set(["QUIZ", "ASSESSMENT", "CERTIFICATION"]);
const readingTypes = new Set(["COURSE", "ARTICLE", "VIDEO"]);
const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (v) => v.toUpperCase());
const duration = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
    : `${minutes}m`;
function Meter({
  value,
  label: accessibleLabel,
  mastery = false,
}: {
  value: number;
  label: string;
  mastery?: boolean;
}) {
  return (
    <div
      className={`lrn-meter ${mastery ? "mastery" : ""}`}
      role="progressbar"
      aria-label={accessibleLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.max(0, Math.min(100, value))}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ActivityWorkspace({ initial }: { initial: WorkspaceData }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const readerRef = useRef<HTMLDivElement>(null);
  const enrollment = data.enrollment;
  const mastery = enrollment?.masteryPoints ?? 0;
  const selected = data.units.find((u) => u.id === selectedId);
  const nextUnit =
    data.units.find(
      (u) => u.status === "IN_PROGRESS" || u.status === "FAILED",
    ) ?? data.units.find((u) => u.status === "AVAILABLE");
  const displayedChanges = data.milestone?.changes ?? data.impact.skills;
  const skillImpact =
    displayedChanges.find((s) => s.skillId === data.path.skillId) ??
    displayedChanges[0];
  const readinessBefore =
    data.milestone?.readinessBefore ?? data.impact.readinessBefore;
  const readinessAfter =
    data.milestone?.readinessAfter ?? data.impact.readinessAfter;
  const visibleUnits = data.units.filter((u) =>
    tab === "practice"
      ? practiceTypes.has(u.type)
      : tab === "assessment"
        ? assessmentTypes.has(u.type)
        : true,
  );
  const verified = !!enrollment?.verifiedAt;
  useEffect(() => {
    if (selectedId)
      readerRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }, [selectedId, tab]);
  async function request(endpoint: string, payload?: unknown) {
    setBusy(endpoint);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        endpoint,
        payload === undefined
          ? { cache: "no-store" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "This action could not be saved. Please try again.",
        );
      setData(result as WorkspaceData);
      return result as WorkspaceData;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Please check your connection and try again.",
      );
      return null;
    } finally {
      setBusy("");
    }
  }
  async function begin() {
    const result = await request("/api/learning/start", {
      activityId: data.activity.id,
    });
    if (result) {
      setTab("path");
      setSelectedId(
        result.units.find(
          (u) => u.status === "AVAILABLE" || u.status === "IN_PROGRESS",
        )?.id ?? "",
      );
    }
  }
  async function unitAction(action: LearningUnitAction) {
    const result = await request(
      `/api/learning/${encodeURIComponent(data.activity.id)}/unit`,
      action,
    );
    if (result && action.action === "complete")
      setNotice(
        "Learning progress saved. Your skill level changes only after final verification.",
      );
    if (result && action.action === "skip")
      setNotice(
        "Basic practice skipped based on your assessment result. Required verification still applies.",
      );
  }
  function openUnit(unit: LearningUnitView, targetTab: WorkspaceTab = "path") {
    setTab(targetTab);
    setSelectedId(unit.id);
    setNotice("");
    setError("");
  }
  async function verify() {
    await request(
      `/api/learning/${encodeURIComponent(data.activity.id)}/verify`,
      {},
    );
  }
  function progression(units: LearningUnitView[]) {
    if (!units.length)
      return (
        <Empty
          title="No modules in this section"
          description="Explore the complete learning path to see the next step."
          action={
            <Button variant="outline" onClick={() => setTab("path")}>
              View learning path
            </Button>
          }
        />
      );
    return (
      <div className="lrn-timeline">
        {units.map((unit) => (
          <div
            className={`lrn-unit ${unit.status.toLowerCase()}`}
            key={unit.id}
          >
            <div className="lrn-node">
              {unit.status === "COMPLETED" ? (
                <Check size={14} />
              ) : unit.status === "LOCKED" ? (
                <LockKeyhole size={12} />
              ) : unit.status === "IN_PROGRESS" ? (
                <Play size={12} />
              ) : (
                String(data.units.indexOf(unit) + 1).padStart(2, "0")
              )}
            </div>
            <button
              className={`lrn-unit-button ${selectedId === unit.id ? "selected" : ""}`}
              onClick={() =>
                openUnit(
                  unit,
                  tab === "practice" || tab === "assessment" ? tab : "path",
                )
              }
              aria-expanded={selectedId === unit.id}
              aria-controls="learning-unit-reader"
            >
              <div className="flex-between">
                <span className="eyebrow">
                  {label(unit.type)}
                  {unit.isRemediation ? " · REVIEW" : ""}
                </span>
                <span className={`lrn-state ${unit.status.toLowerCase()}`}>
                  {unit.progress?.skipped
                    ? "Skipped · qualified"
                    : label(unit.status)}
                </span>
              </div>
              <div className="lrn-unit-title">
                <strong>{unit.title}</strong>
                <ChevronRight size={15} />
              </div>
              <p>{unit.description}</p>
              <div className="lrn-unit-meta">
                <span>
                  <Clock3 size={11} />
                  {duration(unit.estimatedMinutes)}
                </span>
                <span>Level {unit.difficulty}</span>
                <span>{unit.required ? "Required" : "Optional"}</span>
                {unit.masteryPoints > 0 && (
                  <span>{unit.masteryPoints} mastery points</span>
                )}
                {unit.progress?.score !== null &&
                  unit.progress?.score !== undefined && (
                    <span>Assessment {unit.progress.score}%</span>
                  )}
              </div>
            </button>
          </div>
        ))}
      </div>
    );
  }
  return (
    <Shell role="EMPLOYEE" name={data.employee.name}>
      <div className="learning-workspace">
        <Link className="lrn-back" href="/employee/activities">
          <ArrowLeft size={14} /> All development activities
        </Link>
        <header className="lrn-hero">
          <div className="lrn-hero-top">
            <div>
              <div className="chip-row">
                <Badge tone="green">
                  <GraduationCap size={12} /> Activity Workspace
                </Badge>
                <Badge tone="neutral">
                  {verified
                    ? "Verified milestone"
                    : enrollment
                      ? "Development in progress"
                      : "Personal development journey"}
                </Badge>
              </div>
              <h1>{data.path.title}</h1>
              <p>{data.path.description}</p>
            </div>
            <div className="lrn-hero-mark">
              <Layers3 size={32} strokeWidth={1.4} />
            </div>
          </div>
          <div className="lrn-stats">
            <div className="lrn-stat">
              <span className="lrn-stat-label">
                <Target size={12} /> {data.path.skillName}
              </span>
              <strong>
                {skillImpact?.from ?? data.path.fromLevel}
                <ArrowRight size={15} />
                <span className="green-text">
                  {skillImpact?.to ?? data.path.toLevel}
                </span>
                <em>skill level</em>
              </strong>
              <small>Gain requires verified evidence</small>
            </div>
            <div className="lrn-stat">
              <span className="lrn-stat-label">Target career readiness</span>
              <strong>
                {readinessBefore}%<ArrowRight size={15} />
                <span className="green-text">{readinessAfter}%</span>
              </strong>
              <small>
                {verified ? "Verified" : "Expected"} ·{" "}
                {data.employee.targetGrade} {data.employee.targetRole}
              </small>
            </div>
            <div className="lrn-stat">
              <span className="lrn-stat-label">
                <Clock3 size={12} /> Estimated learning time
              </span>
              <strong>{duration(data.path.estimatedMinutes)}</strong>
              <small>
                {duration(
                  enrollment?.remainingMinutes ?? data.path.estimatedMinutes,
                )}{" "}
                remaining
              </small>
            </div>
            <div className="lrn-stat">
              <span className="lrn-stat-label">Content progress</span>
              <strong>{enrollment?.progressPercent ?? 0}%</strong>
              <small>
                {enrollment?.completedUnits ?? 0} / {data.units.length} modules
                completed
              </small>
            </div>
          </div>
        </header>
        {error && (
          <div role="alert" className="lrn-callout error">
            <TriangleAlert size={18} />
            <div>
              <strong>Action not completed</strong>
              {error}
            </div>
          </div>
        )}
        {notice && (
          <div role="status" className="lrn-callout">
            <CheckCircle2 size={18} />
            <div>{notice}</div>
          </div>
        )}
        {data.milestone && (
          <section
            className="lrn-milestone"
            aria-label="Development milestone achieved"
          >
            <div className="lrn-milestone-icon">
              <ShieldCheck size={29} />
            </div>
            <div className="eyebrow" style={{ justifyContent: "center" }}>
              VERIFIED DEVELOPMENT
            </div>
            <h2>Development milestone achieved</h2>
            <p>
              Your evidence has updated your skills, career readiness and next
              best action.
            </p>
            <div className="lrn-milestone-values">
              {data.milestone.changes.map((change) => (
                <div key={change.skillId}>
                  <span>{change.name}</span>
                  <strong>
                    {change.from} → {change.to}
                  </strong>
                </div>
              ))}
              <div>
                <span>Career readiness</span>
                <strong>
                  {data.milestone.readinessBefore}% →{" "}
                  {data.milestone.readinessAfter}%
                </strong>
              </div>
              <div>
                <span>Evidence confidence*</span>
                <strong>{data.milestone.evidenceConfidence}%</strong>
              </div>
            </div>
            {data.milestone.nextRecommendation ? (
              <>
                <p>YOUR NEW NEXT BEST ACTION</p>
                <h3 style={{ marginTop: 8 }}>
                  {data.milestone.nextRecommendation.activity.name}
                </h3>
                <Button asChild>
                  <Link
                    href={`/employee/activities/${data.milestone.nextRecommendation.activity.id}`}
                  >
                    Explore next activity
                    <ArrowRight size={15} />
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="outline">
                <Link href="/employee/career">
                  View updated career paths
                  <ArrowRight size={15} />
                </Link>
              </Button>
            )}
            <p style={{ fontSize: 10, marginTop: 15 }}>
              *Demo evidence confidence is a transparent heuristic, not a
              validated competency rating.
            </p>
          </section>
        )}
        <div className="lrn-refresh">
          <nav className="lrn-tabs" aria-label="Activity workspace sections">
            {tabs.map((item) => (
              <button
                key={item.id}
                className={`lrn-tab ${tab === item.id ? "active" : ""}`}
                onClick={() => {
                  setTab(item.id);
                  setSelectedId("");
                }}
                aria-current={tab === item.id ? "page" : undefined}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh learning progress"
            disabled={!!busy}
            onClick={() =>
              request(`/api/learning/${encodeURIComponent(data.activity.id)}`)
            }
          >
            <RefreshCw
              size={16}
              className={
                busy.startsWith("/api/learning/") &&
                !busy.endsWith("/unit") &&
                !busy.endsWith("/verify")
                  ? "spin"
                  : ""
              }
            />
          </Button>
        </div>
        <div className="lrn-layout">
          <div className="lrn-main">
            {tab === "overview" && (
              <>
                <section className="lrn-card">
                  <div className="lrn-card-head">
                    <div>
                      <div className="eyebrow">PURPOSEFUL DEVELOPMENT</div>
                      <h2>Build capability. Prove the impact.</h2>
                      <p>
                        A guided journey from learning to an evidence-backed
                        skill advancement.
                      </p>
                    </div>
                    <Target size={22} className="green-text" />
                  </div>
                  <ul className="lrn-objectives">
                    {data.path.learningObjectives.map((objective, i) => (
                      <li key={i}>
                        <CheckCircle2 size={16} />
                        <span>{objective}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="lrn-flow">
                    <div>
                      <BookOpen size={21} />
                      <strong>Learn</strong>
                      <p>Develop the foundations</p>
                    </div>
                    <div>
                      <FlaskConical size={21} />
                      <strong>Practice & apply</strong>
                      <p>Solve synthetic bank cases</p>
                    </div>
                    <div>
                      <FileCheck2 size={21} />
                      <strong>Assess</strong>
                      <p>Demonstrate understanding</p>
                    </div>
                    <div>
                      <ShieldCheck size={21} />
                      <strong>Verify</strong>
                      <p>Earn a supported skill gain</p>
                    </div>
                  </div>
                </section>
                <section className="lrn-card">
                  <div className="lrn-card-head">
                    <div>
                      <h2>
                        {enrollment
                          ? "Continue your journey"
                          : "Your first step"}
                      </h2>
                      <p>
                        {verified
                          ? "Your verified evidence remains available in this workspace."
                          : "Progress at your own pace. Your submissions and results are saved."}
                      </p>
                    </div>
                    <Badge tone="neutral">{data.units.length} modules</Badge>
                  </div>
                  {nextUnit ? (
                    progression([nextUnit])
                  ) : (
                    <p className="lrn-copy">
                      The learning modules are complete. Review your evidence
                      and final verification requirements.
                    </p>
                  )}
                  <Button variant="outline" onClick={() => setTab("path")}>
                    View the full learning path
                    <ArrowRight size={14} />
                  </Button>
                </section>
                <div className="lrn-callout">
                  <ShieldCheck size={21} />
                  <div>
                    <strong>
                      Content completion and skill verification are separate.
                    </strong>
                    Reading or watching material records learning progress.
                    Skills advance only after the mastery threshold, required
                    assessments and any mentor approval are satisfied.
                  </div>
                </div>
              </>
            )}
            {(tab === "path" || tab === "practice" || tab === "assessment") && (
              <>
                <section className="lrn-card">
                  <div className="lrn-card-head">
                    <div>
                      <div className="eyebrow">
                        {tab === "practice"
                          ? "APPLY YOUR KNOWLEDGE"
                          : tab === "assessment"
                            ? "DEMONSTRATE MASTERY"
                            : "YOUR DEVELOPMENT JOURNEY"}
                      </div>
                      <h2>
                        {tab === "practice"
                          ? "Banking practice lab"
                          : tab === "assessment"
                            ? "Assessment & verification"
                            : "A structured path forward"}
                      </h2>
                      <p>
                        {tab === "practice"
                          ? "Work through realistic cases using synthetic data. Submissions are evaluated against an explicit rubric."
                          : tab === "assessment"
                            ? "Pass at 70%. Scores of 85% or higher unlock eligible basic-practice skips; lower scores add focused review."
                            : "Complete each required step to unlock the next. Review modules adapt to your assessment results."}
                      </p>
                    </div>
                  </div>
                  {progression(visibleUnits)}
                </section>
                {selected && (
                  <div
                    ref={readerRef}
                    id="learning-unit-reader"
                    className="lrn-reader"
                  >
                    <UnitReader
                      key={selected.id}
                      unit={selected}
                      enrollmentStarted={!!enrollment}
                      verified={verified}
                      allowRevision={
                        selected.type === "PROJECT" &&
                        enrollment?.approvalStatus === "REJECTED"
                      }
                      remediationPending={
                        selected.status === "FAILED" &&
                        data.units.some(
                          (u) => u.isRemediation && u.status !== "COMPLETED",
                        )
                      }
                      busy={!!busy}
                      onBegin={begin}
                      onAction={unitAction}
                      skillName={data.path.skillName}
                      target={`${data.employee.targetGrade} ${data.employee.targetRole}`}
                    />
                  </div>
                )}
              </>
            )}
            {tab === "evidence" && (
              <section className="lrn-card">
                <div className="lrn-card-head">
                  <div>
                    <div className="eyebrow">A TRACEABLE SKILL RECORD</div>
                    <h2>Your development evidence</h2>
                    <p>
                      Evidence is created from completed learning and evaluated
                      work. Verified records support your skill profile.
                    </p>
                  </div>
                  <ShieldCheck size={22} className="green-text" />
                </div>
                <EvidenceList evidence={data.evidence} />
              </section>
            )}
          </div>
          <aside className="lrn-aside" aria-label="Skill verification progress">
            <section className="lrn-card">
              <div className="flex-between">
                <span className="eyebrow">SKILL MASTERY</span>
                <ShieldCheck size={18} className="green-text" />
              </div>
              <h3 style={{ marginTop: 10 }}>{data.path.skillName}</h3>
              <div className="lrn-master-number">
                <strong>{mastery}</strong>
                <span>/ 100 points</span>
              </div>
              <Meter value={mastery} mastery label="Mastery points" />
              <p className="lrn-copy">
                {verified
                  ? "Skill advancement verified. Your evidence, career readiness and next recommendation are updated."
                  : data.canVerify
                    ? "All requirements are satisfied. Verify your skill advancement to update your career readiness."
                    : mastery >= data.path.masteryThreshold
                      ? "Mastery threshold reached. Complete the remaining verification requirements."
                      : `${Math.max(0, data.path.masteryThreshold - mastery)} more points to reach the mastery threshold.`}
              </p>
              <div style={{ marginTop: 14 }}>
                <div className="lrn-rule">
                  <span>Required mastery</span>
                  <strong>{data.path.masteryThreshold} points</strong>
                </div>
                <div className="lrn-rule">
                  <span>Assessment pass score</span>
                  <strong>70%</strong>
                </div>
                <div className="lrn-rule">
                  <span>Mentor approval</span>
                  <strong>
                    {data.path.requiresApproval
                      ? label(enrollment?.approvalStatus ?? "PENDING")
                      : "Not required"}
                  </strong>
                </div>
              </div>
              {!enrollment ? (
                <Button
                  disabled={!!busy || data.legacyCompleted}
                  onClick={begin}
                >
                  {busy ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Play size={14} />
                  )}{" "}
                  {data.legacyCompleted
                    ? "Already completed"
                    : "Begin learning journey"}
                </Button>
              ) : !verified ? (
                <Button disabled={!!busy || !data.canVerify} onClick={verify}>
                  {busy.endsWith("/verify") ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <ShieldCheck size={15} />
                  )}{" "}
                  Verify skill advancement
                </Button>
              ) : (
                <Badge tone="green">
                  <CheckCircle2 size={13} /> Skill advancement verified
                </Badge>
              )}
              {!verified &&
                enrollment &&
                data.verificationBlockedReasons.length > 0 && (
                  <ul className="lrn-blockers">
                    {data.verificationBlockedReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                )}
            </section>
            <section className="lrn-card">
              <div className="flex-between">
                <span className="eyebrow">CONTENT PROGRESS</span>
                <BookOpen size={16} className="muted" />
              </div>
              <div className="lrn-meter-label" style={{ marginTop: 18 }}>
                <span>Modules completed</span>
                <strong>
                  {enrollment?.completedUnits ?? 0} / {data.units.length}
                </strong>
              </div>
              <Meter
                value={enrollment?.progressPercent ?? 0}
                label="Content completion"
              />
              <div className="lrn-rule" style={{ marginTop: 10 }}>
                <span>Remaining time</span>
                <strong>
                  {duration(
                    enrollment?.remainingMinutes ?? data.path.estimatedMinutes,
                  )}
                </strong>
              </div>
              <p className="lrn-copy" style={{ fontSize: 10, marginTop: 8 }}>
                Estimated learning time. Content progress alone does not change
                your skill level.
              </p>
              {enrollment && nextUnit && !verified && (
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => openUnit(nextUnit)}
                >
                  Continue learning
                  <ArrowRight size={14} />
                </Button>
              )}
            </section>
            {data.path.requiresApproval && !verified && (
              <div className="lrn-callout amber">
                <ShieldCheck size={20} />
                <div>
                  <strong>
                    {enrollment?.approvalStatus === "APPROVED"
                      ? "Mentor validation approved"
                      : enrollment?.approvalStatus === "REJECTED"
                        ? "Mentor revision requested"
                        : "Mentor validation required"}
                  </strong>
                  {enrollment?.approvalComment ??
                    "Submit your project for the HR / mentor review queue. After approval, refresh this workspace and complete final verification."}
                </div>
              </div>
            )}
            {data.legacyCompleted && (
              <div className="lrn-callout blue">
                <FileCheck2 size={18} />
                <div>
                  <strong>Previously completed activity</strong>This completion
                  predates structured learning. Existing skill levels are
                  preserved; this workspace does not grant the same gain again.
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function UnitReader({
  unit,
  enrollmentStarted,
  verified,
  allowRevision,
  remediationPending,
  busy,
  onBegin,
  onAction,
  skillName,
  target,
}: {
  unit: LearningUnitView;
  enrollmentStarted: boolean;
  verified: boolean;
  allowRevision: boolean;
  remediationPending: boolean;
  busy: boolean;
  onBegin: () => Promise<void>;
  onAction: (action: LearningUnitAction) => Promise<void>;
  skillName: string;
  target: string;
}) {
  const [submission, setSubmission] = useState(unit.progress?.submission ?? "");
  const [answers, setAnswers] = useState<Record<string, number>>(
    unit.progress?.answers ?? {},
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const questions = unit.content.questions ?? [];
  const question = questions[questionIndex];
  const editable =
    !verified &&
    !remediationPending &&
    (unit.status === "IN_PROGRESS" ||
      unit.status === "FAILED" ||
      allowRevision);
  const isReading = readingTypes.has(unit.type);
  const answered = questions.filter((q) =>
    Number.isInteger(answers[q.id]),
  ).length;
  const words = submission.trim().split(/\s+/).filter(Boolean).length;
  const resource = unit.externalUrl ?? unit.content.externalUrl;
  const feedback = unit.progress?.feedback;
  return (
    <section className="lrn-card">
      <div className="flex-between">
        <Badge tone={unit.isRemediation ? "amber" : "green"}>
          {label(unit.type)}
          {unit.isRemediation ? " · Remediation" : ""}
        </Badge>
        <span className="lrn-unit-meta">
          <Clock3 size={12} />
          {duration(unit.estimatedMinutes)}
        </span>
      </div>
      <h2>{unit.title}</h2>
      <p className="lrn-copy">{unit.description}</p>
      {unit.completionRequirement && (
        <div className="lrn-callout blue" style={{ marginTop: 18 }}>
          <FileCheck2 size={17} />
          <div>
            <strong>Completion requirement</strong>
            {unit.completionRequirement}
          </div>
        </div>
      )}
      {unit.status === "LOCKED" ? (
        <div className="lrn-callout amber" style={{ marginTop: 20 }}>
          <LockKeyhole size={18} />
          <div>
            <strong>This module is locked</strong>Complete the preceding
            required steps and any assigned remediation to continue.
          </div>
        </div>
      ) : (
        <>
          {unit.learningObjectives.length > 0 && (
            <div style={{ marginTop: 23 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                LEARNING OBJECTIVES
              </div>
              <ul className="lrn-objectives">
                {unit.learningObjectives.map((objective, i) => (
                  <li key={i}>
                    <CheckCircle2 size={15} />
                    {objective}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="lrn-content">
            {unit.content.sections?.map((section, i) => (
              <section key={i}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
          {resource && /^https?:\/\//i.test(resource) && (
            <Button asChild variant="outline">
              <a href={resource} target="_blank" rel="noopener noreferrer">
                Open{" "}
                {unit.providerName ?? unit.content.providerName ?? "learning"}{" "}
                resource
                <ExternalLink size={14} />
              </a>
            </Button>
          )}
          {unit.content.prompt && (
            <div className="lrn-callout" style={{ marginTop: 16 }}>
              <FlaskConical size={20} />
              <div>
                <strong>Your challenge · {skillName}</strong>
                {unit.content.prompt}
                <p style={{ fontSize: 10, marginTop: 8 }}>
                  Career context: {target}. Use only synthetic examples in your
                  response.
                </p>
              </div>
            </div>
          )}
          {unit.content.syntheticData && (
            <details style={{ marginTop: 16 }}>
              <summary className="text-link">
                Inspect the synthetic case data
              </summary>
              <pre
                style={{
                  overflowX: "auto",
                  padding: 16,
                  background: "#f4f7f2",
                  borderRadius: 8,
                  fontSize: 11,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {unit.content.syntheticData}
              </pre>
            </details>
          )}
          {unit.content.deliverables?.length ? (
            <div style={{ marginTop: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                YOUR DELIVERABLES
              </div>
              <ul className="lrn-objectives">
                {unit.content.deliverables.map((deliverable, i) => (
                  <li key={i}>
                    <ChevronRight size={14} />
                    {deliverable}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {unit.rubric && Object.keys(unit.rubric).length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                ASSESSMENT RUBRIC · 100 POINTS
              </div>
              <div className="chip-row">
                {Object.entries(unit.rubric).map(([dimension, max]) => (
                  <Badge tone="neutral" key={dimension}>
                    {dimensionLabel(dimension)} · {max}
                  </Badge>
                ))}
              </div>
              <p className="lrn-copy" style={{ fontSize: 10, marginTop: 9 }}>
                The demo evaluator checks rubric evidence in your submission. It
                does not replace a professional architecture or competency
                review.
              </p>
            </div>
          )}
          {!enrollmentStarted ? (
            <div className="lrn-actions">
              <Button disabled={busy} onClick={onBegin}>
                <Play size={14} />
                Begin learning journey
              </Button>
            </div>
          ) : unit.status === "AVAILABLE" && !verified ? (
            <div className="lrn-actions">
              <Button
                disabled={busy}
                onClick={() => onAction({ unitId: unit.id, action: "start" })}
              >
                <Play size={14} />
                Start this module
              </Button>
            </div>
          ) : null}
          {editable && isReading && (
            <div style={{ marginTop: 20 }}>
              <label className="dev-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I have worked through the material and reviewed the learning
                  objectives. This records content completion; it does not
                  verify my skill.
                </span>
              </label>
              <Button
                disabled={busy || !confirmed}
                onClick={() =>
                  onAction({ unitId: unit.id, action: "complete" })
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                Confirm learning completed
              </Button>
            </div>
          )}
          {editable && questions.length > 0 && question && (
            <div style={{ marginTop: 25 }}>
              <div className="lrn-meter-label">
                <span>Knowledge assessment</span>
                <strong>
                  {answered} / {questions.length} answered
                </strong>
              </div>
              <Meter
                label="Quiz questions answered"
                value={(answered / questions.length) * 100}
              />
              <div className="lrn-question-index" aria-label="Go to question">
                {questions.map((item, i) => (
                  <button
                    key={item.id}
                    className={`${Number.isInteger(answers[item.id]) ? "answered" : ""} ${questionIndex === i ? "current" : ""}`}
                    aria-label={`Question ${i + 1}${Number.isInteger(answers[item.id]) ? ", answered" : ""}`}
                    aria-current={questionIndex === i ? "step" : undefined}
                    onClick={() => setQuestionIndex(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <fieldset className="lrn-quiz">
                <legend>
                  {questionIndex + 1}. {question.text}
                </legend>
                {question.answers.map((answer, index) => (
                  <label key={index}>
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={index}
                      checked={answers[question.id] === index}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: index,
                        }))
                      }
                    />
                    <span>{answer}</span>
                  </label>
                ))}
              </fieldset>
              <div className="lrn-quiz-nav">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={questionIndex === 0}
                  onClick={() => setQuestionIndex((i) => i - 1)}
                >
                  <ArrowLeft size={13} />
                  Previous
                </Button>
                <span>
                  Question {questionIndex + 1} of {questions.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={questionIndex === questions.length - 1}
                  onClick={() => setQuestionIndex((i) => i + 1)}
                >
                  Next
                  <ArrowRight size={13} />
                </Button>
              </div>
              <Button
                disabled={busy || answered !== questions.length}
                onClick={() =>
                  onAction({ unitId: unit.id, action: "submit", answers })
                }
                style={{ marginTop: 17 }}
              >
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <FileCheck2 size={15} />
                )}{" "}
                {feedback ? "Resubmit assessment" : "Submit assessment"}
              </Button>
              <p className="lrn-copy" style={{ fontSize: 10, marginTop: 9 }}>
                Answer every question before submitting. Your responses are
                saved when you submit.
              </p>
            </div>
          )}
          {remediationPending && (
            <div className="lrn-callout amber" style={{ marginTop: 20 }}>
              <BookOpen size={18} />
              <div>
                <strong>Complete the assigned review first</strong>New
                remediation modules have been added to your Learning Path.
                Finish them to unlock another assessment attempt.
              </div>
            </div>
          )}
          {allowRevision && (
            <div className="lrn-callout amber" style={{ marginTop: 20 }}>
              <FileCheck2 size={18} />
              <div>
                <strong>Mentor revision requested</strong>Update your project
                below and submit it for another assessment and mentor review.
              </div>
            </div>
          )}
          {unit.type === "MENTOR_SESSION" && unit.status !== "COMPLETED" && (
            <div className="lrn-callout blue" style={{ marginTop: 20 }}>
              <ShieldCheck size={18} />
              <div>
                <strong>Human validation required</strong>A mentor records this
                evidence after reviewing your work in the HR development
                workspace. This unit cannot be self-certified.
              </div>
            </div>
          )}
          {editable &&
            !isReading &&
            unit.type !== "MENTOR_SESSION" &&
            questions.length === 0 && (
              <div style={{ marginTop: 24 }}>
                <label className="lrn-field" htmlFor={`submission-${unit.id}`}>
                  Your solution
                  <textarea
                    id={`submission-${unit.id}`}
                    value={submission}
                    onChange={(e) => setSubmission(e.target.value)}
                    maxLength={20000}
                    placeholder="Explain your design, assumptions and tradeoffs. Address the rubric dimensions with concrete implementation and validation steps."
                    rows={10}
                  />
                </label>
                <div className="lrn-word-count">
                  <span>
                    {words} words · {submission.length.toLocaleString()} /
                    20,000 characters
                  </span>
                  <span>Saved on submission</span>
                </div>
                <Button
                  disabled={busy || submission.trim().length < 80}
                  onClick={() =>
                    onAction({ unitId: unit.id, action: "submit", submission })
                  }
                >
                  {busy ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <FileCheck2 size={15} />
                  )}{" "}
                  {feedback
                    ? "Submit revised solution"
                    : "Submit for assessment"}
                </Button>
                <p className="lrn-copy" style={{ fontSize: 10, marginTop: 9 }}>
                  Provide at least 80 characters. Specific reasoning gives the
                  evaluator useful evidence.
                </p>
              </div>
            )}
          {unit.canSkip && editable && (
            <div className="lrn-callout blue" style={{ marginTop: 20 }}>
              <Sparkles size={18} />
              <div>
                <strong>Advanced route unlocked</strong>Your assessment score
                qualifies you to skip this basic practice. No mastery points are
                granted for skipped work.
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      onAction({ unitId: unit.id, action: "skip" })
                    }
                    style={{ marginTop: 12 }}
                  >
                    Skip eligible basic practice
                    <ArrowRight size={13} />
                  </Button>
                </div>
              </div>
            </div>
          )}
          {unit.status === "COMPLETED" && !allowRevision && (
            <div className="lrn-callout" style={{ marginTop: 20 }}>
              <CheckCircle2 size={18} />
              <div>
                <strong>
                  {unit.progress?.skipped
                    ? "Basic practice skipped"
                    : "Module completed"}
                </strong>
                {unit.progress?.skipped
                  ? "Your assessment qualified you for the advanced route."
                  : `${unit.progress?.masteryPoints ?? 0} mastery points recorded. Final verification determines the skill gain.`}
              </div>
            </div>
          )}
          {!editable && unit.progress?.submission && (
            <details style={{ marginTop: 20 }}>
              <summary className="text-link">
                View your submitted solution
              </summary>
              <div className="lrn-content">
                <p>{unit.progress.submission}</p>
              </div>
            </details>
          )}
          {feedback && <AssessmentFeedback feedback={feedback} unit={unit} />}
        </>
      )}
    </section>
  );
}

function dimensionLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (v) => v.toUpperCase());
}
function AssessmentFeedback({
  feedback,
  unit,
}: {
  feedback: AssessmentEvaluation;
  unit: LearningUnitView;
}) {
  return (
    <section
      className="lrn-feedback"
      aria-label="Assessment feedback"
      aria-live="polite"
    >
      <div className="flex-between">
        <div className="eyebrow">YOUR ASSESSMENT FEEDBACK</div>
        <Badge tone="neutral">
          {feedback.source === "llm"
            ? "AI evaluation"
            : "Deterministic demo evaluation"}
        </Badge>
      </div>
      <div className="lrn-score">
        <div className={`lrn-score-number ${feedback.score < 70 ? "low" : ""}`}>
          {feedback.score}%
        </div>
        <div>
          <h3>
            {feedback.score >= 85
              ? "Strong result · advanced route"
              : feedback.score >= 70
                ? "Assessment passed"
                : "Review and try again"}
          </h3>
          <p>
            {feedback.totalQuestions !== undefined
              ? `${feedback.correctAnswers} of ${feedback.totalQuestions} correct answers. `
              : ""}
            {feedback.score < 70
              ? "Focused remediation has been added to your path. No skill gain is granted for a failed assessment."
              : "This result contributes to mastery. Skill advancement still requires final verification."}
          </p>
        </div>
      </div>
      {Object.keys(feedback.dimensions).length > 0 && (
        <div className="lrn-rubric">
          {Object.entries(feedback.dimensions).map(([name, value]) => {
            const max = unit.rubric?.[name];
            return (
              <div key={name}>
                <div className="lrn-meter-label">
                  <span>{dimensionLabel(name)}</span>
                  <strong>
                    {value}
                    {max ? ` / ${max}` : ""}
                  </strong>
                </div>
                {max && (
                  <Meter
                    label={dimensionLabel(name)}
                    value={(value / max) * 100}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="lrn-feedback-grid">
        <div>
          <h4>What worked</h4>
          <ul>
            {feedback.strengths.map((strength, i) => (
              <li key={i}>{strength}</li>
            ))}
          </ul>
          {!feedback.strengths.length && (
            <p className="lrn-copy">
              Use the review guidance to strengthen the next attempt.
            </p>
          )}
        </div>
        <div>
          <h4>What to improve</h4>
          <ul>
            {feedback.improvements.map((improvement, i) => (
              <li key={i}>{improvement}</li>
            ))}
          </ul>
          {!feedback.improvements.length && (
            <p className="lrn-copy">
              Continue to the next step in your learning path.
            </p>
          )}
        </div>
      </div>
      {feedback.weakTopics.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {feedback.weakTopics.map((topic) => (
            <Badge key={topic} tone="amber">
              {topic}
            </Badge>
          ))}
        </div>
      )}
      {feedback.nextTaskSuggestion && (
        <div className={`lrn-callout ${feedback.score < 70 ? "amber" : ""}`}>
          <BookOpen size={17} />
          <div>
            <strong>Recommended next step</strong>
            {feedback.nextTaskSuggestion}
          </div>
        </div>
      )}
      {!!feedback.questionResults?.length && (
        <details style={{ marginTop: 17 }}>
          <summary className="text-link">Review question explanations</summary>
          <div style={{ marginTop: 14 }}>
            {feedback.questionResults.map((result, i) => {
              const question = unit.content.questions?.find(
                (q) => q.id === result.id,
              );
              return (
                <div
                  key={result.id}
                  style={{
                    padding: "14px 0",
                    borderBottom: "1px solid #e8eee3",
                  }}
                >
                  <div className="chip-row">
                    <Badge tone={result.correct ? "green" : "amber"}>
                      {result.correct ? "Correct" : "Review"}
                    </Badge>
                    <strong style={{ fontSize: 12 }}>
                      {i + 1}. {question?.text ?? "Assessment question"}
                    </strong>
                  </div>
                  {question && (
                    <p className="lrn-copy" style={{ marginTop: 8 }}>
                      Correct answer: {question.answers[result.correctAnswer]}
                    </p>
                  )}
                  <p className="lrn-copy" style={{ marginTop: 5 }}>
                    {result.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </details>
      )}
      <p className="lrn-copy" style={{ fontSize: 10, marginTop: 14 }}>
        Attempt {unit.progress?.attempts ?? 1}. Scores reflect the configured
        rubric and synthetic demo evaluator.
      </p>
    </section>
  );
}

export function EvidenceList({ evidence }: { evidence: SkillEvidenceView[] }) {
  if (!evidence.length)
    return (
      <Empty
        title="Your evidence starts here"
        description="Complete a learning unit or submit assessed work. Supporting evidence will appear here as you develop your skills."
      />
    );
  return (
    <div className="lrn-evidence-list">
      {evidence.map((item) => (
        <article className="lrn-evidence" key={item.id}>
          <div className="lrn-evidence-icon">
            {item.verified ? (
              <ShieldCheck size={20} />
            ) : (
              <FileCheck2 size={20} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="chip-row" style={{ marginBottom: 8 }}>
              <Badge tone={item.verified ? "green" : "neutral"}>
                {item.verified ? "Verified" : "Supporting evidence"}
              </Badge>
              <span className="lrn-unit-meta">{label(item.type)}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <div className="lrn-unit-meta" style={{ marginTop: 10 }}>
              <span>
                {item.skillName} · level {item.level}
              </span>
              {item.score !== null && <span>Score {item.score}%</span>}
              <span>Confidence* {item.confidence}%</span>
            </div>
            <small>
              {new Date(item.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {item.verifiedAt ? " · Verified for skill advancement" : ""}
            </small>
          </div>
        </article>
      ))}
      <p className="lrn-copy" style={{ fontSize: 10 }}>
        *Confidence is a demo evidence heuristic. Supporting evidence by itself
        does not advance a skill.
      </p>
    </div>
  );
}
