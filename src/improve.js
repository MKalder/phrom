/**
 * Phrom Improvement Generator (Phase 2)
 * Generates concrete "Write X instead of Y" suggestions for failed checks.
 *
 * Accepts both raw results from agent.js
 * ({ deterministicChecks: {...}, modelChecks: {...} })
 * and normalized results from report.js
 * ({ checks: [...], modelChecks: [...] }).
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { generateLLMImprovements, generateRevisedIssueDraft } from "./model-improve.js";

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
  storyFormat: ["User Story", "Story"],
  context: ["Context", "Background"],
  epicLink: ["Epic", "Parent"],
  acPresence: ["Acceptance Criteria", "AC"],
  storyLinks: ["Dependencies", "Links", "Related"],
  technicalScope: ["Technical Scope", "Scope"],
  justification: ["Justification", "Motivation", "Why"],
  impactAnalysis: ["Impact Analysis", "Impact"],
  rollbackPlan: ["Rollback Plan", "Rollback"],
  reproductionSteps: ["Steps to Reproduce", "Reproduction Steps", "Steps"],
  expectedVsActual: ["Expected Behavior", "Expected", "Actual Behavior"],
  environmentInfo: ["Environment"],
  goalStatement: ["Goal"],
  benefitStatement: ["Benefits", "Benefit"],
  storyList: ["Child Stories", "Stories", "Scope"],
};

function extractCurrent(body, checkName) {
  const names = SECTION_NAMES[checkName];
  if (!names) return null;
  const found = findSection(body, names);
  if (!found) return null;
  return found.length > 200 ? `${found.slice(0, 200)}...` : found;
}

// ---------- Templates (Fallback if LLM fails) ----------

const NOT_FOUND = "(not present)";

function buildTemplates(refs) {
  const storyRef = refs.story?.story;
  const taskRef = refs.task?.task;
  const bugRef = refs.bug?.bug;
  const epicRef = refs.epic?.epic;

  return {
    story: {
      storyFormat: {
        suggestion: 'Use the standard story format: "As a [role], I want [feature], so that [benefit]".',
        after: "As a [role], I want [feature], so that [benefit].",
      },
      context: {
        suggestion: "Add context: operator, product, platforms, target group, and parent epic.",
        after: `**Context:**
- Operator: [your company/product]
- Product: [product name]
- Target Group: [user group]
- Part of Epic: #[number] [epic title]`,
      },
      epicLink: {
        suggestion: "Link to the parent epic using its issue number.",
        after: "Epic: #[number] – [Epic Title]",
      },
      acPresence: {
        suggestion: "Add at least two acceptance criteria: one happy path and one error case. Use Gherkin syntax (Given/When/Then).",
        after: `**Acceptance Criteria**

**Happy Path:**
- [ ] Given [initial context], when [action], then [expected result]

**Error Cases:**
- [ ] Given [error context], when [action], then [error message / behavior]`,
      },
      storyLinks: {
        suggestion: "Document dependencies to other issues (depends on, blocks, related to).",
        after: `**Dependencies:**
- Depends on #[number] ([title])
- Blocks #[number] ([title])
- Related to #[number] ([title])`,
      },
      acTestability: {
        suggestion: "Write acceptance criteria that can be verified with pass/fail (concrete values, no vague terms like 'fast' or 'easy').",
        after: "Then the download starts within [x] seconds / Then the PDF contains [specific fields].",
      },
      businessValue: {
        suggestion: "Describe the benefit concretely: who benefits and how do you measure success?",
        after: "so that [user group] [concrete benefit], measurable by [metric].",
      },
    },

    task: {
      technicalScope: {
        suggestion: "Describe the technical work as a clear list of steps.",
        after: `**Technical Scope:**
- [Step 1]
- [Step 2]
- [Step 3: Verification]`,
      },
      justification: {
        suggestion: "Explain why this task is needed (e.g., end of life, security, performance).",
        after: `**Justification:**
- [Trigger, e.g., EOL date / security vulnerability / metric]
- [Risk of not doing this]`,
      },
      impactAnalysis: {
        suggestion: "List affected systems, expected downtime, and involved teams.",
        after: `**Impact Analysis:**
- Affected systems: [list]
- Expected downtime: [duration / none]
- Involved teams: [list]`,
      },
      rollbackPlan: {
        suggestion: "Provide a concrete, tested rollback plan.",
        after: `**Rollback Plan:**
1. [Stop services]
2. [Restore state from backup X]
3. [Start services and verify]
Tested in: [environment, date]`,
      },
      acPresence: {
        suggestion: "Add testable acceptance criteria for task completion.",
        after: `**Acceptance Criteria:**
- [ ] [Testable outcome 1]
- [ ] [Testable outcome 2]`,
      },
      acTestability: {
        suggestion: "Make acceptance criteria measurable (concrete values, checks, smoke tests).",
        after: "- [ ] Smoke test [name] passes successfully\n- [ ] Error rate below [x]% after [time period]",
      },
      technicalFeasibility: {
        suggestion: "Clarify technical assumptions, dependencies, and open risks.",
        after: `**Assumptions & Risks:**
- Assumption: [..]
- Risk: [..] → Mitigation: [..]`,
      },
      rollbackRisk: {
        suggestion: "Describe what could be lost or fail during rollback, and how you mitigate that.",
        after: `**Rollback Risks:**
- [Data loss / inconsistency possible?] → [Mitigation]`,
      },
    },

    bug: {
      reproductionSteps: {
        suggestion: "Provide numbered reproduction steps (at least two).",
        after: `**Steps to Reproduce:**
1. [Initial state / open page]
2. [Action]
3. [Observation]`,
      },
      expectedVsActual: {
        suggestion: "Clearly separate expected behavior from actual behavior.",
        after: `**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens, including error message]`,
      },
      environmentInfo: {
        suggestion: "Include environment: device, OS, browser, app version.",
        after: `**Environment:**
- Device: [..]
- OS: [..]
- Browser: [..]
- App version: [..]`,
      },
      acPresence: {
        suggestion: "Define acceptance criteria to verify the bug fix.",
        after: `**Acceptance Criteria:**
- [ ] The error no longer occurs with the steps above
- [ ] Regression test [name] is added`,
      },
      acTestability: {
        suggestion: "Write testable criteria to verify the fix.",
        after: "- [ ] Steps 1–3 result in [expected behavior] on [environment]",
      },
      severity: {
        suggestion: "Specify severity (Critical / Major / Minor) and justify the impact.",
        after: "**Severity:** [Critical|Major|Minor] – [Impact on users / revenue]",
      },
      reproducibility: {
        suggestion: "Specify how often the bug occurs (always, sometimes, rarely) and under what conditions.",
        after: "**Reproducibility:** [Always|Sometimes|Rarely] – [Conditions]",
      },
    },

    epic: {
      goalStatement: {
        suggestion: "Write a SMART goal: specific, measurable, achievable, relevant, time-bound.",
        after: epicRef?.goal
          ? `Goal: ${epicRef.goal}`
          : "Goal: [target group] can [capability] by [date], so that [metric] decreases/increases by [x]%.",
      },
      benefitStatement: {
        suggestion: "Quantify benefits for customers, team, and business.",
        after: epicRef?.benefit
          ? `**Benefits:**
- Customers: ${epicRef.benefit.customers || '[benefit]'}
- Support Team: ${epicRef.benefit.supportTeam || '[benefit]'}
- Business: ${epicRef.benefit.business || '[benefit]'}`
          : `**Benefits:**
- Customers: [time saved / benefit with number]
- Team: [workload reduction with number]
- Business: [metric with target value]`,
      },
      storyList: {
        suggestion: "List the related stories with issue numbers (at least two).",
        after: epicRef?.childStories
          ? `**Child Stories:**
${epicRef.childStories.map(s => `- ${s.issue || '#X'}: ${s.title}`).join('\n')}`
          : `**Child Stories:**
- #[number]: [Title]
- #[number]: [Title]`,
      },
      acTestability: {
        suggestion: "Define measurable success criteria with baseline, target, and deadline.",
        after: `**Success Metrics:**
- [Metric]: from [baseline] to [target] by [date]`,
      },
      epicGoal: {
        suggestion: "Sharpen the epic goal: what outcome should be achieved and how is it measured?",
        after: "Goal: [concrete, measurable outcome] by [date].",
      },
      epicBenefit: {
        suggestion: "Describe the benefit with concrete numbers and target groups.",
        after: "Benefit: [target group] saves [x] per [time period]; [metric] improves by [y].",
      },
    },
  };
}

// ---------- Public API ----------

/**
 * Generate a suggestion for a single check (template-based fallback).
 */
export function generateSuggestion(type, checkName, checkResult, issueBody) {
  const templates = buildTemplates(loadReferences());
  const tpl = templates[type]?.[checkName];

  const current = extractCurrent(issueBody, checkName);
  const reason = checkResult?.reason || checkResult?.message || "";

  if (!tpl) {
    return {
      suggestion: reason ? `Fix: ${reason}` : `Revise the "${checkName}" section.`,
      before: current || NOT_FOUND,
      after: `Refer to the reference file for ${type}.`,
    };
  }

  return {
    suggestion: tpl.suggestion,
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
 * @param {Object} result - Processed issue result
 * @param {boolean} useLLM - Whether to use LLM for suggestions (default: false)
 * @returns {Promise<Object>} Object with suggestions array and revisedDraft string
 */
export async function generateAllSuggestions(result, useLLM = false) {
  if (!result) return { suggestions: [], revisedDraft: '' };

  const type = result.type || "unknown";
  const body = result.body || result.issue?.body || "";
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

  const failedCheckNames = [...failedDeterministic, ...failedAI].map(f => f.name);

  // Option 1: LLM-based suggestions (only if explicitly enabled)
  if (useLLM) {
    const refs = loadReferences();
    const reference = refs[type];

    if (reference) {
      const llmSuggestions = await generateLLMImprovements(type, result, failedCheckNames, reference);

      // Enrich with type info
      const enrichedSuggestions = llmSuggestions.map(s => ({
        ...s,
        type: failedDeterministic.find(f => f.name === s.check) ? 'deterministic' : 'ai',
      }));

      // Generate revised draft
      const revisedDraft = await generateRevisedIssueDraft(result, enrichedSuggestions, reference);

      return { suggestions: enrichedSuggestions, revisedDraft };
    }
  }

  // Option 2: Template-based suggestions (fallback)
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

  return { suggestions, revisedDraft: '' };
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
  }

  return report;
}