import type { Activity, Skill } from "./types";
import type {
  AssessmentContext,
  LearningPathDefinition,
  LearningPathDraft,
  LearningUnitDefinition,
  LearningUnitType,
} from "./learning-types";
import {
  createQuizDefinition,
  SYSTEM_DESIGN_RUBRIC,
} from "./learning-assessment";

export const BANKING_CASES = [
  {
    id: "system-design",
    skillIds: [
      "SK_SYSTEM_DESIGN",
      "SK_DATABASES",
      "SK_CLOUD",
      "SK_DEVOPS",
      "SK_API",
    ],
    title: "Card transaction notification service",
    prompt:
      "Design a synthetic card transaction notification system handling 3,000 events/sec. Separate payment commitment from delivery; explain retries, duplicate events, customer preferences and provider outages.",
    syntheticData:
      "All values are synthetic. Steady load: 3,000 events/sec; peak: 6,000 for 10 minutes; event size: 1 KB; channels: push 80%, SMS 20%; target: 99.9% accepted events delivered within 60 seconds; simulated SMS timeout rate: 2%. No real customer or card data is provided.",
    deliverables: [
      "Component and data-flow outline",
      "Capacity estimate and queue/backpressure policy",
      "Idempotency and failure-recovery sequence",
      "SLOs, security controls and a fault-injection test plan",
    ],
  },
  {
    id: "analytics",
    skillIds: [
      "SK_ANALYTICS",
      "SK_DATA_ENGINEERING",
      "SK_ML",
      "SK_AI",
      "SK_RISK",
      "SK_PYTHON",
    ],
    title: "Investigate a payment conversion drop",
    prompt:
      "Analyze the synthetic funnel and propose likely causes of the mobile payment conversion drop. Distinguish observed facts from hypotheses; account for changes in device mix and verify instrumentation before recommending an intervention.",
    syntheticData:
      "Synthetic aggregate records; no personal data. Columns: week,platform,checkout_started,payment_success,auth_timeout. W1,Android,10000,9200,200; W2,Android,11000,9020,1100; W1,iOS,8000,7440,160; W2,iOS,8000,7360,200. Android app release was simulated between W1 and W2. The data establishes association, not causation.",
    deliverables: [
      "Conversion and timeout rates by segment",
      "Two competing hypotheses and missing evidence",
      "Proposed experiment with success metric and guardrail",
      "Monitoring, accountable owner and rollback criteria",
    ],
  },
  {
    id: "security",
    skillIds: ["SK_SECURITY", "SK_COMPLIANCE"],
    title: "Triage synthetic authentication logs",
    prompt:
      "Analyze the synthetic authentication events, identify suspicious patterns and propose a proportionate investigation and containment plan. Explain false-positive risks and avoid treating an IP address alone as proof of an attacker.",
    syntheticData:
      "Synthetic logs: 09:00-09:04, test-user-07, 18 failed password attempts, source TEST-NET 192.0.2.10; 09:05, test-user-07, successful password, new device demo-device-B; 09:06, same account, MFA denied; 09:07, test-user-07, password reset requested. Baseline: 0-2 failed attempts/day. No production systems or credentials are involved.",
    deliverables: [
      "Evidence timeline and risk hypothesis",
      "Additional telemetry and access restrictions",
      "Safe containment, escalation and rollback plan",
      "Privacy, retention, audit and detection-quality metrics",
    ],
  },
  {
    id: "product",
    skillIds: ["SK_PRODUCT", "SK_UX", "SK_STRATEGY", "SK_AGILE"],
    title: "Improve mobile onboarding completion",
    prompt:
      "Design an experiment to improve a synthetic mobile onboarding funnel. Explain the user problem, randomization unit, primary metric, guardrails and a decision rule before looking at results.",
    syntheticData:
      "Synthetic weekly funnel: 10,000 start; 8,000 phone verification; 6,000 identity check; 4,800 finish. Simulated support tags: identity instructions unclear 120; upload failure 95; other 40. Completion differs by platform and acquisition channel. There is no experimental treatment data yet.",
    deliverables: [
      "Problem statement and interview/data plan",
      "Control and treatment, unit of assignment and exposure logging",
      "Primary outcome, guardrails and analysis segments",
      "Decision, ownership, rollout and rollback criteria",
    ],
  },
  {
    id: "leadership",
    skillIds: [
      "SK_LEADERSHIP",
      "SK_MENTORING",
      "SK_COMMUNICATION",
      "SK_PUBLIC_SPEAKING",
    ],
    title: "Resolve a release deadline disagreement",
    prompt:
      "Resolve a synthetic disagreement: product needs a mobile release in two weeks, while engineering estimates four weeks including reliability work. Facilitate a decision using shared outcomes, evidence and explicit trade-offs; do not frame either team as the problem.",
    syntheticData:
      "Synthetic constraints: campaign date in 14 days; 3 engineers; 8 estimated days of feature work plus 6 days of testing/reliability; one high-severity defect remains; staged rollout is possible. Product success: activation; engineering guardrail: error rate below the agreed baseline. Estimates have not yet been jointly reviewed.",
    deliverables: [
      "Stakeholder interests and a neutral problem statement",
      "Options including scope reduction and phased rollout",
      "Decision log, accountable owners and escalation path",
      "Measurement, follow-up, privacy and respectful communication plan",
    ],
  },
] as const;

export function getBankingCase(skillId: string) {
  return (
    BANKING_CASES.find((item) =>
      (item.skillIds as readonly string[]).includes(skillId),
    ) ?? {
      ...BANKING_CASES[1],
      title: "Apply a professional skill to a banking improvement",
      prompt:
        "Use the synthetic payment case to propose an improvement in your target skill. State a measurable objective, constraints, evidence, risks and verification criteria.",
    }
  );
}

export function getAdaptiveTask(skillId: string, context: AssessmentContext) {
  const bankingCase = getBankingCase(skillId);
  const level = Math.min(5, Math.max(1, context.currentLevel));
  const technical = /SYSTEM_DESIGN|DATABASES|CLOUD|DEVOPS|API/.test(skillId);
  const prompt = technical
    ? level >= 4
      ? "Design a multi-region transaction processing architecture and justify consistency, failover, RTO and RPO decisions. Include regional isolation, recovery testing and a safe replay strategy."
      : level >= 3
        ? "Design a banking transaction notification service handling 5,000 events per second with retries, idempotency and monitoring. Quantify capacity, queue lag and degraded operation."
        : "Design a notification service supporting 100,000 users. Define the request/event flow, storage, queue, retries and basic monitoring; explain a duplicate-event scenario."
    : `${bankingCase.prompt} ${level >= 4 ? "Compare organization-wide alternatives, quantify uncertainty and define an escalation and governance model." : level >= 3 ? "Compare at least two approaches and justify a production rollout and measurement plan." : "Work through one bounded scenario, make assumptions explicit and state how you would validate the outcome."}`;
  return {
    prompt: `${prompt} Demonstrate level ${Math.min(5, Math.max(level, context.targetLevel))} reasoning relevant to your career target: ${context.careerTarget}.`,
    deliverables: [...bankingCase.deliverables],
    syntheticData: bankingCase.syntheticData,
  };
}

function createUnit(
  input: {
    skillId: string;
    fromLevel: number;
    toLevel: number;
    audience: string;
  },
  index: number,
  title: string,
  type: LearningUnitType,
  minutes: number,
  content: LearningUnitDefinition["content"],
  extra: Partial<LearningUnitDefinition> = {},
): LearningUnitDefinition {
  return {
    id: `unit-${index}`,
    title,
    description: title,
    type,
    estimatedMinutes: minutes,
    order: index,
    required: true,
    skillId: input.skillId,
    difficulty: Math.min(5, Math.max(1, input.toLevel)),
    learningObjectives: [],
    content,
    providerName: "Halyk TalentOS · synthetic demo",
    completionRequirement: [
      "QUIZ",
      "CASE_STUDY",
      "AI_TASK",
      "CODING_TASK",
      "PROJECT",
      "ASSESSMENT",
      "CERTIFICATION",
    ].includes(type)
      ? "Submit evidence and reach at least 70/100 against the published rubric."
      : "Read the material, reflect on the objectives, then record content completion. This alone does not verify a skill.",
    masteryPoints: 0,
    ...extra,
  };
}

function systemDesignUnits(input: {
  skillId: string;
  fromLevel: number;
  toLevel: number;
  audience: string;
}) {
  const quiz = createQuizDefinition(input.skillId);
  const rubric = { ...SYSTEM_DESIGN_RUBRIC };
  const task = getAdaptiveTask(input.skillId, {
    currentLevel: input.fromLevel,
    targetLevel: input.toLevel,
    careerTarget: input.audience,
  });
  return [
    createUnit(
      input,
      1,
      "Distributed Systems Fundamentals",
      "COURSE",
      35,
      {
        sections: [
          {
            title: "Start with the contract",
            body: "Specify users, peak events per second, payload size, latency and availability targets before choosing services. Distinguish accepting an event from delivering its notification. For the synthetic case, payment commitment must remain independent of an unavailable SMS provider.",
          },
          {
            title: "Decouple, then bound the work",
            body: "A durable queue separates producers from consumers. At 3,000 events/sec and 1 KB/event, ingress is approximately 3 MB/sec before replication and overhead. A ten-minute burst at 6,000 events/sec creates 1.8 million queued events if workers can serve only 3,000/sec. Choose retention, storage and backpressure limits explicitly.",
          },
          {
            title: "Expect duplicate delivery",
            body: "At-least-once delivery trades simpler recovery for possible duplicates. Persist a stable event ID and use an atomic state transition or uniqueness constraint before creating a business effect. Acknowledging before processing risks data loss; acknowledging after processing requires idempotency.",
          },
          {
            title: "Design for partial failure",
            body: "Network calls can time out even when the remote action succeeds. Use bounded timeouts, exponential backoff with jitter and a dead-letter queue. A circuit breaker limits repeated calls to an unhealthy dependency. Record the reason and ownership for replaying failed events.",
          },
          {
            title: "Measure what users experience",
            body: "Define a delivery-latency SLO and monitor the age of the oldest event, successful-delivery rate, retries and dead-letter volume. Correlate logs and traces using event IDs. Keep card numbers, secrets and full personal message content out of logs; restrict access and define retention.",
          },
        ],
      },
      {
        masteryPoints: 20,
        learningObjectives: [
          "Translate a business goal into measurable service constraints",
          "Explain delivery semantics and idempotency",
          "Plan for bounded retries, recovery and observability",
        ],
      },
    ),
    createUnit(
      input,
      2,
      "Database Scaling",
      "ARTICLE",
      25,
      {
        sections: [
          {
            title: "Model access patterns before scaling",
            body: "A notification record can include event_id, customer_id, channel, delivery_state, attempt_count and timestamps. An index on customer_id and created_at helps recent-history reads. A unique event/channel key prevents duplicate jobs. Measure read/write cost; every index adds write amplification.",
          },
          {
            title: "Replication is not the same as consistency",
            body: "Read replicas can reduce primary read load, but asynchronous replication permits stale reads and data loss on failover. Keep decisions needing read-after-write guarantees on an appropriate consistency path. State RPO for acceptable data loss and RTO for recovery duration.",
          },
          {
            title: "Partition and cache intentionally",
            body: "Partition by a stable key that distributes load while preserving needed ordering. Watch hot customers and hot keys. Use cache invalidation plus a bounded TTL, and request coalescing or staggered expiration to reduce stampedes. Do not let a stale preference bypass a customer's opt-out.",
          },
          {
            title: "Close the database-to-message gap",
            body: "A transactional outbox writes the business change and outgoing event in the same database transaction. A separate publisher reads the outbox and retries publishing. Consumers still deduplicate; an outbox does not create exactly-once execution across arbitrary external systems.",
          },
        ],
      },
      {
        learningObjectives: [
          "Choose indexes from access patterns",
          "Explain replication and partition trade-offs",
          "Use cache boundaries and the transactional outbox pattern",
        ],
      },
    ),
    createUnit(
      input,
      3,
      "Design a URL Shortener",
      "CASE_STUDY",
      45,
      {
        basicPractice: true,
        prompt:
          "Design an internal short-link service for synthetic bank campaigns. Compare random tokens with sequential IDs, handle collisions, define expiration and restrict malicious destinations. Estimate read/write load and explain cache invalidation after revoking a link.",
        deliverables: [
          "API and data model",
          "Collision and abuse controls",
          "Cache and expiration policy",
          "Failure and observability checklist",
        ],
        syntheticData:
          "Synthetic load: 100 new links/minute; 5,000 redirects/second; 90-day expiration; one unusually popular campaign can receive 40% of redirects.",
        sections: [
          {
            title: "Guided practice",
            body: "Write a one-page design. Begin with POST /links and GET /:token, then identify the storage key, uniqueness guarantee and revocation flow. Compare a cache-aside lookup with a database-only design. This optional practice earns no mastery points and is distinct from assessed evidence.",
          },
        ],
      },
      {
        required: false,
        assessmentConfig: { rubric },
        learningObjectives: [
          "Practice an API/storage/cache decomposition",
          "Identify a hot-key and revocation trade-off",
        ],
        completionRequirement:
          "Submit a short design reflection, or skip after an assessment score of at least 85.",
      },
    ),
    createUnit(
      input,
      4,
      "Payment Notification Architecture",
      "AI_TASK",
      60,
      {
        ...task,
        sections: [
          {
            title: "Assessment rubric",
            body: "Scalability 20 · Reliability 20 · Data architecture 20 · Failure handling 20 · Observability 10 · Security 10. Explain decisions and trade-offs in complete sentences. Without an LLM key, a transparent demo heuristic checks concept coverage; it does not certify real-world correctness.",
          },
        ],
      },
      {
        masteryPoints: 30,
        assessmentConfig: { rubric },
        learningObjectives: [
          "Apply an architecture to a banking workload",
          "Make failure handling and operational controls explicit",
        ],
      },
    ),
    createUnit(
      input,
      5,
      "System Design Assessment",
      "QUIZ",
      25,
      {
        questions: quiz.questions,
        sections: [
          {
            title: "Knowledge check",
            body: "Answer all 15 questions. Passing requires 70%. Answer explanations and weak topics are shown after submission. A failed attempt creates review modules; completed reviews unlock a retry.",
          },
        ],
      },
      {
        masteryPoints: 20,
        assessmentConfig: quiz.assessmentConfig,
        learningObjectives: [
          "Verify understanding of delivery semantics, scaling, data and operational risk",
        ],
      },
    ),
    createUnit(
      input,
      6,
      "Architecture Review",
      "PROJECT",
      100,
      {
        prompt:
          "Produce an architecture review of the synthetic transaction-notification case. Refine your practice solution using the assessment feedback. Include a text diagram, capacity calculation, data model, delivery semantics, failover plan, security controls, SLOs and an explicit fault-injection acceptance test. Compare at least one rejected alternative.",
        deliverables: [
          "Reviewed component/data-flow design and assumptions",
          "Capacity and data model with indexes",
          "Duplicate/provider-outage/failover behavior",
          "Security, observability, trade-offs and acceptance tests",
        ],
        syntheticData: BANKING_CASES[0].syntheticData,
        sections: [
          {
            title: "Review standard",
            body: "A project is evidence of applied reasoning, not a checkbox. The same six-dimension rubric is applied to the written design. Some paths also require simulated HR/mentor approval; the interface labels that approval clearly.",
          },
        ],
      },
      {
        masteryPoints: 20,
        assessmentConfig: { rubric },
        learningObjectives: [
          "Integrate the design into a reviewable work product",
          "Evaluate alternatives and test failure claims",
        ],
      },
    ),
    createUnit(
      input,
      7,
      "Final Skill Verification",
      "ASSESSMENT",
      40,
      {
        prompt:
          "Defend your final architecture. A provider is unavailable for 20 minutes, one partition is twice as busy as expected, and a consumer is restarted after sending but before acknowledging. Explain the state transitions, idempotency, bounded retries, dead-letter replay, consistency, recovery targets, capacity, security and monitoring. Describe which test would disprove your assumptions.",
        deliverables: [
          "Failure-scenario reasoning",
          "Consistency and recovery trade-offs",
          "Capacity, data, security and observability checks",
          "Final acceptance criteria",
        ],
        syntheticData:
          "Synthetic failure exercise; no production access, real transactions or customer information is used.",
        sections: [
          {
            title: "Verification gate",
            body: "The final assessment must pass with at least 70/100. All required units and required mentor approval must be complete, and mastery must reach 70/100. Only then can the configured skill gain be applied once, capped by the activity's maximum level. Simply opening modules never changes a skill.",
          },
        ],
      },
      {
        assessmentConfig: { rubric },
        learningObjectives: [
          "Defend an integrated solution against new failure conditions",
        ],
      },
    ),
  ];
}

export function generateLearningPath(input: {
  skillId: string;
  skillName: string;
  fromLevel: number;
  toLevel: number;
  audience: string;
  title?: string;
}): LearningPathDraft {
  if (
    !input.skillId.trim() ||
    !input.skillName.trim() ||
    !input.audience.trim() ||
    !Number.isInteger(input.fromLevel) ||
    !Number.isInteger(input.toLevel) ||
    input.fromLevel < 0 ||
    input.toLevel > 5 ||
    input.toLevel <= input.fromLevel
  )
    throw new Error(
      "Provide a skill, audience and increasing skill levels between 0 and 5.",
    );
  const systemDesign = /SYSTEM_DESIGN|DATABASES|CLOUD|DEVOPS|API/.test(
    input.skillId,
  );
  const bankingCase = getBankingCase(input.skillId);
  const units = systemDesign ? systemDesignUnits(input) : genericUnits(input);
  return {
    title:
      input.title?.trim() ||
      `${input.skillName}: level ${input.fromLevel} → ${input.toLevel}`,
    description: `A structured development journey for ${input.audience}: learn, practice, apply and verify ${input.skillName.toLowerCase()} using synthetic banking cases.`,
    skillId: input.skillId,
    fromLevel: input.fromLevel,
    toLevel: input.toLevel,
    audience: input.audience,
    masteryThreshold: 70,
    requiresApproval: false,
    learningObjectives: [
      `Apply ${input.skillName} to a bounded enterprise problem.`,
      "Explain assumptions, evidence, trade-offs and operational risks.",
      `Produce assessed evidence relevant to ${input.audience}.`,
      `Practice with the synthetic case: ${bankingCase.title}.`,
    ],
    units,
    status: "DRAFT",
    generator: "deterministic",
    estimatedMinutes: units.reduce(
      (sum, unit) => sum + unit.estimatedMinutes,
      0,
    ),
  };
}

function genericUnits(input: {
  skillId: string;
  skillName: string;
  fromLevel: number;
  toLevel: number;
  audience: string;
}) {
  const bankingCase = getBankingCase(input.skillId);
  const task = getAdaptiveTask(input.skillId, {
    currentLevel: input.fromLevel,
    targetLevel: input.toLevel,
    careerTarget: input.audience,
  });
  const quiz = createQuizDefinition(input.skillId);
  const rubric = { ...SYSTEM_DESIGN_RUBRIC };
  return [
    createUnit(
      input,
      1,
      `${input.skillName} in Context`,
      "COURSE",
      30,
      {
        sections: [
          {
            title: "Frame the decision",
            body: `Define who benefits from ${input.skillName.toLowerCase()}, the measurable outcome, current baseline and constraints. Keep assumptions separate from observed data. Start with one decision that can be reviewed and tested, then compare two realistic options.`,
          },
          {
            title: "Work from evidence",
            body: "Use the supplied synthetic case. Calculate relevant rates or document the stakeholder evidence; segment where averages conceal differences. A correlation or one anecdote does not establish a cause. State what additional information would change your decision.",
          },
          {
            title: "Make the plan testable",
            body: "Set a primary success metric, guardrails, a decision threshold, a monitoring cadence and an owner. Describe a low-risk experiment or staged rollout. Define failure, escalation and rollback before implementation. Preserve privacy with synthetic records and least-privilege access.",
          },
          {
            title: "Document the judgment",
            body: "A reviewer should understand the problem, alternatives, decision, risks and verification without being present at a meeting. Record uncertainty and outstanding checks. Completing this lesson is content consumption; assessed work products provide separate evidence of application.",
          },
        ],
      },
      {
        masteryPoints: 20,
        learningObjectives: [
          "Frame a bounded decision",
          "Use synthetic evidence responsibly",
          "Define a reviewable verification plan",
        ],
      },
    ),
    createUnit(
      input,
      2,
      "Evidence, Trade-offs and Guardrails",
      "ARTICLE",
      20,
      {
        sections: [
          {
            title: "Avoid premature certainty",
            body: "List at least two explanations for the observed problem and one piece of evidence that would distinguish them. Check whether instrumentation, population mix or timing changed. Quantify uncertainty rather than presenting a hypothesis as a fact.",
          },
          {
            title: "Design an accountable response",
            body: "Compare expected benefit, implementation cost and downside risk. Select one option and explain why alternatives were rejected. Assign an accountable owner and measurable review date. Define access, privacy, audit and rollback requirements relevant to the case.",
          },
        ],
      },
      {
        learningObjectives: [
          "Distinguish fact from hypothesis",
          "Turn risk into explicit checks",
        ],
      },
    ),
    createUnit(
      input,
      3,
      bankingCase.title,
      "CASE_STUDY",
      35,
      {
        prompt: bankingCase.prompt,
        deliverables: [...bankingCase.deliverables],
        syntheticData: bankingCase.syntheticData,
        basicPractice: true,
        sections: [
          {
            title: "Optional practice",
            body: "Draft your reasoning before attempting assessed work. This practice records learning progress but grants no mastery by itself.",
          },
        ],
      },
      {
        required: false,
        assessmentConfig: { rubric },
        learningObjectives: [
          "Apply the framework to one synthetic banking case",
        ],
      },
    ),
    createUnit(
      input,
      4,
      `${input.skillName} Practice Challenge`,
      "AI_TASK",
      45,
      {
        ...task,
        sections: [
          {
            title: "Published rubric",
            body: "Scope and feasibility 20 · Decision quality 20 · Evidence and analysis 20 · Risk management 20 · Measurement 10 · Responsible handling 10. The stored dimension keys are shared with the architecture rubric, but assessment guidance is tailored to this case. Demo evaluation measures concept coverage and requires human review for real personnel decisions.",
          },
        ],
      },
      {
        masteryPoints: 30,
        assessmentConfig: { rubric },
        learningObjectives: ["Produce and defend a practical solution"],
      },
    ),
    createUnit(
      input,
      5,
      "Applied Judgment Knowledge Check",
      "QUIZ",
      15,
      { questions: quiz.questions },
      {
        masteryPoints: 20,
        assessmentConfig: quiz.assessmentConfig,
        learningObjectives: [
          "Verify framing, evidence, risk and privacy principles",
        ],
      },
    ),
    createUnit(
      input,
      6,
      `${input.skillName} Applied Project`,
      "PROJECT",
      70,
      {
        prompt: `Produce a reviewable decision memo for this case: ${bankingCase.prompt} Include your objective, assumptions, synthetic evidence and baseline, segments, alternatives and trade-offs, accountable owner, test or experiment, metrics and thresholds, risks/guardrails and rollback, and privacy/access/audit safeguards.`,
        deliverables: [...bankingCase.deliverables],
        syntheticData: bankingCase.syntheticData,
      },
      {
        masteryPoints: 20,
        assessmentConfig: { rubric },
        learningObjectives: [
          "Integrate the learning into a work product with acceptance criteria",
        ],
      },
    ),
    createUnit(
      input,
      7,
      "Final Skill Verification",
      "ASSESSMENT",
      30,
      {
        prompt: `Defend your ${input.skillName.toLowerCase()} project after a reviewer challenges one assumption. Explain the goal and constraints, data/baseline and segment evidence, alternative options and trade-offs, validation experiment and monitoring thresholds, failure risks and rollback owner, and responsible synthetic-data/privacy/access/audit handling. State what evidence would change your decision.`,
        deliverables: [
          "Evidence-backed defense",
          "Revised plan and acceptance checks",
        ],
        sections: [
          {
            title: "Advancement gate",
            body: "A final passing score, required-unit completion and at least 70 mastery points are needed before an activity's configured skill gain can be applied. Some paths also require explicit HR/mentor approval.",
          },
        ],
      },
      {
        assessmentConfig: { rubric },
        learningObjectives: ["Defend and revise a decision using evidence"],
      },
    ),
  ];
}

export function createLearningPath(
  activity: Activity,
  skills: Skill[],
): LearningPathDefinition {
  const gain = activity.gains[0];
  const skill = skills.find((item) => item.id === gain?.skillId);
  const skillId = gain?.skillId ?? skills[0]?.id ?? "SK_SYSTEM_DESIGN";
  const toLevel = Math.min(5, Math.max(1, gain?.maxLevel === 2 ? 2 : 3));
  const draft = generateLearningPath({
    skillId,
    skillName: skill?.name ?? "Professional skill",
    fromLevel: Math.max(0, toLevel - 1),
    toLevel,
    audience: "Banking professionals",
    title: activity.name,
  });
  const units = draft.units.map((unit) => ({
    ...unit,
    id: `${activity.id}-${unit.id}`,
  }));
  if (/Mentor/i.test(activity.type)) {
    units.splice(5, 0, {
      ...createUnit(
        {
          skillId,
          fromLevel: draft.fromLevel,
          toLevel,
          audience: draft.audience,
        },
        6,
        "Mentor Review Session",
        "MENTOR_SESSION",
        30,
        {
          prompt:
            "Discuss the assessed project with a mentor. Record feedback, unresolved questions and a follow-up plan. HR performs a clearly labeled simulated approval in this demo.",
          sections: [
            {
              title: "Human review",
              body: "Self-reporting attendance is not mentor validation. The optional approval flow is completed by HR after required assessments and project evidence are ready.",
            },
          ],
        },
      ),
      id: `${activity.id}-mentor`,
      required: false,
      learningObjectives: [
        "Review project evidence with a mentor and record an accountable follow-up plan.",
      ],
      completionRequirement:
        "HR records simulated mentor validation after the required assessed work is complete.",
    });
    units.forEach((unit, index) => {
      unit.order = index + 1;
    });
  }
  if (/PYTHON|TYPESCRIPT|REACT/.test(skillId)) units[3].type = "CODING_TASK";
  if (/Video/i.test(activity.type)) units[0].type = "VIDEO";
  if (/Certification/i.test(activity.type))
    units[units.length - 2].type = "CERTIFICATION";
  return {
    title: draft.title,
    description: draft.description,
    skillId,
    fromLevel: draft.fromLevel,
    toLevel: draft.toLevel,
    audience: draft.audience,
    learningObjectives: draft.learningObjectives,
    masteryThreshold: 70,
    requiresApproval: /Mentor/i.test(activity.type) || activity.id === "EV018",
    units,
  };
}

const remediationContent: Record<string, { title: string; body: string }> = {
  "failure handling": {
    title: "Retry & Dead Letter Queues",
    body: "Retry transient failures with exponential backoff, jitter and a strict attempt/time budget. Keep the original event ID across retries and replay. After the budget expires, move the event to a dead-letter queue with its failure reason. Assign an owner, fix the cause, then replay with audit records and idempotency checks. Never silently drop failures or retry forever.",
  },
  caching: {
    title: "Caching Strategies Review",
    body: "Choose a cache key and bounded TTL based on allowed staleness. Invalidate on changes where possible. Use request coalescing and staggered TTLs to reduce stampedes. Cache misses must have a capacity limit; a cache is not a substitute for a correctly indexed store. Explain how an opt-out or revoked link takes effect.",
  },
  scalability: {
    title: "Capacity & Backpressure Review",
    body: "Estimate peak arrival rate, service time, payload size and retention. Queue growth equals incoming work minus processed work over time. Measure worker capacity, partition hot keys and define bounded backpressure before memory or storage is exhausted.",
  },
  reliability: {
    title: "Recovery & Availability Review",
    body: "State the availability SLO, RTO and RPO. Explain replication lag, failover conditions and recovery ownership. Test the loss of a component and verify observed recovery against these objectives; redundancy alone is not proof of availability.",
  },
  "data architecture": {
    title: "Data Models & Consistency Review",
    body: "List entities, access patterns, indexes and unique keys. Define transaction boundaries and consistency needs. Explain how an outbox publishes committed changes and why consumers still require idempotency. Compare storage trade-offs against the actual workload.",
  },
  observability: {
    title: "SLOs, Metrics & Tracing Review",
    body: "Select user-visible success and latency indicators. Track queue age, failure and retry rates, correlate traces with event IDs and set actionable alert thresholds. Give each alert an owner and a response; log volume alone is not observability.",
  },
  security: {
    title: "Privacy & Access Controls Review",
    body: "Use synthetic data for the exercise. Apply least-privilege access, transport/storage encryption, redaction and audit logging. Define retention and review who can read operational data. Never include card credentials or real customer records in training submissions.",
  },
};

export function createRemediationUnits(
  unit: LearningUnitDefinition,
  weakTopics: string[],
): LearningUnitDefinition[] {
  const topics = [
    ...new Set(weakTopics.map((topic) => topic.trim()).filter(Boolean)),
  ].slice(0, 4);
  return (topics.length ? topics : ["Failure handling", "Caching"]).map(
    (topic, index) => {
      const key = topic.toLowerCase();
      const material = remediationContent[key] ?? {
        title: `${topic} Review`,
        body: `Revisit ${topic.toLowerCase()} in your solution. State the objective, relevant synthetic evidence, assumptions, alternative choices, risk, responsible owner and a measurable verification check. Compare the feedback with the case constraints, then explain what you would change before retrying.`,
      };
      const slug =
        key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
        `topic-${index}`;
      return {
        id: `${unit.id}-review-${slug}`,
        title: material.title,
        description: `Targeted review after an unsuccessful ${unit.title} attempt.`,
        type: "ARTICLE",
        estimatedMinutes: 15,
        order: unit.order,
        required: true,
        skillId: unit.skillId,
        difficulty: unit.difficulty,
        learningObjectives: [
          `Address the assessment gap in ${topic.toLowerCase()}.`,
        ],
        content: { sections: [{ title: material.title, body: material.body }] },
        completionRequirement:
          "Review the material and record completion before retrying the failed assessment.",
        masteryPoints: 0,
        isRemediation: true,
        providerName: "Halyk TalentOS · synthetic demo",
      };
    },
  );
}
