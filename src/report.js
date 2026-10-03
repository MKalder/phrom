/**
 * report.js – Generates Markdown reports for GitHub comments.
 *
 * Creates human-readable reports with score, passed/failed checks,
 * and concrete improvement suggestions. Clearly separates deterministic vs AI checks.
 */

/**
 * generateMarkdownReport(issueResult) – Creates full report.
 */
export function generateMarkdownReport(issueResult) {
  const {
    issueNumber,
    title,
    type,
    score,
    status,
    emoji,
    summary,
    deterministicChecks,
    modelChecks,
  } = issueResult;

  // Header
  let report = `## 🤖 Phrom Review – Issue #${issueNumber}: "${title}"\n\n`;
  report += `**Status:** ${emoji} **${status}** (${score}/100 points)\n`;
  report += `**Type:** ${type}\n`;
  report += `**Summary:** ${summary}\n\n`;

  report += `---\n\n`;

  // SECTION 1: DETERMINISTIC CHECKS (automated, rule-based)
  report += `### 📏 Automated Checks (Deterministic)\n\n`;
  report += `*These checks use regex and pattern matching to verify formal requirements. Fast, reliable, and 100% reproducible.*\n\n`;

  const detChecks = [
    { name: "Story Format", result: deterministicChecks.storyFormat },
    { name: "Context", result: deterministicChecks.context },
    { name: "Epic Link", result: deterministicChecks.epicLink },
    { name: "AC Presence", result: deterministicChecks.acPresence },
    { name: "Story Links", result: deterministicChecks.storyLinks },
  ].filter(c => c.result !== undefined);

  const detPassed = detChecks.filter(c => c.result.passed);
  const detFailed = detChecks.filter(c => !c.result.passed);

  if (detPassed.length > 0) {
    report += `#### ✅ Passed (${detPassed.length})\n\n`;
    for (const check of detPassed) {
      report += `- **${check.name}**: ${check.result.evidence}\n`;
    }
    report += `\n`;
  }

  if (detFailed.length > 0) {
    report += `#### ❌ Needs Improvement (${detFailed.length})\n\n`;
    for (const check of detFailed) {
      report += `- **${check.name}**: ${check.result.reason}\n`;
    }
    report += `\n`;
  }

  report += `---\n\n`;

  // SECTION 2: AI CHECKS (LLM-based, content evaluation)
  report += `### 🧠 AI-Powered Evaluation (Qwen3 30B MoE)\n\n`;
  report += `*These checks use a local AI model (Ollama) to evaluate content quality, testability, and business value. Results may vary slightly between runs.*\n\n`;

  const aiChecks = [];
  if (modelChecks.acTestability) {
    aiChecks.push({ name: "AC Testability", result: modelChecks.acTestability });
  }
  if (modelChecks.sizeRisk) {
    aiChecks.push({ name: "Size & Risk", result: modelChecks.sizeRisk });
  }
  if (type === "story" && modelChecks.value) {
    aiChecks.push({ name: "Business Value", result: modelChecks.value });
  }
  if (type === "epic") {
    if (modelChecks.epicGoal) aiChecks.push({ name: "Epic Goal", result: modelChecks.epicGoal });
    if (modelChecks.epicBenefit) aiChecks.push({ name: "Epic Benefit", result: modelChecks.epicBenefit });
  }

  const aiPassed = aiChecks.filter(c => c.result.passed || (c.result.size && !c.result.error));
  const aiFailed = aiChecks.filter(c => !c.result.passed && !c.result.error);

  if (aiPassed.length > 0) {
    report += `#### ✅ Passed (${aiPassed.length})\n\n`;
    for (const check of aiPassed) {
      if (check.result.size) {
        report += `- **${check.name}**: Estimated **${check.result.size}** – ${check.result.reason}\n`;
      } else {
        report += `- **${check.name}**: ${check.result.reason}\n`;
      }
    }
    report += `\n`;
  }

  if (aiFailed.length > 0) {
    report += `#### ❌ Needs Improvement (${aiFailed.length})\n\n`;
    for (const check of aiFailed) {
      report += `- **${check.name}**: ${check.result.reason}\n`;
    }
    report += `\n`;
  }

  if (modelChecks.error) {
    report += `#### ⚠️ AI Evaluation Error\n\n`;
    report += `- **Error**: ${modelChecks.error.reason}\n\n`;
  }

  report += `---\n\n`;

  // Mandatory: Happy Path + Error Case
  report += `### ⚠️ Mandatory Requirements\n\n`;
  report += `**Happy Path + Error Case are mandatory.** Every issue must include:\n`;
  report += `- At least **one happy path** acceptance criterion (standard flow, success case)\n`;
  report += `- At least **one error case** acceptance criterion (error handling, edge case, validation)\n\n`;

  const hasHappyPath = deterministicChecks.acPresence.evidence?.includes("happy path") || false;
  const hasErrorCase = deterministicChecks.acPresence.evidence?.includes("error case") || false;

  if (!hasHappyPath || !hasErrorCase) {
    report += `**Current status:**\n`;
    if (!hasHappyPath) report += `- ❌ Happy path missing\n`;
    if (!hasErrorCase) report += `- ❌ Error case missing\n`;
    report += `\n**💡 Suggestion:** Add both to meet the minimum requirement.\n\n`;
  } else {
    report += `**Current status:** ✅ Both happy path and error case are covered.\n\n`;
  }

  // Next steps
  report += `---\n\n`;
  report += `### 📋 Next Steps\n\n`;
  report += generateNextSteps(issueResult);

  // Footer
  report += `\n---\n`;
  report += `*This report was automatically generated by Phrom.*\n`;
  report += `*For questions, contact the Dev team.*`;

  return report;
}

/**
 * generateNextSteps(issueResult) – Prioritized to-dos for PO.
 */
function generateNextSteps(issueResult) {
  const { score, status, deterministicChecks, modelChecks, type } = issueResult;
  const steps = [];

  if (status === "ready") {
    return `- ✅ Issue is ready for refinement. No further steps required.\n- 📅 Schedule the issue for the next refinement meeting.`;
  }

  // Priority 1: Formal issues (missing AC, story format)
  if (!deterministicChecks.acPresence.passed) {
    steps.push(`**1. Add Acceptance Criteria** – At least 2 AC (happy path + error case) in checklist format.`);
  }
  if (!deterministicChecks.storyFormat.passed) {
    steps.push(`**2. Add Story Format** – Formulate "As a [role], I want [goal], so that [benefit]".`);
  }
  if (!deterministicChecks.context.passed) {
    steps.push(`**3. Add Context** – Name product, target audience, and business benefit.`);
  }
  if (!deterministicChecks.epicLink.passed) {
    steps.push(`**4. Add Epic Link** – Link the parent epic or consider making this an epic.`);
  }

  // Priority 2: Content issues (testability, value)
  if (modelChecks.acTestability && !modelChecks.acTestability.passed) {
    steps.push(`**5. Make AC Concrete** – Replace vague terms with measurable criteria (e.g., "load time < 2s").`);
  }
  if (type === "story" && modelChecks.value && !modelChecks.value.passed) {
    steps.push(`**6. Sharpen Business Value** – Name concrete benefit for user/business.`);
  }
  if (type === "epic" && modelChecks.epicGoal && !modelChecks.epicGoal.passed) {
    steps.push(`**7. Formulate Epic Goal as SMART** – Specific, measurable, time-bound.`);
  }
  if (type === "epic" && modelChecks.epicBenefit && !modelChecks.epicBenefit.passed) {
    steps.push(`**8. Clarify Epic Benefit** – Name who gains what concretely.`);
  }

  // Fallback if no specific steps
  if (steps.length === 0) {
    steps.push(`- 📋 Discuss issue in next refinement – clarify open points.`);
  }

  // Always: Plan re-review
  steps.push(`- 🔄 Re-run this report after implementing the points (score should increase).`);

  return steps.map((step, i) => `- ${step}`).join("\n");
}

/**
 * generateShortSummary(issueResult) – Short summary for console/logging.
 */
export function generateShortSummary(issueResult) {
  const { issueNumber, score, status, emoji } = issueResult;
  return `Issue #${issueNumber}: ${emoji} ${status} (${score}/100)`;
}
