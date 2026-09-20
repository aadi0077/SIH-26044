import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),

  matching: {
    // Proficiency scale used everywhere (StudentSkill.proficiency, minProficiency).
    maxProficiency: 10,
    // Bonus points added on top of the weighted base score (capped at 100 total).
    cgpaBonusMet: 3, // student CGPA >= opportunity.minCgpa
    cgpaBonusExceededBy: 1.0, // extra margin that upgrades the bonus...
    cgpaBonusExceeded: 5, // ...to this value
    projectBonusPerProject: 2, // per relevant project mentioning a matched skill/role
    projectBonusCap: 5,
    defaultTopN: 5,
  },

  analytics: {
    defaultSkillDemandLimit: 5,
  },
};
