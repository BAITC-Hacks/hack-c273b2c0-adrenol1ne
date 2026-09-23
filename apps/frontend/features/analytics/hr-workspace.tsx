"use client";
import { apiFetch, apiErrorMessage } from "@frontend/lib/api-client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ScatterChart,
  Scatter,
  ReferenceLine,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  Users,
  Target,
  ChartNoAxesCombined,
  CheckCircle2,
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  ShieldCheck,
  Search,
  Sparkles,
  Clock3,
  Layers3,
  SlidersHorizontal,
  X,
  LoaderCircle,
  CircleAlert,
  ChevronRight,
} from "lucide-react";
import type { Activity, Workforce } from "@shared/types/index";
import { apiClient } from "@frontend/lib/api-client";
import type { WorkforceScenario, ImportResult } from "@shared/types/api";
import { Shell } from "@frontend/components/shared/shell";
import {
  Badge,
  Empty,
  Heading,
  SectionHeading,
} from "@frontend/components/shared/presentation";
import { Button } from "@frontend/components/shared/ui/button";
import { Progress } from "@frontend/components/shared/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@frontend/components/shared/ui/dialog";
export function HrWorkspace({
  initial,
  section,
}: {
  initial: Workforce;
  section: string;
}) {
  const data = initial,
    router = useRouter();
  const [search, setSearch] = useState(""),
    [employeeFilter, setEmployeeFilter] = useState("All employees"),
    [gap, setGap] = useState<Workforce["gaps"][number] | null>(null),
    [activity, setActivity] = useState<Activity | null>(null),
    [needed, setNeeded] = useState(50),
    [months, setMonths] = useState(9),
    [goalSkill, setGoalSkill] = useState("SK_AI"),
    [scenario, setScenario] = useState<WorkforceScenario | null>(null),
    [files, setFiles] = useState<File[]>([]),
    [importing, setImporting] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<ImportResult | null>(null),
    [dragging, setDragging] = useState(false);
  const close = data.metrics.nearTarget,
    uncovered = data.metrics.uncovered;
  const people = data.employees
    .filter((e) =>
      `${e.name} ${e.role} ${e.department}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter(
      (e) =>
        employeeFilter === "All employees" ||
        (employeeFilter === "Near target" && e.nearTarget) ||
        (employeeFilter === "No recommendation" && !e.recommendationCount) ||
        (employeeFilter === "Critical gaps" && e.criticalGaps > 0),
    );
  async function runScenario() {
    setError("");
    try {
      setScenario(
        await apiClient<WorkforceScenario>("/api/hr/scenario", {
          method: "POST",
          body: JSON.stringify({ skillId: goalSkill, needed, months }),
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not calculate scenario.",
      );
    }
  }
  async function importFiles() {
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const response = await apiFetch("/api/hr/import", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(body.error));
      setResult(body);
      setFiles([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }
  function gapChart(full = false) {
    return (
      <div className="gap-chart">
        {data.gaps.slice(0, full ? 24 : 5).map((g, i) => (
          <button key={g.skillId} onClick={() => setGap(g)}>
            <span>{g.name}</span>
            <div className="gap-bar">
              <i
                style={{
                  width: `${g.percent}%`,
                  background:
                    i === 0
                      ? "#008e52"
                      : i === 1
                        ? "#33a977"
                        : i === 2
                          ? "#77bf9b"
                          : "#aed9bf",
                }}
              />
            </div>
            <strong>{g.percent}%</strong>
            <ChevronRight size={15} />
          </button>
        ))}
        <p>Share of employees with this skill in their target requirements.</p>
      </div>
    );
  }
  function employeeTable() {
    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role & team</th>
              <th>Readiness</th>
              <th>Skill gaps</th>
              <th>Next step</th>
              <th>
                <span className="sr-only">Open profile</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link
                    className="table-person"
                    href={`/hr/employees/${encodeURIComponent(e.id)}`}
                  >
                    <span className="avatar">
                      {e.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span>
                      <strong>{e.name}</strong>
                      <small>{e.grade}</small>
                    </span>
                  </Link>
                </td>
                <td>
                  <strong>{e.role}</strong>
                  <small>{e.department}</small>
                </td>
                <td>
                  <div className="table-readiness">
                    <strong>{e.readiness}%</strong>
                    <Progress value={e.readiness} />
                  </div>
                </td>
                <td>
                  {e.criticalGaps ? (
                    <Badge tone="amber">{e.criticalGaps} critical</Badge>
                  ) : (
                    <Badge>On track</Badge>
                  )}
                </td>
                <td>
                  <Badge tone={e.recommendationCount ? "green" : "neutral"}>
                    {e.recommendationCount
                      ? "Recommendation ready"
                      : "Needs review"}
                  </Badge>
                </td>
                <td>
                  <Link
                    href={`/hr/employees/${encodeURIComponent(e.id)}`}
                    aria-label={`Open ${e.name}'s profile`}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!people.length && (
          <Empty
            title="No matching employees"
            description="Try a different name, team or readiness filter."
          />
        )}
      </div>
    );
  }
  return (
    <Shell role="HR" name="People & Culture">
      {error && section === "scenarios" && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {section === "overview" && (
        <>
          <Heading
            eyebrow="PEOPLE INTELLIGENCE. REAL POSSIBILITIES."
            title="See the potential in your people."
            description="A connected view of capability, career readiness and the opportunities ahead."
            action={
              <Button variant="outline" asChild>
                <Link href="/hr/scenarios">
                  <SlidersHorizontal size={16} />
                  Run a workforce scenario
                </Link>
              </Button>
            }
          />
          <div className="hr-banner">
            <div>
              <Badge tone="light">WORKFORCE SNAPSHOT</Badge>
              <h2>
                Build the capabilities
                <br />
                your next chapter needs.
              </h2>
              <p>
                Connect individual growth with the future of your organization.
              </p>
            </div>
            <div className="hr-banner-stat">
              <strong>{close}</strong>
              <span>
                employees near their
                <br />
                next career milestone
              </span>
              <Link href="/hr/employees">
                Explore talent <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
          <div className="kpi-grid">
            {[
              {
                label: "Employees",
                value: data.employees.length,
                icon: Users,
                note: "Across all teams",
              },
              {
                label: "Average readiness",
                value: `${data.metrics.readiness}%`,
                icon: Target,
                note: "Against individual targets",
              },
              {
                label: "Critical skill gaps",
                value: data.metrics.critical,
                icon: Layers3,
                note: "Employees needing support",
                amber: true,
              },
              {
                label: "Recommendation coverage",
                value: `${data.metrics.coverage}%`,
                icon: Sparkles,
                note: `${uncovered} profiles need review`,
              },
              {
                label: "Activity completion",
                value: `${data.metrics.completion}%`,
                icon: CheckCircle2,
                note: "Of resolved participation",
              },
            ].map((k) => (
              <div className="card kpi" key={k.label}>
                <div>
                  <span>{k.label}</span>
                  <k.icon size={18} />
                </div>
                <strong className={k.amber ? "amber-text" : ""}>
                  {k.value}
                </strong>
                <p>{k.note}</p>
              </div>
            ))}
          </div>
          <div className="hr-chart-grid">
            <section className="card">
              <SectionHeading
                title="Where development matters most"
                description="Organizational skill gaps, connected to career targets."
                action={
                  <Link href="/hr/skills" aria-label="Explore all skill gaps">
                    <ArrowUpRight size={19} />
                  </Link>
                }
              />
              {gapChart()}
            </section>
            <section className="card">
              <SectionHeading
                title="Growth in motion"
                description="Participation over the last six months."
              />
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart
                    data={data.participation}
                    margin={{ top: 15, right: 10, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="growthFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#00a651"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="#00a651"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e8edea"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#829087" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#829087" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e1e8e4",
                      }}
                    />
                    <Area
                      type="monotone"
                      name="Participation"
                      dataKey="started"
                      fill="transparent"
                      stroke="#a4b8ac"
                      strokeDasharray="5 5"
                    />
                    <Area
                      type="monotone"
                      name="Completed"
                      dataKey="completed"
                      stroke="#009858"
                      strokeWidth={3}
                      fill="url(#growthFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span>
                  <i />
                  Completed activities
                </span>
                <span>
                  <i className="gray" />
                  All participation
                </span>
              </div>
            </section>
          </div>
          <div className="hr-chart-grid">
            <section className="card talent-card">
              <SectionHeading
                title="The talent landscape"
                description="Career readiness × activity engagement. A view for support, never a leaderboard."
              />
              <div className="talent-map">
                <span className="quadrant top-left">DEVELOPING</span>
                <span className="quadrant top-right">READY FOR GROWTH</span>
                <span className="quadrant bottom-left">NEEDS SUPPORT</span>
                <span className="quadrant bottom-right">
                  RECONNECT & ENGAGE
                </span>
                <ResponsiveContainer width="100%" height={290}>
                  <ScatterChart
                    margin={{ top: 20, right: 25, bottom: 15, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#edf1ee" />
                    <XAxis
                      type="number"
                      dataKey="readiness"
                      name="Career readiness"
                      unit="%"
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Career readiness →",
                        position: "insideBottom",
                        offset: -12,
                        fontSize: 12,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="engagement"
                      name="Engagement"
                      unit="%"
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                    />
                    <ReferenceLine
                      x={70}
                      stroke="#c7d4cd"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={50}
                      stroke="#c7d4cd"
                      strokeDasharray="4 4"
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="chart-tooltip">
                            <strong>{payload[0].payload.name}</strong>
                            <p>Readiness: {payload[0].payload.readiness}%</p>
                            <p>Engagement: {payload[0].payload.engagement}%</p>
                          </div>
                        ) : null
                      }
                    />
                    <Scatter
                      data={data.employees}
                      fill="#00985a"
                      fillOpacity={0.7}
                      onClick={(e) => {
                        if (e?.payload?.id)
                          router.push(`/hr/employees/${e.payload.id}`);
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="card-note">
                <ShieldCheck size={14} /> Engagement data is restricted to
                authorized HR.
              </div>
            </section>
            <section className="card insights-card">
              <SectionHeading
                title="Your attention makes a difference"
                description="Turn workforce signals into meaningful action."
              />
              <Link className="insight-row" href="/hr/employees">
                <span className="stat-icon">
                  <Target size={23} />
                </span>
                <div>
                  <h3>{close} employees are close to their target</h3>
                  <p>
                    Review their remaining requirements and support the next
                    step.
                  </p>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link className="insight-row" href="/hr/skills">
                <span className="stat-icon amber">
                  <Layers3 size={23} />
                </span>
                <div>
                  <h3>
                    {data.gaps[0]?.name ?? "Skills"} needs focused attention
                  </h3>
                  <p>
                    {data.gaps[0]?.affected ?? 0} employees have a gap against
                    their target role.
                  </p>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link className="insight-row" href="/hr/employees">
                <span className="stat-icon blue">
                  <Sparkles size={23} />
                </span>
                <div>
                  <h3>{uncovered} profiles need a closer look</h3>
                  <p>
                    Some employees may need new activities or a defined career
                    framework.
                  </p>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link className="scenario-callout" href="/hr/scenarios">
                <SlidersHorizontal size={22} />
                <div>
                  <strong>Plan for what comes next.</strong>
                  <span>Explore a workforce scenario</span>
                </div>
                <ArrowRight size={18} />
              </Link>
            </section>
          </div>
        </>
      )}
      {section === "skills" && (
        <>
          <Heading
            eyebrow="CAPABILITY INTELLIGENCE"
            title="Make skill gaps actionable."
            description="Focus development investment where it connects most directly to your people’s career goals."
          />
          <div className="hr-chart-grid">
            <section className="card">
              <SectionHeading
                title="Organization-wide skill gaps"
                description="Select a competency to see affected employees and available development."
              />
              {gapChart(true)}
            </section>
            <section className="card">
              <SectionHeading title="How to read this view" />
              <div className="explanation-copy">
                <span className="small-icon">
                  <Layers3 size={24} />
                </span>
                <h3>A gap has context.</h3>
                <p>
                  We compare each employee’s current skills with the
                  requirements for their chosen career target. A low skill only
                  appears as a gap when that role requires it.
                </p>
                <h3>Critical means two or more levels.</h3>
                <p>
                  These competencies need sustained attention. A one-level gap
                  is considered near target.
                </p>
                <h3>Development is a shared decision.</h3>
                <p>
                  Use these signals to guide conversations and invest in
                  opportunities. Readiness does not automatically determine
                  promotion.
                </p>
              </div>
            </section>
          </div>
        </>
      )}
      {section === "employees" && (
        <>
          <Heading
            eyebrow="PEOPLE, WITH PERSPECTIVE"
            title="Every profile has a next chapter."
            description="Support individual development with a clear view of readiness and opportunity."
            action={
              <Badge tone="neutral">{data.employees.length} employees</Badge>
            }
          />
          <div className="activity-toolbar">
            <div className="tabs" role="tablist" aria-label="Employee filters">
              {[
                "All employees",
                "Near target",
                "Critical gaps",
                "No recommendation",
              ].map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={employeeFilter === f}
                  onClick={() => setEmployeeFilter(f)}
                  className={employeeFilter === f ? "active" : ""}
                >
                  {f}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={17} />
              <input
                aria-label="Search employees"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, role or team…"
              />
            </label>
          </div>
          <section className="card table-card">{employeeTable()}</section>
          <p className="footnote">
            Synthetic profiles · Engagement history is restricted to employees
            themselves and authorized HR.
          </p>
        </>
      )}
      {section === "activities" && (
        <>
          <Heading
            eyebrow="DEVELOPMENT THAT CONNECTS"
            title="The opportunities behind the growth."
            description="Inspect activity outcomes and the maximum skill level each opportunity can support."
          />
          <label className="search-box standalone-search">
            <Search size={17} />
            <input
              aria-label="Search activity catalog"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the activity catalog…"
            />
          </label>
          <div className="activity-grid">
            {data.events
              .filter((e) =>
                e.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((e) => (
                <article className="card activity-card" key={e.id}>
                  <div className="activity-card-top">
                    <span className="activity-icon">
                      <Layers3 size={23} />
                    </span>
                    <Badge tone="neutral">{e.type}</Badge>
                  </div>
                  <h3>{e.name}</h3>
                  <p>{e.description}</p>
                  <div className="chip-row">
                    {e.gains.map((g) => (
                      <Badge key={g.skillId} tone="neutral">
                        {data.skills.find((s) => s.id === g.skillId)?.name} +
                        {g.gain}
                      </Badge>
                    ))}
                  </div>
                  <div className="activity-card-footer">
                    <span>
                      <Clock3 size={14} />
                      {e.hours} hours
                    </span>
                    <span>
                      {Math.round(e.businessPriority * 100)}% business priority
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    className="full-width"
                    onClick={() => setActivity(e)}
                  >
                    Inspect activity <ArrowUpRight size={16} />
                  </Button>
                </article>
              ))}
          </div>
        </>
      )}
      {section === "scenarios" && (
        <>
          <Heading
            eyebrow="STRATEGIC WORKFORCE PLANNING"
            title="Imagine the need. Explore the path."
            description="Understand how internal development could support your next business priority."
          />
          <div className="scenario-layout">
            <section className="card scenario-inputs">
              <span className="small-icon">
                <SlidersHorizontal size={25} />
              </span>
              <h2>What capability do you need?</h2>
              <p>
                Turn a workforce ambition into a practical planning scenario.
              </p>
              <label>
                Priority competency
                <select
                  value={goalSkill}
                  onChange={(e) => {
                    setGoalSkill(e.target.value);
                    setScenario(null);
                  }}
                >
                  {data.skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Additional skilled employees
                <div className="number-input">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={needed}
                    onChange={(e) => {
                      setNeeded(Number(e.target.value));
                      setScenario(null);
                    }}
                  />
                  <span>people</span>
                </div>
              </label>
              <label>
                Planning horizon <strong>{months} months</strong>
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={3}
                  value={months}
                  onChange={(e) => {
                    setMonths(Number(e.target.value));
                    setScenario(null);
                  }}
                />
                <div className="range-labels">
                  <span>3 months</span>
                  <span>12 months</span>
                </div>
              </label>
              <Button
                className="full-width"
                disabled={
                  !Number.isInteger(needed) || needed < 1 || needed > 10000
                }
                onClick={runScenario}
              >
                <Sparkles size={17} />
                Run scenario <ArrowRight size={17} />
              </Button>
              <div className="card-note">
                <InfoIcon />
                Transparent planning assumptions. No black box.
              </div>
            </section>
            <section className="card scenario-output">
              {scenario ? (
                <>
                  <Badge>SCENARIO RESULTS</Badge>
                  <h2>
                    {scenario.needed} additional{" "}
                    {data.skills.find((s) => s.id === goalSkill)?.name}-skilled
                    people.
                    <br />A possible path over {scenario.months} months.
                  </h2>
                  <p className="scenario-existing">
                    <CheckCircle2 size={20} />
                    <strong>{scenario.existing}</strong> existing ready talent,
                    separate from this additional goal
                  </p>
                  {[
                    {
                      label: "Can be upskilled within 3 months",
                      n: scenario.threeMonths,
                      percent: scenario.percentages.threeMonths,
                      color: "green",
                    },
                    {
                      label: "Can be upskilled within 6 months",
                      n: scenario.sixMonths,
                      percent: scenario.percentages.sixMonths,
                      color: "blue",
                    },
                    {
                      label: "Internal mobility candidates",
                      n: scenario.mobility,
                      percent: scenario.percentages.mobility,
                      color: "purple",
                    },
                    {
                      label: "External hiring requirement",
                      n: scenario.external,
                      percent: scenario.percentages.external,
                      color: "amber",
                    },
                  ].map((row) => (
                    <div className="scenario-result-row" key={row.label}>
                      <span className={`result-dot ${row.color}`} />
                      <span>{row.label}</span>
                      <strong>{row.n}</strong>
                      <Progress value={row.percent} />
                    </div>
                  ))}
                  <div className="scenario-summary">
                    <strong>{scenario.internalCoveragePercent}%</strong>
                    <div>
                      <h3>of this goal could come from within.</h3>
                      <p>
                        A starting point for reskilling and mobility
                        conversations.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="scenario-empty">
                  <ChartNoAxesCombined size={56} />
                  <h2>Start with the future you’re planning for.</h2>
                  <p>
                    Choose a competency and a timeframe to explore the balance
                    between upskilling, mobility and hiring.
                  </p>
                  <span className="sample-goal">
                    “We need 50 additional AI-skilled employees within 9
                    months.”
                  </span>
                </div>
              )}
            </section>
          </div>
          <div className="scenario-assumptions">
            <ShieldCheck size={22} />
            <div>
              <strong>Planning illustration, not a workforce forecast.</strong>
              <p>
                Level 4+ is ready now; level 3 can gain one level in 3 months;
                level 2 needs 6 months. Level 1 with at least 70% completion
                engagement may be a mobility candidate at 9 months. Cohorts are
                mutually exclusive and capped at your additional goal. Actual
                capacity, interest, budgets and learning outcomes need human
                review.
              </p>
            </div>
          </div>
        </>
      )}
      {section === "import" && (
        <>
          <Heading
            eyebrow="BRING THE FULL PICTURE TOGETHER"
            title="New data. New possibilities."
            description="Import evaluation profiles and activities to calculate recommendations for a new workforce."
          />
          <div className="import-layout">
            <section className="card import-main">
              <SectionHeading
                title="Import an evaluation dataset"
                description="Upload one file or a related set. All records are validated before saving."
              />
              <label
                className={`dropzone ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  setFiles(Array.from(e.dataTransfer.files));
                  setResult(null);
                }}
              >
                <input
                  type="file"
                  accept=".json,.csv"
                  multiple
                  aria-label="Choose dataset files"
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files ?? []));
                    setResult(null);
                  }}
                />
                <span className="upload-icon">
                  <Upload size={27} />
                </span>
                <strong>Drop your files here</strong>
                <p>
                  or <span>browse your computer</span>
                </p>
                <small>
                  JSON and CSV · Up to 2 MB per file · 5 files maximum
                </small>
              </label>
              {files.map((file, i) => (
                <div className="file-row" key={`${file.name}${i}`}>
                  <FileJson size={21} />
                  <div>
                    <strong>{file.name}</strong>
                    <small>{(file.size / 1024).toFixed(1)} KB</small>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
              {error && (
                <div className="error-banner" role="alert">
                  <CircleAlert size={18} />
                  {error}
                </div>
              )}
              <Button
                className="full-width"
                disabled={!files.length || importing}
                onClick={importFiles}
              >
                {importing ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Upload size={17} />
                )}{" "}
                {importing
                  ? "Validating and calculating…"
                  : "Validate & import dataset"}
              </Button>
              <div className="import-assurance">
                <ShieldCheck size={15} /> Invalid records are rejected together.
                Successful imports update the workforce view.
              </div>
              {result && (
                <div className="import-success" role="status">
                  <CheckCircle2 size={28} />
                  <h2>Your dataset is ready.</h2>
                  <p>
                    {Object.entries(result.counts)
                      .filter(([, n]) => n)
                      .map(([key, n]) => `${n} ${key}`)
                      .join(" · ")}
                  </p>
                  <h3>Recommendations calculated</h3>
                  {result.results.map((e) => (
                    <Link
                      key={e.id}
                      href={`/hr/employees/${encodeURIComponent(e.id)}`}
                    >
                      <div>
                        <strong>{e.name}</strong>
                        <span>
                          {e.topActivity ??
                            "No eligible activity: review target requirements or activity availability."}
                        </span>
                      </div>
                      <ArrowUpRight size={18} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <aside className="import-guide">
              <section className="card">
                <SectionHeading title="A place for each piece" />
                {[
                  {
                    name: "employees.json",
                    description:
                      "Profiles, career targets and current skill levels",
                    icon: FileJson,
                  },
                  {
                    name: "events.json",
                    description:
                      "Activities, skill gains and proficiency ceilings",
                    icon: FileJson,
                  },
                  {
                    name: "skills.json",
                    description: "Skill names, codes and categories",
                    icon: FileJson,
                  },
                  {
                    name: "activity_history.csv",
                    description:
                      "Completed, skipped, declined and ongoing participation",
                    icon: FileSpreadsheet,
                  },
                ].map((f) => (
                  <div className="import-file-guide" key={f.name}>
                    <f.icon size={20} />
                    <div>
                      <strong>{f.name}</strong>
                      <p>{f.description}</p>
                    </div>
                  </div>
                ))}
                <a
                  className="btn btn-outline full-width"
                  href="/samples/employees.json"
                  download
                >
                  <Download size={16} />
                  Download a sample profile
                </a>
              </section>
              <section className="card import-tips">
                <h3>A few useful details</h3>
                <p>
                  New IDs are welcome. Skills and events must exist already or
                  arrive in the same upload.
                </p>
                <p>
                  For new career targets, include a <code>requirements</code>{" "}
                  array in a combined JSON dataset.
                </p>
                <p>
                  Imported skill levels are the source of truth. Historical
                  completions provide evidence and are not applied again as
                  skill gains.
                </p>
                <a className="text-link" href="/samples/dataset.json" download>
                  Download a full dataset <ArrowUpRight size={15} />
                </a>
                <a
                  className="text-link"
                  href="/samples/activity_history.csv"
                  download
                >
                  Download sample history <ArrowUpRight size={15} />
                </a>
              </section>
            </aside>
          </div>
        </>
      )}
      <Dialog
        open={!!gap}
        onOpenChange={(o) => {
          if (!o) setGap(null);
        }}
      >
        <DialogContent>
          {gap && (
            <>
              <div className="dialog-eyebrow">
                <Layers3 size={18} /> ORGANIZATIONAL SKILL GAP
              </div>
              <DialogTitle>{gap.name}</DialogTitle>
              <DialogDescription>
                A focused view of development needs and available opportunities.
              </DialogDescription>
              <div className="gap-detail-stats">
                {[
                  { n: gap.affected, label: "Employees affected" },
                  { n: gap.critical, label: "Critical gaps" },
                  { n: gap.nearTarget, label: "Near target" },
                  { n: gap.available, label: "Available activities" },
                ].map((s) => (
                  <div key={s.label}>
                    <strong>{s.n}</strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <h3>Development opportunities</h3>
              {data.events
                .filter((e) => e.gains.some((g) => g.skillId === gap.skillId))
                .map((e) => (
                  <button
                    className="gap-activity"
                    key={e.id}
                    onClick={() => {
                      setGap(null);
                      setActivity(e);
                    }}
                  >
                    <span>{e.name}</span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              <Button variant="outline" asChild>
                <Link href="/hr/employees">
                  Explore employee profiles <ArrowRight size={16} />
                </Link>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!activity}
        onOpenChange={(o) => {
          if (!o) setActivity(null);
        }}
      >
        <DialogContent>
          {activity && (
            <>
              <div className="dialog-eyebrow">
                <Layers3 size={18} /> ACTIVITY CONFIGURATION
              </div>
              <DialogTitle>{activity.name}</DialogTitle>
              <DialogDescription>{activity.description}</DialogDescription>
              <div className="chip-row">
                <Badge tone="neutral">{activity.type}</Badge>
                <Badge tone="neutral">{activity.hours} hours</Badge>
                <Badge tone="neutral">Code: {activity.eventCode}</Badge>
              </div>
              <h3>Attainable skill gains</h3>
              {activity.gains.map((g) => (
                <div className="config-gain" key={g.skillId}>
                  <strong>
                    {data.skills.find((s) => s.id === g.skillId)?.name}
                  </strong>
                  <span>
                    +{g.gain} level · capped at {g.maxLevel}/5
                  </span>
                </div>
              ))}
              <p className="footnote">
                Completion never lowers an existing skill or raises it beyond an
                activity’s ceiling. Repeated completion is idempotent.
              </p>
              <div className="card-note">
                Business priority: {Math.round(activity.businessPriority * 100)}
                % · Minimum tenure: {activity.minTenureMonths} months
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
function InfoIcon() {
  return <ShieldCheck size={15} />;
}
