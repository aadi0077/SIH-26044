// ─── Hackathon demo seed ─────────────────────────────────────────────────────
// Generates: 24 skills, 50 students, 6 industries, 20 opportunities,
// ~300 student-skill links, ~90 opportunity requirements, ~100 applications
// (with matchScore pre-calculated by the REAL Smart Match engine), SkillGap
// rows for every student's top-3 opportunities, and SkillHistory progress
// snapshots — so the dashboard is alive on first load.
//
// Run:  npm run seed
// Re-run safely: wipes module tables first (FK order).

import "dotenv/config";
import { faker } from "@faker-js/faker";
import { db } from "./src/prisma/db.ts";
import { scorePair } from "./src/services/matchingService.js";

faker.seed(26044);
const pick = (arr) => faker.helpers.arrayElement(arr);
const pickMany = (arr, min, max) => faker.helpers.arrayElements(arr, { min, max });

// ── Master data ─────────────────────────────────────────────────────────────
const SKILLS = [
  ["React", "TECHNICAL"], ["TypeScript", "TECHNICAL"], ["JavaScript", "TECHNICAL"],
  ["Node.js", "TECHNICAL"], ["Express", "TECHNICAL"], ["Python", "TECHNICAL"],
  ["Java", "TECHNICAL"], ["C++", "TECHNICAL"], ["PostgreSQL", "TECHNICAL"],
  ["MongoDB", "TECHNICAL"], ["REST APIs", "TECHNICAL"], ["GraphQL", "TECHNICAL"],
  ["Docker", "TECHNICAL"], ["Kubernetes", "TECHNICAL"], ["AWS", "TECHNICAL"],
  ["CI/CD", "TECHNICAL"], ["Git", "TECHNICAL"], ["Linux", "TECHNICAL"],
  ["Machine Learning", "DOMAIN"], ["Deep Learning", "DOMAIN"], ["TensorFlow", "TECHNICAL"],
  ["Data Analysis", "DOMAIN"], ["Power BI", "TECHNICAL"], ["Excel", "TECHNICAL"],
  ["Figma", "TECHNICAL"], ["Communication", "SOFT"], ["Teamwork", "SOFT"],
];

// Role -> skills that matter for it (affinity drives coherent demo data).
const ROLE_SKILLS = {
  "Frontend Developer": ["React", "TypeScript", "JavaScript", "REST APIs", "Git", "Figma"],
  "Backend Developer": ["Node.js", "Express", "PostgreSQL", "MongoDB", "REST APIs", "Docker", "Git", "Linux"],
  "Full Stack Developer": ["React", "Node.js", "TypeScript", "PostgreSQL", "REST APIs", "Docker", "Git"],
  "Data Analyst": ["Python", "Data Analysis", "PostgreSQL", "Power BI", "Excel", "Communication"],
  "ML Engineer": ["Python", "Machine Learning", "Deep Learning", "TensorFlow", "Data Analysis", "Linux"],
  "DevOps Engineer": ["Docker", "Kubernetes", "AWS", "CI/CD", "Linux", "Git", "Python"],
};
const ROLES = Object.keys(ROLE_SKILLS);
const DEPARTMENTS = ["CSE", "IT", "ECE", "EEE", "MECH"];

const PROJECT_TEMPLATES = {
  "Frontend Developer": ["{skill} dashboard for campus placements", "E-commerce UI clone in {skill}", "{skill} portfolio site with animations"],
  "Backend Developer": ["{skill} REST API for hostel management", "Auth microservice with {skill}", "Real-time chat backend ({skill})"],
  "Full Stack Developer": ["MERN event booking platform", "Full-stack {skill} inventory app", "Online test portal (React + {skill})"],
  "Data Analyst": ["Campus placement trends ({skill} + Power BI)", "Sales dashboard using {skill}", "IPL data analysis with {skill}"],
  "ML Engineer": ["Crop-yield prediction ({skill})", "Image classifier with {skill}", "Sentiment analysis using {skill}"],
  "DevOps Engineer": ["{skill} + CI/CD pipeline for a Node app", "Kubernetes homelab with {skill}", "AWS cost monitor ({skill})"],
};

const INDUSTRIES = [
  { name: "TechNova Solutions", email: "hr@technova.in", sector: "IT Services", city: "Pune" },
  { name: "FinEdge Analytics", email: "careers@finedge.in", sector: "Fintech", city: "Mumbai" },
  { name: "HealthSync Labs", email: "jobs@healthsync.in", sector: "HealthTech", city: "Bengaluru" },
  { name: "AutoDrive Motors", email: "talent@autodrive.in", sector: "Automotive", city: "Chennai" },
  { name: "EduSpark", email: "hiring@eduspark.in", sector: "EdTech", city: "Hyderabad" },
  { name: "CloudNine Infra", email: "people@cloudnine.in", sector: "Cloud", city: "Noida" },
];

const OPP_TITLES = {
  "Frontend Developer": ["Frontend Developer Intern", "Junior Frontend Engineer", "React Developer"],
  "Backend Developer": ["Backend Developer", "Node.js Developer Intern", "API Engineer"],
  "Full Stack Developer": ["Full Stack Developer", "MERN Stack Intern", "Software Engineer Trainee"],
  "Data Analyst": ["Data Analyst Intern", "Business Intelligence Intern", "Junior Data Analyst"],
  "ML Engineer": ["ML Intern", "AI Research Intern", "Junior ML Engineer"],
  "DevOps Engineer": ["DevOps Intern", "Cloud Support Engineer", "SRE Trainee"],
};

// ── Helpers ─────────────────────────────────────────────────────────────────
async function wipe() {
  // FK-safe order: children before parents. id.gt(0) matches every row.
  for (const model of ["SkillGap", "Application", "StudentSkill", "OpportunitySkill", "SkillHistory", "Certification"]) {
    await db.orm.public[model].where((m) => m.id.gt(0)).deleteAll();
  }
  for (const model of ["Opportunity", "Student", "Industry", "Skill"]) {
    await db.orm.public[model].where((m) => m.id.gt(0)).deleteAll();
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Wiping existing module data…");
  await wipe();

  // 1. Skills
  const skillRows = await db.orm.public.Skill.createAll(
    SKILLS.map(([name, category]) => ({ name, category })),
  );
  const skillId = new Map(skillRows.map((s) => [s.name, s.id]));
  console.log(`  skills: ${skillRows.length}`);

  // 2. Students (role-coherent tech stacks)
  const studentInputs = Array.from({ length: 50 }, (_, i) => {
    const targetRole = faker.helpers.weightedArrayElement(
      ROLES.map((r) => ({ weight: 1, value: r })),
    );
    const affinity = ROLE_SKILLS[targetRole];
    const projectNames = pickMany(PROJECT_TEMPLATES[targetRole], 1, 3).map((t) =>
      t.replace("{skill}", pick(affinity)),
    );
    return {
      email: `student${String(i + 1).padStart(2, "0")}@aitpune.edu.in`,
      name: faker.person.fullName(),
      college: faker.helpers.weightedArrayElement([
        { weight: 8, value: "AIT Pune" },
        { weight: 1, value: "COEP Pune" },
        { weight: 1, value: "PICT Pune" },
      ]),
      department: pick(DEPARTMENTS),
      cgpa: Math.round((6 + faker.number.float({ min: 0, max: 3.8 })) * 100) / 100,
      gradYear: pick([2026, 2026, 2026, 2027]),
      targetRole,
      projects: projectNames,
      isActive: true,
      _role: targetRole, // local only — stripped before insert
    };
  });
  const students = await db.orm.public.Student.createAll(
    studentInputs.map(({ _role, ...s }) => s),
  );
  students.forEach((s, i) => (s._role = studentInputs[i]._role));
  console.log(`  students: ${students.length}`);

  // 3. Student skills (affinity skills score higher).
  // Star students: 2 per department who mastered their WHOLE role stack
  // (8-10) — they score 85+ on same-role opps and drive SELECTED outcomes
  // in every department bar of the placement chart.
  const starIds = new Set();
  for (const dept of DEPARTMENTS) {
    for (const s of faker.helpers.arrayElements(students.filter((x) => x.department === dept), 2)) {
      starIds.add(s.id);
    }
  }
  const studentSkillInputs = [];
  for (const s of students) {
    const affinity = ROLE_SKILLS[s._role];
    if (starIds.has(s.id)) {
      for (const name of affinity) {
        studentSkillInputs.push({
          studentId: s.id,
          skillId: skillId.get(name),
          proficiency: faker.number.int({ min: 8, max: 10 }),
        });
      }
      continue;
    }
    for (const name of pickMany([...affinity, ...[...skillId.keys()]], 4, 8)) {
      studentSkillInputs.push({
        studentId: s.id,
        skillId: skillId.get(name),
        proficiency: affinity.includes(name)
          ? faker.number.int({ min: 5, max: 9 })
          : faker.number.int({ min: 2, max: 6 }),
      });
    }
  }
  // de-dupe (pickMany can repeat across the merged pool)
  const seen = new Set();
  const deduped = studentSkillInputs.filter((r) =>
    seen.has(`${r.studentId}:${r.skillId}`) ? false : (seen.add(`${r.studentId}:${r.skillId}`), true),
  );
  await db.orm.public.StudentSkill.createAll(deduped);
  console.log(`  studentSkills: ${deduped.length}`);

  // 4. Industries + 20 opportunities
  const industries = await db.orm.public.Industry.createAll(INDUSTRIES);
  const oppInputs = Array.from({ length: 20 }, (_, i) => {
    const targetRole = ROLES[i % ROLES.length]; // even role coverage
    return {
      title: pick(OPP_TITLES[targetRole]),
      description: faker.company.catchPhrase(),
      type: i % 5 === 4 ? "FDP" : i % 3 === 2 ? "INTERNSHIP" : "JOB",
      industryId: industries[i % industries.length].id,
      minCgpa: faker.helpers.arrayElement([6.5, 7.0, 7.0, 7.5, 7.5, 8.0]),
      targetRole,
      isOpen: i === 19 ? false : true, // one closed opp for realism
      _role: targetRole,
    };
  });
  const opportunities = await db.orm.public.Opportunity.createAll(
    oppInputs.map(({ _role, ...o }) => o),
  );
  opportunities.forEach((o, i) => (o._role = oppInputs[i]._role));
  console.log(`  opportunities: ${opportunities.length}`);

  // 5. Opportunity requirements
  const oppSkillInputs = [];
  for (const o of opportunities) {
    for (const name of pickMany(ROLE_SKILLS[o._role], 3, 6)) {
      oppSkillInputs.push({
        opportunityId: o.id,
        skillId: skillId.get(name),
        weightage: faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
        minProficiency: faker.number.int({ min: 4, max: 8 }),
      });
    }
  }
  const seenO = new Set();
  const dedupedO = oppSkillInputs.filter((r) =>
    seenO.has(`${r.opportunityId}:${r.skillId}`) ? false : (seenO.add(`${r.opportunityId}:${r.skillId}`), true),
  );
  await db.orm.public.OpportunitySkill.createAll(dedupedO);
  console.log(`  opportunitySkills: ${dedupedO.length}`);

  // 6. Pre-calculate match scores with the REAL engine (in-memory, 50x20)
  const profByStudent = new Map(); // studentId -> Map(skillId -> proficiency)
  for (const r of deduped) {
    if (!profByStudent.has(r.studentId)) profByStudent.set(r.studentId, new Map());
    profByStudent.get(r.studentId).set(r.skillId, r.proficiency);
  }
  const reqsByOpp = new Map(); // oppId -> requirements[]
  const skillNameById = new Map(skillRows.map((s) => [s.id, s.name]));
  for (const r of dedupedO) {
    if (!reqsByOpp.has(r.opportunityId)) reqsByOpp.set(r.opportunityId, []);
    reqsByOpp.get(r.opportunityId).push({
      skillId: r.skillId,
      skillName: skillNameById.get(r.skillId),
      weightage: r.weightage,
      minProficiency: r.minProficiency,
    });
  }

  const gapInputs = [];
  const appInputs = [];
  for (const s of students) {
    const full = studentInputs.find((x) => x.email === s.email);
    const scored = opportunities
      .filter((o) => o.isOpen)
      .map((o) => ({
        opp: o,
        result: scorePair({
          studentCgpa: s.cgpa,
          studentProjects: full.projects,
          proficiencyBySkillId: profByStudent.get(s.id) ?? new Map(),
          requirements: reqsByOpp.get(o.id) ?? [],
          minCgpa: o.minCgpa,
          targetRole: o.targetRole,
        }),
      }))
      .sort((a, b) => b.result.score - a.result.score);

    // SkillGap rows for the student's top-3 opportunities (dashboard-ready).
    for (const { opp, result } of scored.slice(0, 3)) {
      for (const g of result.gaps) {
        gapInputs.push({
          studentId: s.id,
          opportunityId: opp.id,
          skillId: g.skillId,
          requiredLevel: g.requiredLevel,
          currentLevel: g.currentLevel,
          gapSize: g.gap,
        });
      }
    }

    // 2 applications per student; status correlates with score.
    for (const { opp, result } of scored.slice(0, 2)) {
      const r = faker.number.float({ min: 0, max: 1 });
      const status =
        result.score >= 80 ? (r < 0.55 ? "SELECTED" : "SHORTLISTED")
        : result.score >= 65 ? (r < 0.4 ? "SHORTLISTED" : "PENDING")
        : result.score >= 50 ? (r < 0.6 ? "PENDING" : "REJECTED")
        : (r < 0.7 ? "REJECTED" : "PENDING");
      appInputs.push({
        studentId: s.id,
        opportunityId: opp.id,
        matchScore: result.score,
        status,
        coverLetter: r < 0.5 ? faker.lorem.sentence() : null,
      });
    }
  }
  await db.orm.public.SkillGap.createAll(gapInputs);
  await db.orm.public.Application.createAll(appInputs);
  console.log(`  skillGaps: ${gapInputs.length}, applications: ${appInputs.length}`);

  // 7. SkillHistory progress snapshots for 12 students (rising curve)
  const historyInputs = [];
  for (const s of faker.helpers.arrayElements(students, 12)) {
    const profs = [...(profByStudent.get(s.id) ?? new Map()).entries()];
    const base = faker.number.int({ min: 3, max: 5 });
    for (let k = 2; k >= 0; k--) {
      const rating = Math.min(10, base + (2 - k) + faker.number.int({ min: 0, max: 1 }));
      historyInputs.push({
        studentId: s.id,
        recordedAt: new Date(Date.now() - k * 60 * 86400_000).toISOString(),
        overallRating: rating,
        skillsSnapshot: profs.slice(0, 5).map(([id, p]) => ({
          skill: skillNameById.get(id),
          proficiency: Math.max(1, Math.min(10, p - k)),
        })),
      });
    }
  }
  await db.orm.public.SkillHistory.createAll(historyInputs);
  console.log(`  skillHistory: ${historyInputs.length}`);

  // 8. Certifications: 0-3 per student on owned skills (strong skills first),
  // each worth +8 dimension points via the portfolio rule.
  const PROVIDERS = ["NPTEL", "Coursera", "Udemy", "AWS Academy", "Google Cloud Skills"];
  const CERT_TITLES = ["Complete Course", "Specialization", "Professional Certificate", "Bootcamp"];
  const ownedByStudent = new Map(); // studentId -> [{ skillId, proficiency }]
  for (const r of deduped) {
    if (!ownedByStudent.has(r.studentId)) ownedByStudent.set(r.studentId, []);
    ownedByStudent.get(r.studentId).push(r);
  }
  const certInputs = [];
  for (const s of students) {
    const owned = (ownedByStudent.get(s.id) ?? []).sort((a, b) => b.proficiency - a.proficiency);
    const n = s._role && starIds.has(s.id) ? 3 : faker.number.int({ min: 0, max: 3 });
    for (const r of owned.slice(0, n)) {
      certInputs.push({
        studentId: s.id,
        skillId: r.skillId,
        title: `${skillNameById.get(r.skillId)} ${pick(CERT_TITLES)}`,
        provider: pick(PROVIDERS),
        completedAt: new Date(Date.now() - faker.number.int({ min: 10, max: 300 }) * 86400_000).toISOString(),
      });
    }
  }
  await db.orm.public.Certification.createAll(certInputs);
  console.log(`  certifications: ${certInputs.length}`);

  console.log("Seed complete — dashboard data is ready.");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => db.close?.());
