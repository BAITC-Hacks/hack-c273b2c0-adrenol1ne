"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Clock3,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { Activity, Candidate, Snapshot } from "@shared/types/index";
import {
  Badge,
  Empty,
  Heading,
} from "@frontend/components/shared/presentation";
import { Button } from "@frontend/components/shared/ui/button";
import type { LearningCatalogEntry } from "@shared/types/api";
export type { LearningCatalogEntry } from "@shared/types/api";
const categories = [
  "Recommended for you",
  "Required for target grade",
  "Courses",
  "AI Labs",
  "Projects",
  "Mentorship",
  "Internal Missions",
  "All activities",
  "In progress",
  "Completed",
];
const typeLabels: Record<string, string> = {
  COURSE: "Course",
  VIDEO: "Video",
  ARTICLE: "Article",
  QUIZ: "Quiz",
  AI_TASK: "AI task",
  CASE_STUDY: "Case study",
  CODING_TASK: "Coding task",
  PROJECT: "Project",
  MENTOR_SESSION: "Mentor session",
  ASSESSMENT: "Assessment",
  CERTIFICATION: "Certification",
};
export function ActivityCatalog({
  state,
  metadata = [],
  hrView = false,
  onExplain,
}: {
  state: Snapshot;
  metadata?: LearningCatalogEntry[];
  hrView?: boolean;
  onExplain: (
    candidate: Candidate,
    target?: { role: string; grade: string },
  ) => void;
}) {
  const [category, setCategory] = useState("Recommended for you"),
    [search, setSearch] = useState(""),
    [skill, setSkill] = useState(""),
    [duration, setDuration] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [type, setType] = useState(""),
    [career, setCareer] = useState("current");
  const profile = useMemo(() => {
    if (career === "current" || career === "all") return state.employee;
    const [targetRole, targetGrade] = career.split("|");
    return { ...state.employee, targetRole, targetGrade };
  }, [career, state.employee]);
  const view =
    state.careerViews[profile.targetRole + "|" + profile.targetGrade];
  const recommended = view.recommendations.map((c) => c.activity.id);
  const details = (event: Activity) =>
    metadata.find((m) => m.activityId === event.id);
  const hasType = (event: Activity, unitType: string) =>
    details(event)?.unitTypes.includes(unitType) ?? false;
  const relevant = (event: Activity) =>
    (career === "all"
      ? state.requiredAcrossCareers
      : view.requiredActivityIds
    ).includes(event.id);
  const selected = state.events
    .filter((event) => {
      const history = profile.history.find((h) => h.eventId === event.id),
        meta = details(event),
        minutes = meta?.estimatedMinutes ?? event.hours * 60;
      const inCategory =
        category === "All activities" ||
        (category === "Recommended for you" &&
          recommended.includes(event.id)) ||
        (category === "Required for target grade" && relevant(event)) ||
        (category === "Courses" &&
          ["COURSE", "VIDEO", "ARTICLE"].some((t) => hasType(event, t))) ||
        (category === "AI Labs" && hasType(event, "AI_TASK")) ||
        (category === "Projects" &&
          ["PROJECT", "CODING_TASK"].some((t) => hasType(event, t))) ||
        (category === "Mentorship" &&
          (hasType(event, "MENTOR_SESSION") || event.type === "Mentorship")) ||
        (category === "Internal Missions" && event.type === "Mission") ||
        (category === "In progress" && history?.status === "IN_PROGRESS") ||
        (category === "Completed" && history?.status === "COMPLETED");
      return (
        inCategory &&
        (!search ||
          (
            event.name +
            " " +
            event.description +
            " " +
            event.category +
            " " +
            event.gains
              .map((g) => state.skills.find((s) => s.id === g.skillId)?.name)
              .join(" ")
          )
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!skill || event.gains.some((g) => g.skillId === skill)) &&
        (!type || hasType(event, type)) &&
        (!difficulty || meta?.difficulty === Number(difficulty)) &&
        (!duration ||
          (duration === "short"
            ? minutes <= 120
            : duration === "medium"
              ? minutes > 120 && minutes <= 360
              : minutes > 360)) &&
        (career === "all" || view.relevantActivityIds.includes(event.id))
      );
    })
    .sort((a, b) =>
      category === "Recommended for you"
        ? recommended.indexOf(a.id) - recommended.indexOf(b.id)
        : 0,
    );
  return (
    <>
      <Heading
        eyebrow="DEVELOPMENT THAT BECOMES EVIDENCE"
        title="Your next chapter starts here."
        description="Explore structured journeys. Learn, apply and verify the skills that move your career forward."
      />
      <div className="catalog-principle">
        <ShieldCheck size={22} />
        <div>
          <strong>Progress is participation. Mastery is demonstrated.</strong>
          <p>
            Complete assessed work and the path requirements to qualify for a
            skill gain.
          </p>
        </div>
      </div>
      <div className="catalog-categories" aria-label="Development categories">
        {categories.map((c) => (
          <button
            key={c}
            className={category === c ? "active" : ""}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <section
        className="card catalog-filters"
        aria-label="Filter development activities"
      >
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Search development activities"
            placeholder="Search activities or skills"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Skill
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">All skills</option>
            {state.skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Duration
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="">Any duration</option>
            <option value="short">Up to 2 hours</option>
            <option value="medium">2–6 hours</option>
            <option value="long">More than 6 hours</option>
          </select>
        </label>
        <label>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="">All levels</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Level {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unit type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(typeLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Career path
          <select value={career} onChange={(e) => setCareer(e.target.value)}>
            <option value="current">Current target</option>
            <option value="all">All career paths</option>
            {state.routes.map((r) => (
              <option
                key={r.role + "|" + r.grade}
                value={r.role + "|" + r.grade}
              >
                {r.grade} {r.role}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="catalog-results">
        <strong>{selected.length} development journeys</strong>
        <span>
          For {profile.targetGrade} {profile.targetRole}
        </span>
      </div>
      <div className="activity-grid">
        {selected.map((event) => {
          const meta = details(event),
            candidate = view.candidates.find(
              (c) => c.activity.id === event.id,
            )!,
            history = profile.history.find((h) => h.eventId === event.id),
            minutes = meta?.estimatedMinutes ?? event.hours * 60;
          return (
            <article key={event.id} className="card activity-card catalog-card">
              <div className="activity-card-top">
                <span className="activity-icon">
                  <BookOpen size={23} />
                </span>
                <Badge
                  tone={recommended.includes(event.id) ? "green" : "neutral"}
                >
                  {history?.status === "COMPLETED"
                    ? "Completed"
                    : history?.status === "IN_PROGRESS"
                      ? "In progress"
                      : recommended.includes(event.id)
                        ? "Recommended"
                        : event.type}
                </Badge>
              </div>
              <span className="eyebrow">{event.category}</span>
              <h3>{event.name}</h3>
              <p>{event.description}</p>
              <div className="catalog-module-tags">
                {(meta?.unitTypes ?? []).slice(0, 4).map((t) => (
                  <span key={t}>{typeLabels[t] ?? t}</span>
                ))}
              </div>
              <div className="activity-skills">
                {history?.status === "COMPLETED" && (
                  <span>Completed activity · no further skill gain</span>
                )}
                {candidate.changes
                  .filter(
                    (c) => history?.status !== "COMPLETED" && c.to > c.from,
                  )
                  .map((c) => (
                    <span key={c.skillId}>
                      {state.skills.find((s) => s.id === c.skillId)?.name}
                      <strong>
                        {c.from} → expected {c.to}
                      </strong>
                    </span>
                  ))}
              </div>
              <div className="activity-card-footer">
                <span>
                  <Clock3 size={14} />
                  {Math.floor(minutes / 60)}h {minutes % 60}m
                </span>
                <span>Level {meta?.difficulty ?? "—"}</span>
              </div>
              <div className="catalog-card-actions">
                {!hrView && (
                  <Button asChild>
                    <Link
                      href={
                        "/employee/activities/" + encodeURIComponent(event.id)
                      }
                    >
                      {history?.status === "IN_PROGRESS"
                        ? "Continue journey"
                        : "Open workspace"}
                      <ArrowUpRight size={16} />
                    </Link>
                  </Button>
                )}
                {history?.status !== "COMPLETED" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      onExplain(candidate, {
                        role: profile.targetRole,
                        grade: profile.targetGrade,
                      })
                    }
                  >
                    Why this activity?
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!selected.length && (
        <Empty
          title="No journeys match these filters"
          description="Choose another skill, duration or career path to discover available learning content."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setCategory("All activities");
                setSearch("");
                setSkill("");
                setDuration("");
                setDifficulty("");
                setType("");
                setCareer("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </>
  );
}
