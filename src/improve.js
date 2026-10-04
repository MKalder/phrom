/**
 * Phrom Improvement Generator (Phase 2)
 * Generates concrete "Write X instead of Y" suggestions for failed checks.
 * 
 * Uses template-based suggestions (reliable) + LLM for complete draft only.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { generateRevisedIssueDraft } from "./model-improve.js";

// ---------- References ----------

let referenceCache = null;

function loadReferences() {
  if (referenceCache) return referenceCache;
  referenceCache = {};

  const refsDir = path.join(process.cwd(), "references", "quality");
  if (!existsSync(refsDir)) {
    // Fallback to old location
    const oldRefsDir = path.join(process.cwd(), "references");
    if (existsSync(oldRefsDir)) {
      for (const file of readdirSync(oldRefsDir)) {
        if (!file.endsWith(".json")) continue;
        const typeMatch = file.toLowerCase().match(/(story|task|bug|epic)/);
        if (!typeMatch) continue;
        try {
          const data = JSON.parse(readFileSync(path.join(oldRefsDir, file), "utf-8"));
          referenceCache[typeMatch[1]] = data;
        } catch {
          // Ignore broken reference files
        }
      }
      return referenceCache;
    }
  }

  for (const file of readdirSync(refsDir)) {
    if (!file.endsWith(".json")) continue;
    const typeMatch = file.toLowerCase().match(/(story|task|bug|epic)/);
    if (!typeMatch) continue;
    try {
      const data = JSON.parse(readFileSync(path.join(refsDir, file), "utf-8"));
      referenceCache[typeMatch[1]] = data;
    } catch {
      // Ignore broken reference files
    }
  }

  return referenceCache;
}

// ---------- Extract current content from body ----------

function findSection(body, names) {
  if (!body) return null;
  for (const name of names) {
    const heading = new RegExp(
      `(?:^|\\n)#{1,4}\\s*${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,4}\\s|$)`,
      "i"
    );
    const hMatch = body.match(heading);
    if (hMatch && hMatch[1].trim()) return hMatch[1].trim();

    const inline = new RegExp(`(?:^|\\n)\\**${name}\\**\\s*:\\s*([^\\n]+)`, "i");
    const iMatch = body.match(inline);
    if (iMatch && iMatch[1].trim()) return iMatch[1].trim();
  }
  return null;
}

const SECTION_NAMES = {
  // Story
  "story-format": ["User Story", "Story"],
  "story-context": ["Context", "Background"],
  "epic-link": ["Epic", "Parent"],
  "ac-presence": ["Acceptance Criteria", "AC"],
  "story-links": ["Dependencies", "Links", "Related"],
  "ac-testability": ["Acceptance Criteria", "AC"],
  "business-value": ["so that", "Benefit", "Value"],

  // Task
  "technical-scope": ["Technical Scope", "Scope"],
  "justification": ["Justification", "Motivation", "Why"],
  "impact-analysis": ["Impact Analysis", "Impact"],
  "rollback-plan": ["Rollback Plan", "Rollback"],
  "technical-feasibility": ["Assumptions", "Risks", "Feasibility"],
  "rollback-risk": ["Rollback Risks", "Risks"],

  // Bug
  "reproduction-steps": ["Steps to Reproduce", "Reproduction Steps", "Steps"],
  "expected-vs-actual": ["Expected Behavior", "Expected", "Actual Behavior"],
  "environment-info": ["Environment"],
  "severity": ["Severity", "Priority"],
  "reproducibility": ["Reproducibility", "Frequency"],

  // Epic
  "epic-context": ["Context", "Background"],
  "epic-goal": ["Goal"],
  "epic-benefit": ["Benefits", "Benefit"],
  "epic-boundary": ["Scope", "In Scope", "Out of Scope"],
  "epic-success-measure": ["Success Measures", "Metrics", "Success"],
  "epic-slicing": ["Child Stories", "Stories", "Slices"],
  "epic-oversize-risk": ["Risks", "Risk"],
  "epic-owner": ["Owner"],
  "epic-stakeholders": ["Stakeholders"],
  "epic-company-goal": ["Company Goal", "Company Objective"],
  "epic-milestones": ["Milestones"],
  "epic-timeline": ["Timeline", "Target Date"],
  "epic-risks": ["Risks", "Risk"],
  "epic-dependencies": ["Dependencies"],
  "epic-child-story-status": ["Child Stories", "Stories"],
};

function extractCurrent(body, checkName) {
  const names = SECTION_NAMES[checkName];
  if (!names) return null;
  const found = findSection(body, names);
  if (!found) return null;
  return found.length > 200 ? `${found.slice(0, 200)}...` : found;
}

// ---------- Check Name to Template Key Mapping ----------

/**
 * Maps check names (from agent.js/model.js) to template keys.
 * This is necessary because check names use CamelCase (e.g., goalStatement)
 * but templates use kebab-case (e.g., epic-goal).
 */
const CHECK_TO_TEMPLATE_MAP = {
  story: {
    storyFormat: "story-format",
    context: "story-context",
    epicLink: "epic-link",
    acPresence: "ac-presence",
    storyLinks: "story-links",
    acTestability: "ac-testability",
    value: "business-value",
  },

  task: {
    technicalScope: "technical-scope",
    justification: "justification",
    impactAnalysis: "impact-analysis",
    rollbackPlan: "rollback-plan",
    acPresence: "ac-presence",
    acTestability: "ac-testability",
    technicalFeasibility: "technical-feasibility",
    rollbackRisk: "rollback-risk",
  },

  bug: {
    reproductionSteps: "reproduction-steps",
    expectedVsActual: "expected-vs-actual",
    environmentInfo: "environment-info",
    acPresence: "ac-presence",
    acTestability: "ac-testability",
    severity: "severity",
    reproducibility: "reproducibility",
  },

  epic: {
    goalStatement: "epic-goal",
    benefitStatement: "epic-benefit",
    storyList: "epic-slicing",
    acTestability: "epic-success-measure",
    epicGoal: "epic-goal",
    epicBenefit: "epic-benefit",
  },
};

function mapCheckToTemplate(type, checkName) {
  const typeMap = CHECK_TO_TEMPLATE_MAP[type];
  if (!typeMap) return checkName;
  return typeMap[checkName] || checkName;
}

// ---------- Templates ----------

const NOT_FOUND = "(not present)";

function buildTemplates(refs) {
  const storyRef = refs.story?.story;
  const taskRef = refs.task?.task;
  const bugRef = refs.bug?.bug;
  const epicRef = refs.epic?.epic;

  return {
    story: {
      "story-format": {
        suggestion: 'Use the standard story format: "As a [role], I want [feature], so that [benefit]".',
        after: "As a [role], I want [feature], so that [benefit].",
      },
      "story-context": {
        suggestion: "Add context: operator, product, platforms, target group, and parent epic.",
        after: `**Context:**
- Operator: [your company/product]
- Product: [product name]
- Target Group: [user group]
- Part of Epic: #[number] [epic title]`,
      },
      "epic-link": {
        suggestion: "Link to the parent epic using its issue number.",
        after: "Epic: #[number] – [Epic Title]",
      },
      "ac-presence": {
        suggestion: "Add at least two acceptance criteria: one happy path and one error case. Use Gherkin syntax (Given/When/Then).",
        after: `**Acceptance Criteria**

**Happy Path:**
- [ ] Given [initial context], when [action], then [expected result]

**Error Cases:**
- [ ] Given [error context], when [action], then [error message / behavior]`,
      },
      "story-links": {
        suggestion: "Document dependencies to other issues (depends on, blocks, related to).",
        after: `**Dependencies:**
- Depends on #[number] ([title])
- Blocks #[number] ([title])
- Related to #[number] ([title])`,
      },
      "ac-testability": {
        suggestion: "Write acceptance criteria that can be verified with pass/fail (concrete values, no vague terms like 'fast' or 'easy').",
        after: "Then the download starts within [x] seconds / Then the PDF contains [specific fields].",
      },
      "business-value": {
        suggestion: "Describe the benefit concretely: who benefits and how do you measure success?",
        after: "so that [user group] [concrete benefit], measurable by [metric].",
      },
    },

    task: {
      "technical-scope": {
        suggestion: "Describe the technical work as a clear list of steps.",
        after: `**Technical Scope:**
- [Step 1]
- [Step 2]
- [Step 3: Verification]`,
      },
      "justification": {
        suggestion: "Explain why this task is needed (e.g., end of life, security, performance).",
        after: `**Justification:**
- [Trigger, e.g., EOL date / security vulnerability / metric]
- [Risk of not doing this]`,
      },
      "impact-analysis": {
        suggestion: "List affected systems, expected downtime, and involved teams.",
        after: `**Impact Analysis:**
- Affected systems: [list]
- Expected downtime: [duration / none]
- Involved teams: [list]`,
      },
      "rollback-plan": {
        suggestion: "Provide a concrete, tested rollback plan.",
        after: `**Rollback Plan:**
1. [Stop services]
2. [Restore state from backup X]
3. [Start services and verify]
Tested in: [environment, date]`,
      },
      "ac-presence": {
        suggestion: "Add testable acceptance criteria for task completion.",
        after: `**Acceptance Criteria:**
- [ ] [Testable outcome 1]
- [ ] [Testable outcome 2]`,
      },
      "ac-testability": {
        suggestion: "Make acceptance criteria measurable (concrete values, checks, smoke tests).",
        after: "- [ ] Smoke test [name] passes successfully\n- [ ] Error rate below [x]% after [time period]",
      },
      "technical-feasibility": {
        suggestion: "Clarify technical assumptions, dependencies, and open risks.",
        after: `**Assumptions & Risks:**
- Assumption: [..]
- Risk: [..] → Mitigation: [..]`,
      },
      "rollback-risk": {
        suggestion: "Describe what could be lost or fail during rollback, and how you mitigate that.",
        after: `**Rollback Risks:**
- [Data loss / inconsistency possible?] → [Mitigation]`,
      },
    },

    bug: {
      "reproduction-steps": {
        suggestion: "Provide numbered reproduction steps (at least two).",
        after: `**Steps to Reproduce:**
1. [Initial state / open page]
2. [Action]
3. [Observation]`,
      },
      "expected-vs-actual": {
        suggestion: "Clearly separate expected behavior from actual behavior.",
        after: `**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens, including error message]`,
      },
      "environment-info": {
        suggestion: "Include environment: device, OS, browser, app version.",
        after: `**Environment:**
- Device: [..]
- OS: [..]
- Browser: [..]
- App version: [..]`,
      },
      "ac-presence": {
        suggestion: "Define acceptance criteria to verify the bug fix.",
        after: `**Acceptance Criteria:**
- [ ] The error no longer occurs with the steps above
- [ ] Regression test [name] is added`,
      },
      "ac-testability": {
        suggestion: "Write testable criteria to verify the fix.",
        after: "- [ ] Steps 1–3 result in [expected behavior] on [environment]",
      },
      "severity": {
        suggestion: "Specify severity (Critical / Major / Minor) and justify the impact.",
        after: "**Severity:** [Critical|Major|Minor] – [Impact on users / revenue]",
      },
      "reproducibility": {
        suggestion: "Specify how often the bug occurs (always, sometimes, rarely) and under what conditions.",
        after: "**Reproducibility:** [Always|Sometimes|Rarely] – [Conditions]",
      },
    },

    epic: {
      "epic-context": {
        suggestion: "Names at least product and target group; operator and platforms are recommended.",
        after: `**Context:**
- Operator: [your company]
- Product: [product name]
- Target Group: [customer segments]
- Platforms: [web, mobile, etc.]`,
      },
      "epic-goal": {
        suggestion: "States an outcome-oriented goal (not just a technology or activity label).",
        after: `**Goal:**
[Target group] can [capability] by [date], so that [metric] improves by [x]%.`,
      },
      "epic-benefit": {
        suggestion: "States an intended benefit for customers, team, and business.",
        after: `**Benefits:**
- Customers: [time saved / benefit]
- Support Team: [workload reduction]
- Business: [metric with target value]`,
      },
      "epic-boundary": {
        suggestion: "Has an explicit in-scope and out-of-scope boundary.",
        after: `**Scope:**

### In Scope
- [Item 1]
- [Item 2]

### Out of Scope
- [Item 1]
- [Item 2]`,
      },
      "epic-success-measure": {
        suggestion: "Provides a measurable outcome or explicitly flags that a baseline/target still needs product validation.",
        after: `**Success Measures:**
- [Metric]: from [baseline] to [target] by [date]`,
      },
      "epic-slicing": {
        suggestion: "Can be broken into independently discussable candidate stories or thin vertical slices.",
        after: `**Child Stories / Candidate Slices:**
- #[number]: [Title]
- #[number]: [Title]`,
      },
      "epic-oversize-risk": {
        suggestion: "Flags programme-level scope disguised as an epic.",
        after: `**Note:** This epic may be too large. Consider splitting by [customer outcome / product domain / platform].`,
      },
      "epic-owner": {
        suggestion: "Names one accountable owner for the epic.",
        after: `**Owner:** [Product Manager Name] (Product Manager)`,
      },
      "epic-stakeholders": {
        suggestion: "Names the relevant stakeholder groups or people.",
        after: `**Stakeholders:**
- [Engineering Lead] (Engineering)
- [UX Design Lead] (UX Design)
- [Support Team Lead] (Support)`,
      },
      "epic-company-goal": {
        suggestion: "Links the epic to an overarching company or product goal.",
        after: `**Company Goal:**
[Company/product objective that this epic supports]`,
      },
      "epic-milestones": {
        suggestion: "Defines meaningful milestones for the epic.",
        after: `**Milestones:**
- **MVP: [Name]** – Date: [date], Stories: #[..], Outcome: [..]
- **Phase 1: [Name]** – Date: [date], Stories: #[..], Outcome: [..]`,
      },
      "epic-timeline": {
        suggestion: "Provides an indicative timeline.",
        after: `**Timeline:**
- Start: [date]
- MVP: [date]
- Full Launch: [date]`,
      },
      "epic-risks": {
        suggestion: "Identifies relevant risks and mitigations.",
        after: `**Risks and Mitigations:**
- **Risk:** [description] → **Mitigation:** [action]`,
      },
      "epic-dependencies": {
        suggestion: "Documents cross-team or external dependencies.",
        after: `**Dependencies:**
- [System/Team]: [description]`,
      },
      "epic-child-story-status": {
        suggestion: "Existing child stories have traceable GitHub links and current statuses.",
        after: `**Child Stories:**
- #[number]: [Title] – Status: [draft/refinement/ready]`,
      },
    },
  };
}

// ---------- Public API ----------

/**
 * Generate a suggestion for a single check (template-based).
 */
export function generateSuggestion(type, checkName, checkResult, issueBody) {
  const templates = buildTemplates(loadReferences());

  // Map check name to template key
  const templateKey = mapCheckToTemplate(type, checkName);

  // Try template key first, then fall back to original checkName
  const tpl = templates[type]?.[templateKey] || templates[type]?.[checkName];

  const current = extractCurrent(issueBody, templateKey) || extractCurrent(issueBody, checkName);
  const reason = checkResult?.reason || checkResult?.message || "";

  if (!tpl) {
    return {
      suggestion: reason ? `Fix: ${reason}` : `Revise the "${checkName}" section.`,
      before: current || NOT_FOUND,
      after: `Add a section for "${checkName}" using the issue-type reference structure.`,
    };
  }

  return {
    suggestion: reason || tpl.suggestion,
    before: current || NOT_FOUND,
    after: tpl.after,
  };
}

function toEntries(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((c) => [c.name || c.id || c.check, c]);
  }
  if (Array.isArray(value.checks)) {
    return value.checks.map((c) => [c.name || c.id || c.check, c]);
  }
  if (typeof value === "object") return Object.entries(value);
  return [];
}

function isFailed(check) {
  if (!check || typeof check !== "object") return false;
  if (check.error) return false;
  if ("passed" in check) return check.passed === false || check.passed === 0;
  if ("pass" in check) return !check.pass;
  return false;
}

/**
 * Generate all suggestions for an issue result.
 * Uses templates for individual suggestions (reliable).
 * Uses LLM only for the complete revised draft.
 * 
 * @param {Object} result - Processed issue result
 * @returns {Promise<Object>} Object with suggestions array and revisedDraft string
 */
export async function generateAllSuggestions(result) {
  if (!result) return { suggestions: [], revisedDraft: '' };

  const type = result.type || 'unknown';
  const body = result.body || result.issue?.body || '';
  const suggestions = [];

  // Collect failed checks
  const failedDeterministic = [];
  const failedAI = [];

  const detRaw = result.deterministicChecks ?? result.checks;
  for (const [name, check] of toEntries(detRaw)) {
    if (name && isFailed(check)) {
      failedDeterministic.push({ name, check, type: 'deterministic' });
    }
  }

  for (const [name, check] of toEntries(result.modelChecks)) {
    if (name && name !== 'error' && isFailed(check)) {
      failedAI.push({ name, check, type: 'ai' });
    }
  }

  // Generate template-based suggestions for ALL failed criteria
  for (const { name, check } of failedDeterministic) {
    suggestions.push({
      check: name,
      type: 'deterministic',
      ...generateSuggestion(type, name, check, body),
    });
  }

  for (const { name, check } of failedAI) {
    suggestions.push({
      check: name,
      type: 'ai',
      ...generateSuggestion(type, name, check, body),
    });
  }

  // Generate LLM-based complete draft (only if we have suggestions and a reference)
  let revisedDraft = '';
  const refs = loadReferences();
  const reference = refs[type];

  if (reference && suggestions.length > 0) {
    try {
      revisedDraft = await generateRevisedIssueDraft(result, suggestions, reference);
    } catch (error) {
      console.warn(`LLM draft generation failed: ${error.message}`);
      revisedDraft = '';
    }
  }

  return { suggestions, revisedDraft };
}

/**
 * Generate a standalone improvement suggestion report.
 * @param {Object} result - Processed issue result
 * @param {Array} suggestions - Array of improvement suggestions
 * @param {string} revisedDraft - Revised issue draft (optional)
 * @returns {string} Markdown report
 */
export function generateImprovementReport(result, suggestions, revisedDraft = '') {
  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  let report = `# 💡 Improvement Suggestions for Issue #${result.issueNumber}\n\n`;
  report += `**Title:** ${result.title}\n`;
  report += `**Type:** ${capitalize(result.type)}\n`;
  report += `**Current Score:** ${result.score}/100\n`;
  report += `**Current Status:** ${capitalize(result.status)}\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `---\n\n`;

  if (suggestions.length === 0) {
    report += `✅ **No improvements needed!** This issue is ready for refinement.\n\n`;
  } else {
    report += `## 📋 Overview\n\n`;
    report += `Found **${suggestions.length} areas for improvement**:\n\n`;

    const byType = {
      deterministic: suggestions.filter(s => s.type === 'deterministic'),
      ai: suggestions.filter(s => s.type === 'ai'),
    };

    if (byType.deterministic.length > 0) {
      report += `### ✅ Deterministic Checks (${byType.deterministic.length})\n\n`;
      byType.deterministic.forEach((s, i) => {
        report += `${i + 1}. **${capitalize(s.check)}**\n`;
      });
      report += `\n`;
    }

    if (byType.ai.length > 0) {
      report += `### 🤖 AI-Powered Checks (${byType.ai.length})\n\n`;
      byType.ai.forEach((s, i) => {
        report += `${i + 1}. **${capitalize(s.check)}**\n`;
      });
      report += `\n`;
    }

    report += `---\n\n`;
    report += `## 🔧 Detailed Suggestions\n\n`;

    suggestions.forEach((s, i) => {
      report += `### ${i + 1}. ${capitalize(s.check)} (${s.type})\n\n`;
      report += `**Problem:** ${s.suggestion}\n\n`;

      if (s.before && s.before !== '(not present)') {
        report += `**Current:**\n\`\`\`\n${s.before}\n\`\`\`\n\n`;
      } else {
        report += `**Current:** _(not present)_\n\n`;
      }

      report += `**Recommended:**\n\`\`\`\n${s.after}\n\`\`\`\n\n`;
      report += `---\n\n`;
    });
  }

  if (revisedDraft) {
    report += `## 📝 Revised Issue Draft\n\n`;
    report += `Below is a complete revised draft incorporating all suggestions:\n\n`;
    report += `---\n\n`;
    report += revisedDraft;
    report += `\n\n---\n\n`;
  }

  report += `## 🎯 Next Steps\n\n`;
  report += `1. Review each suggestion above.\n`;
  report += `2. Use the revised draft as a starting point (if available).\n`;
  report += `3. Update the issue description with the recommended changes.\n`;
  report += `4. Re-run \`phrom improve ${result.issueNumber}\` to verify improvements.\n\n`;
  report += `---\n\n`;
  report += `*Generated by Phrom Agent (Phase 2) – Improvement Suggestions*\n`;

  return report;
}