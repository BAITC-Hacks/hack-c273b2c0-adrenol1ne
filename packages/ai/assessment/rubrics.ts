import type { LearningUnitDefinition } from "@shared/types/learning";
import { SYSTEM_DESIGN_RUBRIC } from "@shared/constants/assessment";
export const criteria = [
  {
    key: "scalability",
    label: "Scalability",
    terms: [
      /capacity|throughput|нагрузк|пропускн/i,
      /queue|очеред/i,
      /partition|shard|партиц|шард/i,
      /scale|scaling|масштаб/i,
    ],
    advice:
      "Quantify load and capacity, explain partitioning and describe backpressure at saturation.",
  },
  {
    key: "reliability",
    label: "Reliability",
    terms: [
      /replic|реплик/i,
      /availab|доступн|slo/i,
      /failover|резерв|переключен/i,
      /backup|rto|rpo|восстанов/i,
    ],
    advice:
      "Define availability, replication, recovery objectives and a tested failover procedure.",
  },
  {
    key: "dataArchitecture",
    label: "Data architecture",
    terms: [
      /schema|схем|model|модел/i,
      /index|индекс/i,
      /consisten|согласован|transaction|транзак/i,
      /outbox|storage|хранени|database|баз[аы]/i,
    ],
    advice:
      "Describe your data model, indexes, transaction boundaries and consistency trade-offs.",
  },
  {
    key: "failureHandling",
    label: "Failure handling",
    terms: [
      /retr|retry|повтор|backoff/i,
      /idempoten|идемпотент/i,
      /dead.?letter|dlq|ошибочн|необработан/i,
      /timeout|тайм.?аут|circuit.?break|jitter/i,
    ],
    advice:
      "Make retries bounded; specify idempotency, timeouts, dead-letter handling and controlled replay.",
  },
  {
    key: "observability",
    label: "Observability",
    terms: [
      /metric|метрик/i,
      /trace|tracing|трассир|correlation|корреляц/i,
      /log|журнал|лог/i,
      /alert|алерт|оповещ|slo|dashboard/i,
    ],
    advice:
      "Name measurable metrics, correlated logs/traces and actionable alert thresholds.",
  },
  {
    key: "security",
    label: "Security",
    terms: [
      /encrypt|tls|шифр/i,
      /access|auth|доступ|авторизац/i,
      /pii|redact|персональн|маскир|sensitive/i,
      /audit|аудит|retention|хранени.*срок/i,
    ],
    advice:
      "Specify transport/storage encryption, least privilege, redaction and an audit/retention policy.",
  },
];

export const genericCriteria = [
  {
    key: "scalability",
    label: "Scope and feasibility",
    terms: [
      /objective|goal|цел[ьиь]|problem|проблем/i,
      /constraint|limit|огранич/i,
      /resource|capacity|ресурс/i,
      /plan|этап|план/i,
    ],
    advice:
      "State the problem, success criteria, constraints and a feasible delivery plan.",
  },
  {
    key: "reliability",
    label: "Decision quality",
    terms: [
      /option|alternative|альтернатив|вариант/i,
      /trade.?off|компромисс/i,
      /assumption|гипотез|предполож/i,
      /validate|verify|провер/i,
    ],
    advice:
      "Compare options, state assumptions and explain how your decision will be validated.",
  },
  {
    key: "dataArchitecture",
    label: "Evidence and analysis",
    terms: [
      /data|данн/i,
      /segment|сегмент|cohort|когорт/i,
      /baseline|базов|sample|выборк/i,
      /caus|причин|evidence|доказ/i,
    ],
    advice:
      "Use the synthetic evidence, separate correlation from causes and describe relevant segments.",
  },
  {
    key: "failureHandling",
    label: "Risk management",
    terms: [
      /risk|риск/i,
      /guardrail|ограничител|rollback|откат/i,
      /owner|ответствен/i,
      /failure|fail|сбой|ошибк/i,
    ],
    advice:
      "Identify risks, guardrails, responsible owners and a rollback or escalation plan.",
  },
  {
    key: "observability",
    label: "Measurement",
    terms: [
      /metric|метрик/i,
      /monitor|монитор/i,
      /threshold|порог/i,
      /experiment|эксперимент|test|тест/i,
    ],
    advice:
      "Define metrics, thresholds, monitoring and a test of the proposed intervention.",
  },
  {
    key: "security",
    label: "Responsible handling",
    terms: [
      /synthetic|синтетич/i,
      /privacy|приват|конфиденц/i,
      /access|доступ/i,
      /audit|аудит|consent|согласие/i,
    ],
    advice:
      "Explain synthetic data use, privacy, restricted access and traceable review.",
  },
];

export function rubricFor(unit: LearningUnitDefinition) {
  const rubric: Record<string, number> =
    unit.assessmentConfig?.rubric ?? SYSTEM_DESIGN_RUBRIC;
  const keys = Object.keys(SYSTEM_DESIGN_RUBRIC);
  if (
    Object.keys(rubric).length !== keys.length ||
    keys.some((key) => !Number.isFinite(rubric[key]) || rubric[key] <= 0) ||
    Object.values(rubric).reduce((sum, value) => sum + value, 0) !== 100
  )
    throw new Error(
      "Assessment rubric must contain six valid dimensions totaling 100.",
    );
  return rubric;
}

/** Transparent heuristic demo, not a calibrated measurement of professional competence. */
