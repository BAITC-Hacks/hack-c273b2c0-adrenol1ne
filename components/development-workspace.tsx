"use client";

import { useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Layers3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import type {
  DevelopmentPathReport,
  DevelopmentReport,
  LearningPathDraft,
  LearningUnitDefinition,
} from "@/lib/learning-types";
import { Shell } from "./shell";
import { Badge, Empty, Heading } from "./shared";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

const formatDuration = (minutes: number | null) =>
  minutes === null
    ? "—"
    : minutes >= 60
      ? `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`
      : `${Math.round(minutes)}m`;
const typeLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (v) => v.toUpperCase());
type Approval = DevelopmentReport["approvals"][number];

export function DevelopmentWorkspace({
  initial,
}: {
  initial: DevelopmentReport;
}) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DevelopmentPathReport | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [skillId, setSkillId] = useState(
    initial.skills.find((s) => s.name === "System Design")?.id ??
      initial.skills[0]?.id ??
      "",
  );
  const [fromLevel, setFromLevel] = useState(2);
  const [toLevel, setToLevel] = useState(3);
  const [audience, setAudience] = useState("Backend Engineers");
  const [draft, setDraft] = useState<LearningPathDraft | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const paths = data.paths.filter((path) =>
    `${path.title} ${path.skillName} ${path.audience}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function refresh() {
    const response = await fetch("/api/hr/development", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "Unable to refresh development data.");
    setData(result as DevelopmentReport);
  }
  async function refreshClick() {
    setBusy("refresh");
    setError("");
    try {
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to refresh.");
    } finally {
      setBusy("");
    }
  }
  async function generate() {
    setBusy("draft");
    setError("");
    setDraft(null);
    setReviewed(false);
    try {
      const response = await fetch("/api/hr/development/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, fromLevel, toLevel, audience }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not generate this learning path.",
        );
      setDraft(result as LearningPathDraft);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not generate this learning path.",
      );
    } finally {
      setBusy("");
    }
  }
  async function publish() {
    if (!draft || !reviewed) return;
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/hr/development/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Could not publish this learning path.",
        );
      await refresh();
      setNotice(
        `“${draft.title}” was reviewed and published to the development catalog.`,
      );
      setBuilderOpen(false);
      setDraft(null);
      setReviewed(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not publish this learning path.",
      );
    } finally {
      setBusy("");
    }
  }
  async function approve(
    enrollmentId: string,
    approved: boolean,
    comment: string,
  ) {
    setBusy(enrollmentId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/hr/development/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, approved, comment }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not save the mentor decision.");
      setData(result as DevelopmentReport);
      setNotice(
        approved
          ? "Mentor validation approved. The employee can refresh their workspace and verify the skill advancement."
          : "Revision requested. Your feedback is available in the employee's activity workspace.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save the mentor decision.",
      );
    } finally {
      setBusy("");
    }
  }
  function updateDraft(patch: Partial<LearningPathDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : null));
    setReviewed(false);
  }
  return (
    <Shell role="HR" name="People & Culture">
      <div className="learning-workspace">
        <Heading
          eyebrow="DEVELOPMENT INTELLIGENCE"
          title="Learning that builds capability"
          description="Manage development content, inspect assessment outcomes and validate evidence behind skill advancement."
          action={
            <Button
              onClick={() => {
                setBuilderOpen(true);
                setError("");
              }}
            >
              <Plus size={16} /> Create learning path
            </Button>
          }
        />
        {error && !builderOpen && (
          <div role="alert" className="lrn-callout error">
            <TriangleAlert size={18} />
            <div>{error}</div>
          </div>
        )}
        {notice && (
          <div role="status" className="lrn-callout">
            <CheckCircle2 size={18} />
            <div>{notice}</div>
          </div>
        )}
        <div className="dev-summary">
          <div className="dev-kpi">
            <span>
              <Layers3 size={16} />
              Learning paths
            </span>
            <strong>{data.metrics.learningPaths}</strong>
            <small>
              Employees who started: {data.metrics.employeesStarted}
            </small>
          </div>
          <div className="dev-kpi">
            <span>
              <CheckCircle2 size={16} />
              Verified completion
            </span>
            <strong>{data.metrics.completionRate}%</strong>
            <small>Employees with a verified completion: {data.metrics.employeesCompleted}</small>
          </div>
          <div className="dev-kpi">
            <span>
              <ChartNoAxesCombined size={16} />
              Assessment performance
            </span>
            <strong>
              {data.metrics.averageAssessmentScore === null
                ? "—"
                : `${data.metrics.averageAssessmentScore}%`}
            </strong>
            <small>Mean submitted assessment score</small>
          </div>
          <div className="dev-kpi">
            <span>
              <Target size={16} />
              Skills developed
            </span>
            <strong>{data.metrics.skillsDeveloped}</strong>
            <small>
              Mean time to mastery:{" "}
              {formatDuration(data.metrics.averageTimeToMasteryMinutes)}
            </small>
          </div>
        </div>
        <div className="lrn-callout">
          <ShieldCheck size={20} />
          <div>
            <strong>
              Measure verified development separately from content consumption.
            </strong>
            Completion rates reflect verified learning journeys. Assessments,
            mastery points and mentor decisions determine whether a skill can
            advance. The dashboard groups outcomes by learning content.
          </div>
        </div>
        <div className="dev-content-grid">
          <section className="lrn-card">
            <div className="lrn-card-head">
              <div>
                <div className="eyebrow">DEVELOPMENT LIBRARY</div>
                <h2>Learning paths</h2>
                <p>
                  Explore participation, outcomes and where support is needed.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshClick}
                disabled={!!busy}
                aria-label="Refresh development report"
              >
                <RefreshCw
                  size={16}
                  className={busy === "refresh" ? "spin" : ""}
                />
              </Button>
            </div>
            <label className="lrn-field" style={{ marginBottom: 20 }}>
              <span className="sr-only">Search learning paths</span>
              <div style={{ position: "relative" }}>
                <Search
                  size={15}
                  style={{
                    position: "absolute",
                    left: 13,
                    top: 14,
                    color: "#899b82",
                  }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by path, skill or audience…"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </label>
            <div className="dev-paths">
              {paths.map((path) => (
                <button
                  className="dev-path-card"
                  key={path.id}
                  onClick={() => setSelected(path)}
                >
                  <div className="dev-path-top">
                    <div>
                      <div className="chip-row">
                        <Badge tone="green">
                          {path.skillName} · {path.fromLevel} → {path.toLevel}
                        </Badge>
                        {path.requiresApproval && (
                          <Badge tone="amber">
                            <ShieldCheck size={11} />
                            Mentor review
                          </Badge>
                        )}
                      </div>
                      <h3>{path.title}</h3>
                      <p>
                        {path.audience} · {path.units} modules ·{" "}
                        {formatDuration(path.estimatedMinutes)}
                      </p>
                    </div>
                    <ChevronRight size={17} className="muted" />
                  </div>
                  <div className="dev-path-bottom">
                    <div>
                      <span>Employees started</span>
                      <strong>{path.employeesStarted}</strong>
                    </div>
                    <div>
                      <span>Verified completion</span>
                      <strong>{path.completionRate}%</strong>
                    </div>
                    <div>
                      <span>Mean assessment</span>
                      <strong>
                        {path.averageAssessmentScore === null
                          ? "—"
                          : `${path.averageAssessmentScore}%`}
                      </strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {!paths.length && (
              <Empty
                title="No matching learning paths"
                description="Try another skill or create a reviewed development path for your audience."
              />
            )}
          </section>
          <div className="lrn-main">
            <section className="lrn-card">
              <div className="lrn-card-head">
                <div>
                  <div className="eyebrow">HUMAN VALIDATION</div>
                  <h2>Mentor review queue</h2>
                  <p>
                    Review submitted evidence before an employee verifies their
                    skill gain.
                  </p>
                </div>
                <Badge tone={data.approvals.length ? "amber" : "neutral"}>
                  {data.approvals.length}
                </Badge>
              </div>
              {data.approvals.length ? (
                data.approvals.map((item) => (
                  <ApprovalCard
                    key={item.enrollmentId}
                    item={item}
                    busy={!!busy}
                    onDecision={approve}
                  />
                ))
              ) : (
                <div className="lrn-inline-empty">
                  <ShieldCheck
                    size={27}
                    style={{ margin: "0 auto 10px", display: "block" }}
                  />
                  No projects waiting for validation.
                  <br />
                  Eligible submissions appear here after required assessments
                  and mastery are complete.
                </div>
              )}
            </section>
            <section className="lrn-card">
              <span className="eyebrow">CONTENT STUDIO</span>
              <h3 style={{ margin: "12px 0 9px" }}>
                Build the next development path
              </h3>
              <p className="lrn-copy">
                Define the skill, level change and audience. Review objectives,
                exercises and assessment requirements before publishing.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setBuilderOpen(true);
                  setError("");
                }}
                style={{ marginTop: 17 }}
              >
                <Sparkles size={15} /> Create learning path
              </Button>
              <p className="lrn-copy" style={{ fontSize: 10, marginTop: 12 }}>
                The MVP uses deterministic templates. Every generated path
                remains a draft until an HR reviewer explicitly publishes it.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="dev-builder">
          {selected && (
            <>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                LEARNING PATH PERFORMANCE
              </div>
              <DialogTitle>{selected.title}</DialogTitle>
              <DialogDescription>
                {selected.skillName} · level {selected.fromLevel} →{" "}
                {selected.toLevel} · {selected.audience}
              </DialogDescription>
              <div className="dev-detail-metrics">
                <div>
                  <span>Employees started</span>
                  <strong>{selected.employeesStarted}</strong>
                </div>
                <div>
                  <span>Employees completed</span>
                  <strong>{selected.employeesCompleted}</strong>
                </div>
                <div>
                  <span>Skill advancements</span>
                  <strong>{selected.skillAdvancements}</strong>
                </div>
                <div>
                  <span>Average assessment score</span>
                  <strong>
                    {selected.averageAssessmentScore === null
                      ? "—"
                      : `${selected.averageAssessmentScore}%`}
                  </strong>
                </div>
              </div>
              <div className="lrn-callout blue">
                <Clock3 size={18} />
                <div>
                  <strong>
                    Average time to verified mastery:{" "}
                    {formatDuration(selected.averageTimeToMasteryMinutes)}
                  </strong>
                  Elapsed time from enrollment to verification, across completed
                  journeys. Learning content is estimated at{" "}
                  {formatDuration(selected.estimatedMinutes)}.
                </div>
              </div>
              <h3 style={{ margin: "23px 0 7px", fontSize: 16 }}>
                Module progression
              </h3>
              <p className="lrn-copy">
                Started, completed and failed counts help locate content that
                needs attention.
              </p>
              <div className="dev-dropoff">
                {selected.unitStats.map((unit, i) => (
                  <div key={unit.id}>
                    <div>
                      <div className="flex-between" style={{ marginBottom: 7 }}>
                        <span>
                          {String(i + 1).padStart(2, "0")} · {unit.title}
                        </span>
                        <small>{unit.failed} failed</small>
                      </div>
                      <div className="lrn-meter">
                        <span
                          style={{
                            width: `${unit.started ? Math.round((unit.completed / unit.started) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <strong>
                      {unit.completed}/{unit.started}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="lrn-callout amber">
                <BookOpen size={18} />
                <div>
                  <strong>Largest current drop-off</strong>
                  {selected.dropOffPoint ??
                    "Not enough participation data yet."}
                </div>
              </div>
              <p className="lrn-copy" style={{ fontSize: 10, marginTop: 13 }}>
                This view describes content engagement and evidence outcomes.
                Small synthetic demo cohorts are not representative of workforce
                performance.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={builderOpen}
        onOpenChange={(open) => {
          if (!busy) {
            setBuilderOpen(open);
            setError("");
          }
        }}
      >
        <DialogContent className="dev-builder">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            AI LEARNING PATH BUILDER · PROTOTYPE
          </div>
          <DialogTitle>Create a learning path</DialogTitle>
          <DialogDescription>
            Start with a skill goal. Review the generated draft and confirm
            publication.
          </DialogDescription>
          {error && (
            <div
              role="alert"
              className="lrn-callout error"
              style={{ marginTop: 16 }}
            >
              <TriangleAlert size={17} />
              <div>{error}</div>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <div className="lrn-form-grid">
              <label className="lrn-field wide">
                Target skill
                <select
                  required
                  value={skillId}
                  onChange={(e) => {
                    setSkillId(e.target.value);
                    setDraft(null);
                    setReviewed(false);
                  }}
                  disabled={!!busy}
                >
                  {data.skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lrn-field">
                From level
                <select
                  value={fromLevel}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setFromLevel(value);
                    if (toLevel <= value) setToLevel(value + 1);
                    setDraft(null);
                    setReviewed(false);
                  }}
                  disabled={!!busy}
                >
                  {[0, 1, 2, 3, 4].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lrn-field">
                To level
                <select
                  value={toLevel}
                  onChange={(e) => {
                    setToLevel(Number(e.target.value));
                    setDraft(null);
                    setReviewed(false);
                  }}
                  disabled={!!busy}
                >
                  {[1, 2, 3, 4, 5]
                    .filter((level) => level > fromLevel)
                    .map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                </select>
              </label>
              <label className="lrn-field wide">
                Audience
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={audience}
                  onChange={(e) => {
                    setAudience(e.target.value);
                    setDraft(null);
                    setReviewed(false);
                  }}
                  placeholder="For example, Backend Engineers"
                  disabled={!!busy}
                />
              </label>
            </div>
            <Button
              type="submit"
              variant={draft ? "outline" : "default"}
              disabled={!!busy || !skillId || audience.trim().length < 3}
            >
              {busy === "draft" ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Sparkles size={15} />
              )}{" "}
              {draft ? "Regenerate draft" : "Generate draft"}
            </Button>
          </form>
          {draft && (
            <section className="dev-draft">
              <div className="flex-between">
                <Badge tone="amber">Unpublished draft</Badge>
                <Badge tone="neutral">Deterministic generator</Badge>
              </div>
              <h3>Review your development path</h3>
              <p className="lrn-copy">
                Check the learning objectives, required work and verification
                rules. Confirm only when the draft is appropriate for the
                intended audience.
              </p>
              <div className="lrn-form-grid">
                <label className="lrn-field wide">
                  Path title
                  <input
                    value={draft.title}
                    maxLength={200}
                    onChange={(e) => updateDraft({ title: e.target.value })}
                  />
                </label>
                <label className="lrn-field wide">
                  Description
                  <textarea
                    value={draft.description}
                    onChange={(e) =>
                      updateDraft({ description: e.target.value })
                    }
                    style={{ minHeight: 80 }}
                    maxLength={2000}
                  />
                </label>
                <label className="lrn-field wide">
                  Learning objectives · one per line
                  <textarea
                    value={draft.learningObjectives.join("\n")}
                    onChange={(e) =>
                      updateDraft({
                        learningObjectives: e.target.value.split("\n"),
                      })
                    }
                    style={{ minHeight: 110 }}
                    maxLength={4000}
                  />
                </label>
              </div>
              <div className="dev-draft-meta">
                <span>
                  <Clock3
                    size={12}
                    style={{ verticalAlign: "middle", marginRight: 4 }}
                  />
                  {formatDuration(draft.estimatedMinutes)}
                </span>
                <span>{draft.units.length} modules</span>
                <span>Mastery threshold: {draft.masteryThreshold} / 100</span>
                <span>
                  Mentor approval:{" "}
                  {draft.requiresApproval ? "Required" : "Not required"}
                </span>
              </div>
              <ol className="dev-draft-units">
                {draft.units.map((unit, i) => (
                  <DraftUnit key={unit.id} unit={unit} index={i} />
                ))}
              </ol>
              <div className="lrn-callout">
                <ShieldCheck size={18} />
                <div>
                  <strong>Verification is built into the path</strong>Content
                  completion contributes progress. Required assessment outcomes,
                  mastery and any mentor validation must be satisfied before a
                  configured skill gain is awarded.
                </div>
              </div>
              <label className="dev-confirm">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                <span>
                  I reviewed the objectives, modules and assessment
                  requirements, and approve this path for publication to the
                  development catalog.
                </span>
              </label>
              <div className="lrn-actions">
                <Button
                  disabled={
                    !!busy ||
                    !reviewed ||
                    draft.title.trim().length < 3 ||
                    !draft.learningObjectives.some((v) => v.trim())
                  }
                  onClick={publish}
                >
                  {busy === "save" ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  Publish reviewed path
                </Button>
                <Button
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => {
                    setDraft(null);
                    setReviewed(false);
                  }}
                >
                  Discard draft
                </Button>
              </div>
            </section>
          )}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function ApprovalCard({
  item,
  busy,
  onDecision,
}: {
  item: Approval;
  busy: boolean;
  onDecision: (id: string, approved: boolean, comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  return (
    <article className="dev-approval">
      <h3>{item.employeeName}</h3>
      <p>{item.activityName}</p>
      <div className="chip-row" style={{ marginBottom: 13 }}>
        <Badge tone="green">{item.masteryPoints} mastery points</Badge>
        {item.projectScore !== null && (
          <Badge tone="neutral">Project {item.projectScore}%</Badge>
        )}
      </div>
      <p className="lrn-copy" style={{ fontSize: 10 }}>
        Submitted{" "}
        {new Date(item.submittedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })}
        . Approval records mentor validation; the employee completes final skill
        verification separately.
      </p>
      {item.projectSubmission && (
        <details style={{ marginBottom: 12 }}>
          <summary className="text-link" style={{ fontSize: 11 }}>
            Review submitted project
          </summary>
          <div className="lrn-content" style={{ fontSize: 11 }}>
            <p>{item.projectSubmission}</p>
            {item.projectFeedback && (
              <>
                <strong>Evaluator feedback</strong>
                <ul>
                  {item.projectFeedback.improvements.map((improvement, i) => (
                    <li key={i}>{improvement}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </details>
      )}
      <label className="lrn-field">
        Mentor comment
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Record your validation or explain the changes needed…"
          maxLength={2000}
        />
      </label>
      <div className="lrn-actions">
        <Button
          disabled={busy}
          onClick={() => onDecision(item.enrollmentId, true, comment)}
        >
          <CheckCircle2 size={13} />
          Approve
        </Button>
        <Button
          variant="outline"
          disabled={busy || comment.trim().length < 3}
          onClick={() => onDecision(item.enrollmentId, false, comment)}
        >
          <X size={13} />
          Request revision
        </Button>
      </div>
      <p className="lrn-copy" style={{ fontSize: 9, margin: "8px 0 0" }}>
        A comment is required when requesting a revision.
      </p>
    </article>
  );
}
function DraftUnit({
  unit,
  index,
}: {
  unit: LearningUnitDefinition;
  index: number;
}) {
  return (
    <li>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div style={{ minWidth: 0 }}>
        <strong>{unit.title}</strong>
        <p>
          {typeLabel(unit.type)} · {formatDuration(unit.estimatedMinutes)} ·{" "}
          {unit.required ? "Required" : "Optional"} · {unit.masteryPoints}{" "}
          mastery points
        </p>
        <details style={{ marginTop: 7 }}>
          <summary className="text-link" style={{ fontSize: 10 }}>
            Review content and requirements
          </summary>
          <div className="lrn-copy" style={{ fontSize: 11, marginTop: 8 }}>
            <p>{unit.description}</p>
            {unit.content.prompt && (
              <p style={{ marginTop: 7 }}>{unit.content.prompt}</p>
            )}
            {unit.content.sections?.map((section, i) => (
              <div key={i} style={{ marginTop: 9 }}>
                <strong>{section.title}</strong>
                <p>{section.body}</p>
              </div>
            ))}
            {unit.completionRequirement && (
              <p style={{ marginTop: 8 }}>
                <strong>Completion: </strong>
                {unit.completionRequirement}
              </p>
            )}
            {unit.content.questions && (
              <p style={{ marginTop: 8 }}>
                {unit.content.questions.length} assessment questions with
                validated answer keys.
              </p>
            )}
          </div>
        </details>
      </div>
    </li>
  );
}
