"use client";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, BookOpen, ArrowUpRight } from "lucide-react";
import type { SkillEvidenceView } from "@/lib/learning-types";
import { Badge, Empty } from "./shared";
export function SkillEvidencePanel({
  evidence,
  skillId,
  hrView = false,
}: {
  evidence: SkillEvidenceView[];
  skillId?: string;
  hrView?: boolean;
}) {
  const [selected, setSelected] = useState("");
  const options = Array.from(
    new Map(evidence.map((e) => [e.skillId, e.skillName])).entries(),
  );
  const rows = evidence.filter(
    (e) =>
      (!skillId || e.skillId === skillId) &&
      (!selected || e.skillId === selected),
  );
  return (
    <section className="evidence-panel">
      <div className="catalog-principle">
        <ShieldCheck size={22} />
        <div>
          <strong>Evidence supports skill verification.</strong>
          <p>
            Learning records document participation. A verified label appears
            after the full path satisfies mastery and approval requirements.
          </p>
        </div>
      </div>
      {!skillId && options.length > 0 && (
        <label className="evidence-filter">
          Competency
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">All competencies</option>
            {options.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!rows.length ? (
        <Empty
          title="Your evidence portfolio starts here"
          description="Imported levels and historical activity completion are baseline information. Complete a structured learning journey to add assessment and verification evidence."
        />
      ) : (
        <div className="evidence-grid">
          {rows.map((item) => (
            <article className="card evidence-record" key={item.id}>
              <div className="section-heading">
                <span className="eyebrow">
                  {item.type.replaceAll("_", " ")}
                </span>
                <Badge tone={item.verified ? "green" : "neutral"}>
                  {item.verified ? "Verified" : "Learning record"}
                </Badge>
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="evidence-record-meta">
                <span>
                  {item.skillName} · Level {item.level}
                </span>
                {item.score !== null && (
                  <strong>Assessment {item.score}%</strong>
                )}
              </div>
              <div className="evidence-record-meta">
                <span>
                  {new Date(item.createdAt).toLocaleDateString("en-GB")}
                </span>
                {item.verified && (
                  <span>Evidence confidence {item.confidence}%</span>
                )}
              </div>
              <small>
                Confidence is a demo evidence indicator, not a validated
                proficiency measurement.
              </small>
              {!hrView && (
                <Link
                  className="text-link"
                  href={
                    "/employee/activities/" +
                    encodeURIComponent(item.activityId)
                  }
                >
                  <BookOpen size={14} />
                  {item.activityName}
                  <ArrowUpRight size={14} />
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
