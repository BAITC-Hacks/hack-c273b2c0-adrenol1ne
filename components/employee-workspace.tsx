"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Target,
  Check,
  Clock3,
  ChevronRight,
  ShieldCheck,
  GitBranch,
  LockKeyhole,
  BookOpen,
  Layers3,
  CheckCircle2,
  Search,
  Rocket,
  Network,
  TrendingUp,
  X,
  Info,
  LoaderCircle,
  CircleHelp,
} from "lucide-react";
import type {
  Activity,
  Candidate,
  Explanation,
  History,
  Skill,
  Snapshot,
} from "@/lib/types";
import {
  readiness,
  requirementsFor,
  scoreActivity,
  WEIGHTS,
} from "@/lib/recommendation-engine";
import { Shell } from "./shell";
import { Badge, Empty, Heading, ReadinessRing, SectionHeading } from "./shared";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Progress } from "./ui/progress";

const factorNames: Record<string, string> = {
  critical_skill_gap: "Critical skill gap",
  next_grade_relevance: "Next-grade relevance",
  completion_probability: "Completion probability",
  career_goal_alignment: "Career goal alignment",
  activity_skill_gain: "Attainable skill gain",
  business_priority: "Business priority",
  diversity_bonus: "Learning diversity",
  skip_penalty: "Skip / decline penalty",
};
export function EmployeeWorkspace({
  initial,
  section,
  hrView = false,
}: {
  initial: Snapshot;
  section: string;
  hrView?: boolean;
}) {
  const [state, setState] = useState(initial),
    [selected, setSelected] = useState<Candidate | null>(null),
    [explanation, setExplanation] = useState<Explanation | null>(null),
    [explaining, setExplaining] = useState(false),
    [whyNot, setWhyNot] = useState(false),
    [skillDetail, setSkillDetail] = useState<Skill | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [completed, setCompleted] = useState<{
      before: number;
      after: number;
      changes: { skillId: string; from: number; to: number }[];
    } | null>(null),
    [filter, setFilter] = useState("Recommended"),
    [search, setSearch] = useState(""),
    [requirementsOpen, setRequirementsOpen] = useState(false);
  const explanationVersion = useRef(0);
  const employeeBase = hrView
    ? `/hr/employees/${state.employee.id}`
    : "/employee";
  const employee = state.employee,
    req = requirementsFor(employee, state.requirements),
    ready = readiness(employee, state.requirements),
    best = state.recommendations[0],
    target = `${employee.targetGrade} ${employee.targetRole}`;
  const gaps = req.filter(
    (r) =>
      (employee.skills.find((s) => s.skillId === r.skillId)?.level ?? 0) <
      r.requiredLevel,
  );
  const completedHistory = employee.history.filter(
    (h) => h.status === "COMPLETED",
  );
  const skillName = (id: string) =>
    state.skills.find((s) => s.id === id)?.name ?? id;
  async function explain(candidate: Candidate) {
    const version = ++explanationVersion.current;
    setSelected(candidate);
    setExplanation(candidate.explanation);
    setWhyNot(false);
    setExplaining(true);
    try {
      const r = await fetch(
        `/api/explanation?eventId=${encodeURIComponent(candidate.activity.id)}${hrView ? `&employeeId=${encodeURIComponent(employee.id)}` : ""}`,
      );
      if (r.ok) {
        const result = await r.json();
        if (version === explanationVersion.current) setExplanation(result);
      }
    } catch {
      // The auditable local explanation is already visible when the network fails.
    } finally {
      if (version === explanationVersion.current) setExplaining(false);
    }
  }
  async function activityAction(eventId: string, status: History["status"]) {
    if (hrView) return;
    setBusy(eventId);
    setError("");
    try {
      const response = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState(data.state);
      if (status === "COMPLETED") {
        setSelected(null);
        setCompleted({
          before: ready,
          after: readiness(data.state.employee, data.state.requirements),
          changes: data.changes,
        });
      } else {
        setSelected(null);
        setToast(
          status === "IN_PROGRESS"
            ? "Activity started. Find it under In progress."
            : "Preference saved. Your recommendations have been recalculated.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update activity");
    } finally {
      setBusy("");
    }
  }
  async function changeTarget(role: string, grade: string) {
    setBusy(role);
    setError("");
    try {
      const r = await fetch("/api/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, grade }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setState(data);
      setToast(
        `Career target updated to ${grade} ${role}. Your next steps are ready.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update target");
    } finally {
      setBusy("");
    }
  }
  function activityCard(activity: Activity, index?: number) {
    const candidate = scoreActivity(
      employee,
      activity,
      state.events,
      state.requirements,
      state.skills,
    );
    const status = employee.history.find(
      (h) => h.eventId === activity.id,
    )?.status;
    return (
      <article className="activity-card card" key={activity.id}>
        <div className="activity-card-top">
          <span
            className={`activity-icon ${activity.type === "Mission" ? "purple" : ""}`}
          >
            {activity.type === "Mission" ? (
              <Rocket size={22} />
            ) : (
              <Layers3 size={22} />
            )}
          </span>
          {typeof index === "number" ? (
            <Badge tone={index === 0 ? "green" : "neutral"}>
              {index === 0
                ? "Best next step"
                : `Match ${Math.round(candidate.score * 100)}%`}
            </Badge>
          ) : (
            <Badge tone={status === "COMPLETED" ? "green" : "neutral"}>
              {status?.replaceAll("_", " ").toLowerCase() ?? activity.type}
            </Badge>
          )}
        </div>
        <span className="eyebrow">{activity.category}</span>
        <h3>{activity.name}</h3>
        <p>{activity.description}</p>
        <div className="activity-skills">
          {candidate.changes.map((c) => (
            <span key={c.skillId}>
              {skillName(c.skillId)}{" "}
              <strong>
                {c.from} → {c.to}
              </strong>
            </span>
          ))}
        </div>
        <div className="activity-card-footer">
          <span>
            <Clock3 size={14} />
            {activity.hours} hours
          </span>
          <span className="green-text">
            +{candidate.after - candidate.before}% readiness
          </span>
        </div>
        <Button
          variant="outline"
          className="full-width"
          onClick={() => explain(candidate)}
        >
          View activity <ArrowUpRight size={16} />
        </Button>
      </article>
    );
  }
  function matrix(compact = false) {
    return (
      <div className={`skill-table ${compact ? "compact" : ""}`}>
        <div className="skill-table-head">
          <span>COMPETENCY</span>
          <span>CURRENT LEVEL</span>
          <span>TARGET</span>
          <span>STATUS</span>
        </div>
        {(compact
          ? req.map((r) => state.skills.find((s) => s.id === r.skillId)!)
          : state.skills.filter((s) =>
              employee.skills.some((e) => e.skillId === s.id),
            )
        )
          .filter(Boolean)
          .map((s) => {
            const level =
                employee.skills.find((x) => x.skillId === s.id)?.level ?? 0,
              required =
                req.find((r) => r.skillId === s.id)?.requiredLevel ?? 0,
              gap = Math.max(0, required - level);
            return (
              <button
                key={s.id}
                className="skill-table-row"
                onClick={() => setSkillDetail(s)}
              >
                <span>
                  <strong>{s.name}</strong>
                  {!compact && <small>{s.category}</small>}
                </span>
                <span className="skill-level">
                  <span className="skill-blocks">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <i
                        key={i}
                        className={
                          i <= level ? (gap >= 2 ? "amber" : "filled") : ""
                        }
                      />
                    ))}
                  </span>
                  <strong>
                    {level}
                    <small>/5</small>
                  </strong>
                </span>
                <span>{required ? `${required}/5` : "—"}</span>
                <span>
                  {required === 0 ? (
                    <Badge tone="neutral">Exploratory</Badge>
                  ) : gap === 0 ? (
                    <Badge tone="green">
                      <Check size={12} /> On target
                    </Badge>
                  ) : (
                    <Badge tone={gap >= 2 ? "amber" : "blue"}>
                      {gap} level{gap > 1 ? "s" : ""} to go
                    </Badge>
                  )}
                </span>
              </button>
            );
          })}
      </div>
    );
  }
  const content = (
    <>
      {hrView && (
        <Link href="/hr/employees" className="text-link">
          ← Back to employees
        </Link>
      )}
      {error && (
        <div role="alert" className="error-banner">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}
      {section === "dashboard" && (
        <>
          <Heading
            eyebrow="A LITTLE PROGRESS. A BIGGER FUTURE."
            title={`Good to see you, ${employee.name.split(" ")[0]}.`}
            description="Your next chapter starts with your next step."
            action={
              <div className="date-chip">
                <span className="status-dot" /> Your career, in focus
              </div>
            }
          />
          <div className="dashboard-hero-grid">
            <section className="career-hero">
              <div className="hero-top">
                <span className="hero-tag">
                  <GitBranch size={15} /> YOUR CAREER COMPASS
                </span>
                <Link
                  href={employeeBase + "/career"}
                  aria-label="Explore career paths"
                >
                  <ArrowUpRight size={21} />
                </Link>
              </div>
              <div className="career-hero-main">
                <div>
                  <p className="hero-current">
                    {employee.role} · {employee.grade}
                  </p>
                  <h2>
                    Your next chapter:
                    <br />
                    {target}
                  </h2>
                  <p className="hero-description">
                    Your experience is the foundation.
                    <br />
                    Let’s build on it.
                  </p>
                </div>
                <ReadinessRing value={ready} />
              </div>
              <div className="career-hero-bottom">
                <span>
                  <span className="tiny-square" />
                  {gaps.length} competencies to develop
                </span>
                <span>
                  <TrendingUp size={15} />
                  {req.length - gaps.length} already on target
                </span>
              </div>
            </section>
            <section className="next-action card">
              <div className="section-heading">
                <span className="eyebrow">
                  <Sparkles size={15} /> YOUR NEXT BEST ACTION
                </span>
                <Badge>AI matched</Badge>
              </div>
              {best ? (
                <>
                  <h2>{best.activity.name}</h2>
                  <p>A focused step toward your next grade.</p>
                  <div className="next-impact">
                    <div>
                      <span>SKILL IMPACT</span>
                      <strong>
                        {skillName(best.changes[0].skillId)}{" "}
                        <b>
                          {best.changes[0].from} <ArrowRight size={14} />{" "}
                          {best.changes[0].to}
                        </b>
                      </strong>
                    </div>
                    <div>
                      <span>CAREER READINESS</span>
                      <strong>
                        {best.before}% <ArrowRight size={14} />{" "}
                        <em>{best.after}%</em>
                        <small>+{best.after - best.before}%</small>
                      </strong>
                    </div>
                  </div>
                  <div className="next-meta">
                    <span>
                      <Clock3 size={14} />
                      {best.activity.hours} hours
                    </span>
                    <span className="green-text">
                      <span className="status-dot" />
                      High career impact
                    </span>
                  </div>
                  <div className="next-buttons">
                    <Button onClick={() => explain(best)}>
                      Why this activity? <ArrowUpRight size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!!busy || hrView}
                      onClick={() =>
                        activityAction(best.activity.id, "IN_PROGRESS")
                      }
                    >
                      {busy === best.activity.id
                        ? "Starting…"
                        : employee.history.some(
                              (h) =>
                                h.eventId === best.activity.id &&
                                h.status === "IN_PROGRESS",
                            )
                          ? "In progress"
                          : "Start activity"}
                    </Button>
                  </div>
                </>
              ) : (
                <Empty
                  title="A moment to look ahead"
                  description={
                    req.length
                      ? "You have completed the available next steps. Explore another career path or check back for new activities."
                      : "Your target needs a competency framework. Ask HR to import the role requirements."
                  }
                />
              )}
            </section>
          </div>
          <div className="stat-strip">
            <div>
              <span className="stat-icon">
                <Target size={20} />
              </span>
              <div>
                <strong>
                  {ready}
                  <small>%</small>
                </strong>
                <span>Career readiness</span>
              </div>
              <Badge>Target in sight</Badge>
            </div>
            <div>
              <span className="stat-icon blue">
                <Layers3 size={20} />
              </span>
              <div>
                <strong>{employee.skills.length}</strong>
                <span>Skills in your profile</span>
              </div>
            </div>
            <div>
              <span className="stat-icon amber">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <strong>
                  {completedHistory.length.toString().padStart(2, "0")}
                </strong>
                <span>Activities completed</span>
              </div>
            </div>
            <div>
              <span className="stat-icon purple">
                <GitBranch size={20} />
              </span>
              <div>
                <strong>{state.routes.length}</strong>
                <span>Paths to explore</span>
              </div>
              <Link href={employeeBase + "/career"} aria-label="Explore paths">
                <ArrowUpRight size={19} />
              </Link>
            </div>
          </div>
          <div className="dashboard-detail-grid">
            <section className="card skills-overview">
              <SectionHeading
                title="Your skills, in perspective"
                description="Where you stand against your next-grade requirements."
                action={
                  <Link href={employeeBase + "/skills"} className="text-link">
                    View all skills <ArrowUpRight size={15} />
                  </Link>
                }
              />
              {matrix(true)}
              <div className="card-note">
                <Info size={15} /> Skills tell part of the story. Your
                experience and history matter, too.
              </div>
            </section>
            <section className="card trajectory">
              <SectionHeading
                title="The path ahead"
                description="One meaningful step at a time."
              />
              <div className="trajectory-list">
                <div className="trajectory-step done">
                  <span className="trajectory-dot">
                    <Check size={16} />
                  </span>
                  <div>
                    <strong>Junior</strong>
                    <p>A foundation well built</p>
                  </div>
                  <Badge tone="neutral">Completed</Badge>
                </div>
                <div className="trajectory-step current">
                  <span className="trajectory-dot">
                    <span />
                  </span>
                  <div>
                    <strong>{employee.grade}</strong>
                    <p>{employee.role}</p>
                  </div>
                  <Badge>You are here</Badge>
                </div>
                <button
                  className="trajectory-step next"
                  onClick={() => setRequirementsOpen(true)}
                >
                  <span className="trajectory-dot">
                    <Target size={16} />
                  </span>
                  <div>
                    <strong>{employee.targetGrade}</strong>
                    <p>{ready}% ready for your next move</p>
                  </div>
                  <ChevronRight size={18} />
                </button>
                <div className="trajectory-step locked">
                  <span className="trajectory-dot">
                    <LockKeyhole size={14} />
                  </span>
                  <div>
                    <strong>Lead</strong>
                    <p>A future worth exploring</p>
                  </div>
                </div>
              </div>
              <Link href={employeeBase + "/career"} className="text-link">
                Explore your career paths <ArrowRight size={15} />
              </Link>
            </section>
          </div>
          <section className="recommendation-section">
            <SectionHeading
              title="Made for your next move"
              description="Development opportunities with a clear connection to your goals."
              action={
                <Link href={employeeBase + "/activities"} className="text-link">
                  All activities <ArrowUpRight size={15} />
                </Link>
              }
            />
            <div className="activity-grid">
              {state.recommendations.map((c, i) => activityCard(c.activity, i))}
            </div>
          </section>
        </>
      )}
      {section === "career" && (
        <>
          <Heading
            eyebrow="YOUR CAREER DIGITAL TWIN"
            title="One profile. Many possibilities."
            description="Explore what your skills make possible, then choose the direction that matters to you."
          />
          <div className="digital-twin-flow card">
            <div>
              <span className="small-icon">
                <UserIcon />
              </span>
              <small>CURRENT STATE</small>
              <h3>
                {employee.grade} {employee.role}
              </h3>
            </div>
            <ArrowRight />
            <div>
              <span className="small-icon">
                <Layers3 size={20} />
              </span>
              <small>YOUR NEXT BRIDGE</small>
              <h3>{gaps.length} skill gaps</h3>
            </div>
            <ArrowRight />
            <div>
              <span className="small-icon">
                <Target size={20} />
              </span>
              <small>TARGET STATE</small>
              <h3>{target}</h3>
            </div>
          </div>
          <SectionHeading
            title="Choose your next chapter"
            description="Selecting a path updates your target, readiness and recommendations."
          />
          <div className="route-grid">
            {state.routes.map((route) => {
              const active =
                route.role === employee.targetRole &&
                route.grade === employee.targetGrade;
              return (
                <article
                  key={`${route.role}${route.grade}`}
                  className={`card route-card ${active ? "selected-route" : ""}`}
                >
                  <div className="flex-between">
                    <span className="small-icon">
                      <GitBranch size={22} />
                    </span>
                    {active ? (
                      <Badge>Current target</Badge>
                    ) : (
                      <Badge tone="neutral">
                        {route.readiness >= 75
                          ? "Within reach"
                          : route.readiness >= 50
                            ? "A new direction"
                            : "An ambitious move"}
                      </Badge>
                    )}
                  </div>
                  <h2>
                    {route.grade} {route.role}
                  </h2>
                  <div className="route-percent">
                    {route.readiness}
                    <span>% ready</span>
                  </div>
                  <Progress value={route.readiness} />
                  <div className="route-details">
                    <span>{route.gaps} skill gaps</span>
                    <span>≈ {route.activities} activities*</span>
                  </div>
                  <p>
                    {state.requirements
                      .filter(
                        (r) =>
                          r.role === route.role &&
                          r.grade === route.grade &&
                          (employee.skills.find((s) => s.skillId === r.skillId)
                            ?.level ?? 0) < r.requiredLevel,
                      )
                      .map((r) => skillName(r.skillId))
                      .join(" · ") || "All current skill requirements met"}
                  </p>
                  <Button
                    variant={active ? "secondary" : "outline"}
                    className="full-width"
                    disabled={active || !!busy || hrView}
                    onClick={() => changeTarget(route.role, route.grade)}
                  >
                    {active ? (
                      <>
                        <Check size={16} />
                        Your selected path
                      </>
                    ) : busy === route.role ? (
                      "Updating…"
                    ) : (
                      <>
                        Explore this direction <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                </article>
              );
            })}
          </div>
          <p className="footnote">
            * Planning estimate: one activity per missing skill level. Actual
            effort depends on activity availability and gains. Readiness is a
            development indicator, not a promotion decision.
          </p>
        </>
      )}
      {section === "skills" && (
        <>
          <Heading
            eyebrow="A CLEARER PICTURE OF YOU"
            title="Your skills. Your foundation."
            description="See your strengths, close meaningful gaps, and trace the evidence behind every skill."
          />
          <div className="skills-summary">
            <section className="card">
              <SectionHeading
                title="Your target at a glance"
                description={target}
              />
              <div className="radar-chart">
                <ResponsiveContainer width="100%" height={270}>
                  <RadarChart
                    data={req.map((r) => ({
                      name: skillName(r.skillId),
                      current:
                        employee.skills.find((s) => s.skillId === r.skillId)
                          ?.level ?? 0,
                      target: r.requiredLevel,
                    }))}
                  >
                    <PolarGrid stroke="#e2e9e5" />
                    <PolarAngleAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#60716a" }}
                    />
                    <Radar
                      name="Target"
                      dataKey="target"
                      stroke="#a8b6ad"
                      fill="#dce5df"
                      fillOpacity={0.25}
                    />
                    <Radar
                      name="Current"
                      dataKey="current"
                      stroke="#009857"
                      fill="#00a651"
                      fillOpacity={0.22}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span>
                  <i />
                  Current skills
                </span>
                <span>
                  <i className="gray" />
                  Target requirements
                </span>
              </div>
            </section>
            <section className="card skill-summary-card">
              <span className="eyebrow">CLOSER THAN YOU THINK</span>
              <ReadinessRing value={ready} />
              <h2>
                {req.length - gaps.length} of {req.length} requirements met
              </h2>
              <p>
                {gaps.length} competencies offer your biggest opportunity for
                growth. Select any skill to explore its evidence.
              </p>
            </section>
          </div>
          <section className="card">
            <SectionHeading
              title="Skill matrix"
              description="Levels use a 0–5 proficiency scale. Your target defines what matters next."
            />
            {matrix()}
          </section>
        </>
      )}
      {section === "activities" && (
        <>
          <Heading
            eyebrow="LEARNING WITH A DIRECTION"
            title="Small steps. Measurable progress."
            description="Every opportunity is a chance to move closer to your career target."
          />
          <div className="activity-toolbar">
            <div className="tabs" role="tablist" aria-label="Activity status">
              {[
                "Recommended",
                "All activities",
                "In progress",
                "Completed",
              ].map((f) => (
                <button
                  role="tab"
                  aria-selected={filter === f}
                  key={f}
                  onClick={() => setFilter(f)}
                  className={filter === f ? "active" : ""}
                >
                  {f}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={17} />
              <input
                aria-label="Search activities"
                placeholder="Find an activity…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="activity-grid">
            {(filter === "Recommended"
              ? state.recommendations.map((c) => c.activity)
              : state.events.filter(
                  (e) =>
                    filter === "All activities" ||
                    employee.history.some(
                      (h) =>
                        h.eventId === e.id &&
                        h.status ===
                          (filter === "Completed"
                            ? "COMPLETED"
                            : "IN_PROGRESS"),
                    ),
                )
            )
              .filter((e) =>
                `${e.name} ${e.category}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((e, i) =>
                activityCard(e, filter === "Recommended" ? i : undefined),
              )}
          </div>
          {!(
            filter === "Recommended"
              ? state.recommendations.map((c) => c.activity)
              : state.events.filter(
                  (e) =>
                    filter === "All activities" ||
                    employee.history.some(
                      (h) =>
                        h.eventId === e.id &&
                        h.status ===
                          (filter === "Completed"
                            ? "COMPLETED"
                            : "IN_PROGRESS"),
                    ),
                )
          ).some((e) =>
            `${e.name} ${e.category}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ) && (
            <Empty
              title="A fresh space for your next step"
              description="No activities match this view. Explore the recommended opportunities or try a different search."
            />
          )}
        </>
      )}
      {section === "missions" && (
        <>
          <Heading
            eyebrow="GROW THROUGH REAL WORK"
            title="Your skills. A bigger mission."
            description="Join internal initiatives, work with a new team, and put your potential into practice."
          />
          <div className="mission-banner">
            <Rocket size={32} />
            <div>
              <h2>Real challenges. Shared impact.</h2>
              <p>
                Development happens beyond the classroom. Find a mission aligned
                with your next chapter.
              </p>
            </div>
            <Badge tone="light">INTERNAL MOBILITY</Badge>
          </div>
          <div className="mission-grid">
            {state.missions.map((m) => {
              const event = state.events.find((e) => e.id === m.eventId);
              const matched = m.skills.filter(
                (s) =>
                  (employee.skills.find((e) => e.skillId === s.skillId)
                    ?.level ?? 0) >= s.requiredLevel,
              ).length;
              return (
                <article className="card mission-card" key={m.id}>
                  <div className="mission-art">
                    <Network size={62} />
                    <Badge tone="light">
                      {matched} / {m.skills.length} entry skills matched
                    </Badge>
                  </div>
                  <div className="mission-body">
                    <span className="eyebrow">CROSS-FUNCTIONAL INITIATIVE</span>
                    <h2>{m.name}</h2>
                    <p>{m.description}</p>
                    <div className="chip-row">
                      {m.skills.map((s) => (
                        <Badge tone="neutral" key={s.skillId}>
                          {skillName(s.skillId)}
                        </Badge>
                      ))}
                    </div>
                    <div className="mission-facts">
                      <span>
                        <Clock3 size={15} />
                        {m.duration} weeks
                      </span>
                      <span>{m.commitment} hours / week</span>
                      <span className="green-text">Applied learning</span>
                    </div>
                    <Button
                      className="full-width"
                      disabled={!event}
                      onClick={() =>
                        event &&
                        explain(
                          scoreActivity(
                            employee,
                            event,
                            state.events,
                            state.requirements,
                            state.skills,
                          ),
                        )
                      }
                    >
                      Explore mission <ArrowUpRight size={17} />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      {section === "profile" && (
        <>
          <Heading
            eyebrow="YOUR CAREER, CONNECTED"
            title="A profile built around you."
            description="Your experience, direction and development history in one place."
          />
          <div className="profile-grid">
            <section className="card profile-overview">
              <div className="avatar avatar-xl">
                {employee.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <h2>{employee.name}</h2>
              <p>
                {employee.role} · {employee.grade}
              </p>
              <Badge>{employee.department}</Badge>
              <dl>
                <div>
                  <dt>Experience</dt>
                  <dd>{employee.tenureMonths} months</dd>
                </div>
                <div>
                  <dt>Career target</dt>
                  <dd>{target}</dd>
                </div>
                <div>
                  <dt>Employee ID</dt>
                  <dd>{employee.employeeId}</dd>
                </div>
                <div>
                  <dt>Data source</dt>
                  <dd>Synthetic demo / imported evaluation</dd>
                </div>
              </dl>
              <Link href={employeeBase + "/career"} className="btn btn-outline">
                Explore career targets <ArrowRight size={16} />
              </Link>
            </section>
            <section className="card">
              <SectionHeading
                title="Your development history"
                description="Visible only to you and authorized HR."
              />
              {employee.history.length ? (
                employee.history.map((h) => (
                  <div className="history-row" key={h.eventId}>
                    <span
                      className={`small-icon ${h.status !== "COMPLETED" ? "neutral-icon" : ""}`}
                    >
                      {h.status === "COMPLETED" ? (
                        <Check size={18} />
                      ) : (
                        <Clock3 size={18} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {state.events.find((e) => e.id === h.eventId)?.name}
                      </strong>
                      <small>
                        {new Date(
                          h.completedAt ?? h.createdAt,
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </small>
                    </div>
                    <Badge
                      tone={h.status === "COMPLETED" ? "green" : "neutral"}
                    >
                      {h.status.toLowerCase().replaceAll("_", " ")}
                    </Badge>
                  </div>
                ))
              ) : (
                <Empty
                  title="Your story starts here"
                  description="Completed, started, skipped and declined activities will appear here."
                />
              )}
            </section>
          </div>
        </>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="recommendation-dialog">
          {selected && (
            <>
              <div className="dialog-eyebrow">
                <Sparkles size={18} /> EXPLAINABLE CAREER INTELLIGENCE
              </div>
              <DialogTitle>Why this activity?</DialogTitle>
              <DialogDescription>
                Every recommendation has a reason. Here’s the evidence behind
                yours.
              </DialogDescription>
              <div className="explanation-feature">
                <span className="activity-icon">
                  <Layers3 size={26} />
                </span>
                <div>
                  <Badge>Score {(selected.score * 100).toFixed(1)} / 100</Badge>
                  <h2>{selected.activity.name}</h2>
                  <p>
                    {selected.activity.hours} hours · {selected.activity.type}
                  </p>
                </div>
              </div>
              <p className="explanation-summary">{explanation?.summary}</p>
              <div className="evidence-grid">
                <div>
                  <Target size={20} />
                  <h3>Grade requirement</h3>
                  {selected.changes.map((c) => (
                    <p key={c.skillId}>
                      <strong>{skillName(c.skillId)}</strong>
                      <br />
                      Current {c.from}/5 · Required{" "}
                      {c.required ? `${c.required}/5` : "Not required"}
                    </p>
                  ))}
                </div>
                <div>
                  <TrendingUp size={20} />
                  <h3>Career impact</h3>
                  <strong className="impact-big">
                    {selected.before}% <ArrowRight size={19} />{" "}
                    <span>{selected.after}%</span>
                  </strong>
                  <p>
                    +{selected.after - selected.before} percentage points
                    <br />
                    toward {target}
                  </p>
                </div>
                <div>
                  <ShieldCheck size={20} />
                  <h3>Participation evidence</h3>
                  <p>{explanation?.reasons[1]}</p>
                  <small>Smoothed estimate, not a guarantee.</small>
                </div>
              </div>
              <details className="score-details">
                <summary>
                  See the scoring breakdown{" "}
                  <span>
                    Auditable by design <ChevronRight size={15} />
                  </span>
                </summary>
                <div className="factor-list">
                  {Object.entries(selected.factors).map(([key, value]) => (
                    <div key={key}>
                      <span>{factorNames[key]}</span>
                      <Progress value={value * 100} label={factorNames[key]} />
                      <strong>{(value * 100).toFixed(0)}%</strong>
                      <small>
                        {key === "skip_penalty"
                          ? "subtracted"
                          : `${WEIGHTS[key as keyof typeof WEIGHTS] * 100}% weight`}
                      </small>
                    </div>
                  ))}
                </div>
              </details>
              <button
                className={`why-not-button ${whyNot ? "expanded" : ""}`}
                onClick={() => setWhyNot(!whyNot)}
                aria-expanded={whyNot}
              >
                <CircleHelp size={19} />
                <span>Why not Public Speaking?</span>
                <ChevronRight size={18} />
              </button>
              {whyNot && (
                <div className="why-not-content">
                  <p>{explanation?.why_not_alternative}</p>
                  <div className="compare-scores">
                    <div>
                      <span>{selected.activity.name}</span>
                      <strong>{(selected.score * 100).toFixed(1)}</strong>
                    </div>
                    {(() => {
                      const speaking = state.events.find(
                        (e) => e.name === "Public Speaking Workshop",
                      );
                      if (!speaking) return null;
                      const alt = scoreActivity(
                        employee,
                        speaking,
                        state.events,
                        state.requirements,
                        state.skills,
                      );
                      return (
                        <div>
                          <span>Public Speaking Workshop</span>
                          <strong>{(alt.score * 100).toFixed(1)}</strong>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              <div className="alternative-list">
                <h3>How your alternatives compare</h3>
                {state.recommendations.map((c) => (
                  <button key={c.activity.id} onClick={() => explain(c)}>
                    <span>{c.activity.name}</span>
                    <span>+{c.after - c.before}% readiness</span>
                    <strong>{(c.score * 100).toFixed(1)}</strong>
                  </button>
                ))}
              </div>
              <div className="explanation-source">
                <ShieldCheck size={14} />
                {explaining
                  ? "Preparing explanation…"
                  : explanation?.source === "llm"
                    ? "AI wording · verified numeric evidence"
                    : "Evidence-based explanation · deterministic ranking"}
              </div>
              {error && (
                <div role="alert" className="error-banner">
                  {error}
                </div>
              )}
              <div className="dialog-actions">
                {employee.history.some(
                  (h) =>
                    h.eventId === selected.activity.id &&
                    h.status === "COMPLETED",
                ) ? (
                  <Badge>
                    <Check size={14} /> Completed
                  </Badge>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      disabled={!!busy || hrView}
                      onClick={() =>
                        activityAction(selected.activity.id, "SKIPPED")
                      }
                    >
                      Skip for now
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!busy || hrView}
                      onClick={() =>
                        activityAction(selected.activity.id, "DECLINED")
                      }
                    >
                      Not for me
                    </Button>
                    <Button
                      disabled={!!busy || hrView}
                      onClick={() =>
                        activityAction(selected.activity.id, "COMPLETED")
                      }
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <CheckCircle2 size={17} />
                      )}
                      Mark as completed
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!completed}
        onOpenChange={(o) => {
          if (!o) setCompleted(null);
        }}
      >
        <DialogContent className="completion-dialog">
          {completed && (
            <>
              <motion.div
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                className="success-icon"
              >
                <Check size={32} />
              </motion.div>
              <DialogTitle>A step forward. Well earned.</DialogTitle>
              <DialogDescription>
                Activity completed. Your career digital twin is up to date.
              </DialogDescription>
              <div className="completion-impact">
                {completed.changes.map((c) => (
                  <div key={c.skillId}>
                    <span>{skillName(c.skillId)}</span>
                    <strong>
                      {c.from} <ArrowRight size={18} />
                      <em>{c.to}</em>
                    </strong>
                  </div>
                ))}
                <div>
                  <span>Career readiness</span>
                  <strong>
                    {completed.before}% <ArrowRight size={18} />
                    <em>{completed.after}%</em>
                  </strong>
                </div>
              </div>
              <p>
                <Sparkles size={16} /> Your next recommendation has been
                recalculated.
              </p>
              <Button className="full-width" onClick={() => setCompleted(null)}>
                See what’s next <ArrowRight size={16} />
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!skillDetail}
        onOpenChange={(o) => {
          if (!o) setSkillDetail(null);
        }}
      >
        <DialogContent>
          {skillDetail && (
            <>
              <div className="dialog-eyebrow">
                <Network size={18} /> SKILL EVIDENCE
              </div>
              <DialogTitle>{skillDetail.name}</DialogTitle>
              <DialogDescription>
                A transparent view of the activity evidence behind your skill
                profile.
              </DialogDescription>
              <div className="skill-detail-level">
                <strong>
                  {employee.skills.find((s) => s.skillId === skillDetail.id)
                    ?.level ?? 0}
                  <span>/5</span>
                </strong>
                <Badge tone="neutral">{skillDetail.category}</Badge>
              </div>
              {(() => {
                const evidence = completedHistory.filter((h) =>
                  state.events
                    .find((e) => e.id === h.eventId)
                    ?.gains.some((g) => g.skillId === skillDetail.id),
                );
                return (
                  <>
                    <div className="confidence">
                      <span>
                        Evidence confidence{" "}
                        <strong>
                          {Math.min(95, 35 + evidence.length * 15)}%
                        </strong>
                      </span>
                      <Progress
                        value={Math.min(95, 35 + evidence.length * 15)}
                      />
                      <small>
                        Demo heuristic: 35% baseline + 15% per completed
                        activity; capped at 95%. Not a validated proficiency
                        assessment.
                      </small>
                    </div>
                    <h3>Evidence trail</h3>
                    <div className="evidence-entry">
                      <CheckCircle2 size={18} />
                      <div>
                        <strong>Baseline skill profile</strong>
                        <p>Starting level from the employee dataset</p>
                      </div>
                    </div>
                    {evidence.map((h) => (
                      <div className="evidence-entry" key={h.eventId}>
                        <CheckCircle2 size={18} />
                        <div>
                          <strong>
                            {state.events.find((e) => e.id === h.eventId)?.name}
                          </strong>
                          <p>
                            Completed{" "}
                            {new Date(h.completedAt!).toLocaleDateString(
                              "en-GB",
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={requirementsOpen} onOpenChange={setRequirementsOpen}>
        <DialogContent>
          <div className="dialog-eyebrow">
            <Target size={18} /> YOUR NEXT GRADE
          </div>
          <DialogTitle>{target}</DialogTitle>
          <DialogDescription>
            {
              gaps.filter(
                (r) =>
                  r.requiredLevel -
                    (employee.skills.find((s) => s.skillId === r.skillId)
                      ?.level ?? 0) >=
                  2,
              ).length
            }{" "}
            critical skill gaps are currently blocking this transition.
          </DialogDescription>
          {matrix(true)}
          <p className="footnote">
            Readiness = weighted current proficiency ÷ target proficiency,
            capped per skill at 100%. Promotion also requires human review.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
  return hrView ? (
    <Shell role="HR" name="People & Culture">
      {content}
    </Shell>
  ) : (
    <Shell role="EMPLOYEE" name={employee.name}>
      {content}
    </Shell>
  );
}
function UserIcon() {
  return <BookOpen size={20} />;
}
