import type {
  Activity,
  Employee,
  Mission,
  Requirement,
  Skill,
} from "@shared/types/index";

const skillNames = [
  ["PYTHON", "Python", "Technical"],
  ["SYSTEM_DESIGN", "System Design", "Technical"],
  ["DATABASES", "Databases", "Technical"],
  ["LEADERSHIP", "Leadership", "People"],
  ["PUBLIC_SPEAKING", "Public Speaking", "People"],
  ["CLOUD", "Cloud", "Technical"],
  ["DEVOPS", "DevOps", "Technical"],
  ["ML", "Machine Learning", "Technical"],
  ["DATA_ENGINEERING", "Data Engineering", "Technical"],
  ["RISK", "Risk Analytics", "Business"],
  ["SECURITY", "Cybersecurity", "Technical"],
  ["TYPESCRIPT", "TypeScript", "Technical"],
  ["REACT", "React", "Technical"],
  ["ANALYTICS", "Data Analytics", "Business"],
  ["COMMUNICATION", "Communication", "People"],
  ["MENTORING", "Mentoring", "People"],
  ["STRATEGY", "Strategic Thinking", "Business"],
  ["AGILE", "Agile Delivery", "Business"],
  ["PRODUCT", "Product Discovery", "Business"],
  ["UX", "User Research", "Business"],
  ["COMPLIANCE", "Compliance", "Business"],
  ["API", "API Design", "Technical"],
  ["TESTING", "Testing", "Technical"],
  ["AI", "Applied AI", "Technical"],
];
export const seedSkills: Skill[] = skillNames.map(([code, name, category]) => ({
  id: `SK_${code}`,
  skillCode: `SK_${code}`,
  name,
  category,
}));
function req(
  role: string,
  grade: string,
  values: [string, number, number][],
): Requirement[] {
  return values.map(([s, requiredLevel, weight]) => ({
    role,
    grade,
    skillId: `SK_${s}`,
    requiredLevel,
    weight,
  }));
}
export const seedRequirements: Requirement[] = [
  ...req("Backend Engineer", "Senior", [
    ["PYTHON", 4, 0.14],
    ["DATABASES", 4, 0.14],
    ["SYSTEM_DESIGN", 4, 0.32],
    ["LEADERSHIP", 3, 0.24],
    ["CLOUD", 4, 0.16],
  ]),
  ...req("Backend Engineer", "Middle", [
    ["PYTHON", 3, 0.4],
    ["DATABASES", 3, 0.3],
    ["SYSTEM_DESIGN", 2, 0.3],
  ]),
  ...req("DevOps Engineer", "Senior", [
    ["CLOUD", 4, 0.35],
    ["DEVOPS", 4, 0.3],
    ["SYSTEM_DESIGN", 3, 0.2],
    ["SECURITY", 3, 0.15],
  ]),
  ...req("Solution Architect", "Senior", [
    ["SYSTEM_DESIGN", 5, 0.4],
    ["CLOUD", 4, 0.25],
    ["DATABASES", 4, 0.2],
    ["COMMUNICATION", 4, 0.15],
  ]),
  ...req("Team Lead", "Lead", [
    ["LEADERSHIP", 4, 0.35],
    ["MENTORING", 4, 0.3],
    ["STRATEGY", 4, 0.2],
    ["COMMUNICATION", 4, 0.15],
  ]),
  ...req("Data Scientist", "Senior", [
    ["PYTHON", 4, 0.2],
    ["ML", 4, 0.3],
    ["DATA_ENGINEERING", 4, 0.2],
    ["AI", 4, 0.2],
    ["RISK", 3, 0.1],
  ]),
  ...req("Frontend Engineer", "Senior", [
    ["TYPESCRIPT", 4, 0.25],
    ["REACT", 4, 0.3],
    ["SYSTEM_DESIGN", 3, 0.25],
    ["LEADERSHIP", 3, 0.2],
  ]),
  ...req("Product Analyst", "Senior", [
    ["ANALYTICS", 4, 0.3],
    ["PRODUCT", 4, 0.3],
    ["UX", 3, 0.2],
    ["COMMUNICATION", 4, 0.2],
  ]),
];
function event(
  id: string,
  name: string,
  category: string,
  skills: string[],
  hours = 6,
  type = "Workshop",
  priority = 0.8,
  maxLevel = 4,
): Activity {
  return {
    id,
    eventCode: id,
    name,
    category,
    hours,
    type,
    businessPriority: priority,
    minTenureMonths: 0,
    description: `${name.includes("Mission") || type === "Mission" ? "Put your skills into practice with a cross-functional team." : "Build practical expertise through guided exercises and feedback from experienced practitioners."} Take away skills you can apply to real banking challenges.`,
    gains: skills.map((skill) => ({
      skillId: `SK_${skill}`,
      gain: 1,
      maxLevel,
    })),
  };
}
export const seedEvents: Activity[] = [
  event(
    "EV017",
    "Advanced System Design Workshop",
    "Architecture",
    ["SYSTEM_DESIGN"],
    6,
    "Workshop",
    1,
  ),
  event(
    "EV018",
    "Architecture Design Lab",
    "Architecture",
    ["SYSTEM_DESIGN"],
    10,
    "Project",
    0.65,
    5,
  ),
  event(
    "EV003",
    "Public Speaking Workshop",
    "Communication",
    ["PUBLIC_SPEAKING"],
    4,
    "Workshop",
    0.35,
  ),
  event(
    "EV004",
    "Presentation Masterclass",
    "Communication",
    ["PUBLIC_SPEAKING", "COMMUNICATION"],
    4,
    "Masterclass",
    0.4,
  ),
  event(
    "EV005",
    "Communication Workshop",
    "Communication",
    ["COMMUNICATION"],
    3,
    "Workshop",
    0.4,
  ),
  event(
    "EV006",
    "Backend Architecture Basics",
    "Architecture",
    ["SYSTEM_DESIGN"],
    4,
    "Workshop",
    0.5,
    2,
  ),
  event(
    "EV007",
    "Database Scaling Workshop",
    "Architecture",
    ["DATABASES"],
    6,
    "Workshop",
    0.7,
  ),
  event(
    "EV008",
    "Leadership in Practice",
    "Leadership",
    ["LEADERSHIP"],
    8,
    "Workshop",
    0.75,
  ),
  event(
    "EV009",
    "Cloud Foundations Intensive",
    "Cloud",
    ["CLOUD"],
    8,
    "Course",
    0.8,
  ),
  event(
    "EV010",
    "Python for Production",
    "Engineering",
    ["PYTHON"],
    5,
    "Course",
    0.8,
  ),
  event(
    "EV011",
    "MLOps Bootcamp",
    "Data & AI",
    ["ML", "DEVOPS"],
    16,
    "Bootcamp",
    0.9,
  ),
  event(
    "EV012",
    "Modern Data Pipelines",
    "Data & AI",
    ["DATA_ENGINEERING"],
    8,
    "Workshop",
    0.9,
  ),
  event(
    "EV013",
    "Secure Banking APIs",
    "Engineering",
    ["SECURITY", "API"],
    6,
    "Workshop",
    0.85,
  ),
  event(
    "EV014",
    "Mentoring Circle",
    "Leadership",
    ["MENTORING"],
    4,
    "Mentoring",
    0.7,
  ),
  event(
    "EV015",
    "Applied AI for Banking",
    "Data & AI",
    ["AI", "ML"],
    10,
    "Course",
    0.95,
  ),
  event(
    "EV016",
    "Product Discovery Sprint",
    "Product",
    ["PRODUCT", "UX"],
    8,
    "Project",
    0.7,
  ),
  event(
    "EV019",
    "TypeScript at Scale",
    "Engineering",
    ["TYPESCRIPT", "REACT"],
    6,
    "Workshop",
    0.75,
  ),
  event(
    "EV020",
    "Analytics for Decisions",
    "Product",
    ["ANALYTICS", "STRATEGY"],
    5,
    "Course",
    0.7,
  ),
  event(
    "EV021",
    "Fraud Detection AI Initiative",
    "Data & AI",
    ["ML", "RISK"],
    30,
    "Mission",
    0.95,
  ),
  event(
    "EV022",
    "Cloud Migration Mission",
    "Cloud",
    ["CLOUD", "DEVOPS"],
    40,
    "Mission",
    0.9,
  ),
];
export const seedMissions: Mission[] = [
  {
    id: "MS001",
    eventId: "EV021",
    name: "Fraud Detection AI Initiative",
    description:
      "Help a cross-functional team detect emerging fraud patterns and make everyday banking safer.",
    duration: 6,
    commitment: 5,
    skills: [
      { skillId: "SK_PYTHON", requiredLevel: 3 },
      { skillId: "SK_ML", requiredLevel: 2 },
      { skillId: "SK_RISK", requiredLevel: 2 },
    ],
  },
  {
    id: "MS002",
    eventId: "EV022",
    name: "Cloud Migration Mission",
    description:
      "Shape the next generation of banking infrastructure. Move a real service to a resilient cloud architecture.",
    duration: 8,
    commitment: 5,
    skills: [
      { skillId: "SK_CLOUD", requiredLevel: 2 },
      { skillId: "SK_SYSTEM_DESIGN", requiredLevel: 2 },
      { skillId: "SK_DEVOPS", requiredLevel: 2 },
    ],
  },
];
const names = [
  "Aidar Sarsenov",
  "Aigerim Bekova",
  "Daniyar Omarov",
  "Dana Akhmetova",
  "Alikhan Nurlybek",
  "Madina Sadykova",
  "Timur Ibragimov",
  "Aruzhan Karimova",
  "Nurlan Askarov",
  "Kamila Zhaksylyk",
  "Arman Tulegenov",
  "Amina Seitova",
  "Dias Mukhanov",
  "Zarina Beketova",
  "Sanzhar Alimov",
  "Asel Nurpeisova",
  "Miras Kairatov",
  "Sabina Ospanova",
  "Olzhas Rakhimov",
  "Dinara Serikova",
  "Adil Tursunov",
  "Ayaulym Kenzhe",
  "Rustem Iskakov",
  "Ainur Sultanova",
];
export function createSeedEmployees(now = new Date()): Employee[] {
  return Array.from({ length: 48 }, (_, i) => {
    const role = [
      "Backend Engineer",
      "Data Scientist",
      "Frontend Engineer",
      "Product Analyst",
      "DevOps Engineer",
    ][i % 5];
    const employee: Employee = {
      id: `EMP${String(i + 1).padStart(3, "0")}`,
      employeeId: i === 0 ? "DEMO-AIDAR" : `HLK-${1000 + i}`,
      name: names[i % 24] + (i >= 24 ? " Jr." : ""),
      role,
      grade: "Middle",
      department: [
        "Digital Banking",
        "Data & AI",
        "Customer Experience",
        "Products",
        "Technology",
      ][i % 5],
      tenureMonths: 12 + ((i * 7) % 72),
      targetRole: role,
      targetGrade: "Senior",
      skills: seedSkills.map((s, j) => ({
        skillId: s.id,
        level: 1 + ((i * 3 + j * 7) % 5),
      })),
      history: [],
    };
    employee.history = seedEvents.slice(2, 2 + (i % 8) + 3).map((e, j) => {
      const date = new Date(now);
      date.setMonth(date.getMonth() - 1 - (j % 6));
      const status =
        (i + j) % 5 === 0
          ? "SKIPPED"
          : (i + j) % 7 === 0
            ? "IN_PROGRESS"
            : "COMPLETED";
      return {
        eventId: e.id,
        status,
        createdAt: date.toISOString(),
        completedAt: status === "COMPLETED" ? date.toISOString() : null,
      };
    });
    if (i === 0) {
      employee.tenureMonths = 52;
      const levels: Record<string, number> = {
        SK_PYTHON: 4,
        SK_SYSTEM_DESIGN: 2,
        SK_DATABASES: 4,
        SK_LEADERSHIP: 2,
        SK_PUBLIC_SPEAKING: 1,
        SK_CLOUD: 2,
        SK_DEVOPS: 2,
        SK_ML: 1,
        SK_RISK: 1,
        SK_COMMUNICATION: 3,
      };
      employee.skills = employee.skills.map((s) => ({
        ...s,
        level: levels[s.skillId] ?? 2,
      }));
      employee.history = ["EV003", "EV004", "EV005", "EV006", "EV007"].map(
        (eventId, j) => {
          const date = new Date(now);
          date.setMonth(date.getMonth() - 6 + j);
          return {
            eventId,
            status: j < 3 ? "SKIPPED" : "COMPLETED",
            createdAt: date.toISOString(),
            completedAt: j < 3 ? null : date.toISOString(),
          };
        },
      );
    }
    return employee;
  });
}
