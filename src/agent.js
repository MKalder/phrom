/**
 * agent.js – Phrom Agenten-Loop Phase 2 (criteria-based, all types).
 *
 * Reads issues from GitHub, runs deterministic + model checks based on criteria catalogs,
 * calculates type-specific score/status/summary, and saves with timestamp.
 *
 * Phase 2: Criteria-based assessment (Deterministic + AI Checks).
 * NO Improvement Suggestions here – those belong to cli.js (phrom improve).
 * 
 * NOTE: All check keys now use kebab-case to match criteria IDs.
 * ADDED: Central timing for deterministic and model checks.
 */

import "dotenv/config";
import { listIssues, getIssue } from "./tools.js";
import {
  // Story checks
  checkStoryFormat,
  checkContext,
  checkEpicLink,
  checkACPresence,
  checkStoryLinks,
  // Task checks
  checkTechnicalScope,
  checkJustification,
  checkImpactAnalysis,
  checkRollbackPlan,
  // Bug checks
  checkReproductionSteps,
  checkExpectedVsActual,
  checkEnvironmentInfo,
  // Epic checks
  checkGoalStatement,
  checkBenefitStatement,
  checkStoryList,
} from "./checks.js";
import { runModelChecks, inferType } from "./model.js";
import { generateMarkdownReport, generateSummaryReport } from "./report.js";
import { loadCriteria, getRequiredCriteria } from "./criteria-loader.js";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

/**
 * determineType(labels) – Determines type based on labels.
 */
export function determineType(labels) {
  if (!labels || !Array.isArray(labels)) {
    return "unknown";
  }

  const labelNames = labels.map((l) => (l && l.name ? l.name.toLowerCase() : ""));

  if (labelNames.includes("type:epic")) return "epic";
  if (labelNames.includes("type:story")) return "story";
  if (labelNames.includes("type:task")) return "task";
  if (labelNames.includes("type:bug")) return "bug";

  return "unknown";
}

/**
 * runDeterministicChecks(issue, type) – Type-specific deterministic checks.
 * 
 * NOTE: Keys now use kebab-case to match criteria IDs.
 */
export function runDeterministicChecks(issue, type) {
  if (type === "story") {
    return {
      "story-format": checkStoryFormat(issue.body),
      "story-context": checkContext(issue.body),
      "epic-link": checkEpicLink(issue.body),
      "ac-presence": checkACPresence(issue.body),
      "story-links": checkStoryLinks(issue.body),
    };
  } else if (type === "task") {
    return {
      "technical-scope": checkTechnicalScope(issue.body),
      "justification": checkJustification(issue.body),
      "impact-analysis": checkImpactAnalysis(issue.body),
      "rollback-plan": checkRollbackPlan(issue.body),
      "ac-presence": checkACPresence(issue.body),
    };
  } else if (type === "bug") {
    return {
      "reproduction-steps": checkReproductionSteps(issue.body),
      "expected-vs-actual": checkExpectedVsActual(issue.body),
      "environment-info": checkEnvironmentInfo(issue.body),
      "ac-presence": checkACPresence(issue.body),
    };
  } else if (type === "epic") {
    return {
      "goal-statement": checkGoalStatement(issue.body),
      "benefit-statement": checkBenefitStatement(issue.body),
      "story-list": checkStoryList(issue.body),
    };
  }

  // Fallback for "unknown"
  return {
    "story-format": checkStoryFormat(issue.body),
    "story-context": checkContext(issue.body),
    "epic-link": checkEpicLink(issue.body),
    "ac-presence": checkACPresence(issue.body),
    "story-links": checkStoryLinks(issue.body),
  };
}

/**
 * calculateScore(issueResult, type) – Type-specific scoring.
 * 
 * NOTE: Updated to use kebab-case keys.
 */
export function calculateScore(issueResult, type) {
  const { deterministicChecks, modelChecks } = issueResult;

  if (type === "story") {
    let formalScore = 0;
    if (deterministicChecks["story-format"]?.passed) formalScore += 10;
    if (deterministicChecks["story-context"]?.passed) formalScore += 10;
    if (deterministicChecks["epic-link"]?.passed) formalScore += 10;
    if (deterministicChecks["ac-presence"]?.passed) formalScore += 10;
    if (deterministicChecks["story-links"]?.passed) formalScore += 10;

    let contentScore = 0;
    if (modelChecks["ac-testability"]?.passed) contentScore += 17;
    if (modelChecks["size-risk"]?.size) contentScore += 17;
    if (modelChecks["value"]?.passed) contentScore += 16;

    return Math.min(100, formalScore + contentScore);
  }

  if (type === "task") {
    let formalScore = 0;
    if (deterministicChecks["technical-scope"]?.passed) formalScore += 15;
    if (deterministicChecks["justification"]?.passed) formalScore += 10;
    if (deterministicChecks["impact-analysis"]?.passed) formalScore += 10;
    if (deterministicChecks["rollback-plan"]?.passed) formalScore += 10;
    if (deterministicChecks["ac-presence"]?.passed) formalScore += 5;

    let contentScore = 0;
    if (modelChecks["ac-testability"]?.passed) contentScore += 20;
    if (modelChecks["size-risk"]?.size) contentScore += 15;
    if (modelChecks["technical-feasibility"]?.passed) contentScore += 10;
    if (modelChecks["rollback-risk"]?.passed) contentScore += 5;

    return Math.min(100, formalScore + contentScore);
  }

  if (type === "bug") {
    let formalScore = 0;
    if (deterministicChecks["reproduction-steps"]?.passed) formalScore += 15;
    if (deterministicChecks["expected-vs-actual"]?.passed) formalScore += 15;
    if (deterministicChecks["environment-info"]?.passed) formalScore += 10;
    if (deterministicChecks["ac-presence"]?.passed) formalScore += 10;

    let contentScore = 0;
    if (modelChecks["ac-testability"]?.passed) contentScore += 20;
    if (modelChecks["size-risk"]?.size) contentScore += 15;
    if (modelChecks["severity"]?.passed) contentScore += 10;
    if (modelChecks["reproducibility"]?.passed) contentScore += 10;

    return Math.min(100, formalScore + contentScore);
  }

  if (type === "epic") {
    let formalScore = 0;
    if (deterministicChecks["goal-statement"]?.passed) formalScore += 15;
    if (deterministicChecks["benefit-statement"]?.passed) formalScore += 15;
    if (deterministicChecks["story-list"]?.passed) formalScore += 10;

    let contentScore = 0;
    if (modelChecks["ac-testability"]?.passed) contentScore += 17;
    if (modelChecks["size-risk"]?.size) contentScore += 17;
    if (modelChecks["epic-goal"]?.passed) contentScore += 8;
    if (modelChecks["epic-benefit"]?.passed) contentScore += 8;

    return Math.min(100, formalScore + contentScore);
  }
  // Fallback for "unknown"
  return 0;
}

/**
 * calculateStatus(score, hasFailedRequired) – Ampel-Status with ready gate.
 */
export function calculateStatus(score, hasFailedRequired = false) {
  if (hasFailedRequired) {
    return { status: "not-ready", emoji: "🔴" };
  }

  if (score >= 80) return { status: "ready", emoji: "🟢" };
  if (score >= 50) return { status: "needs-work", emoji: "🟡" };
  return { status: "not-ready", emoji: "🔴" };
}

/**
 * generateSummary(issueResult, type) – Type-specific summary.
 * 
 * NOTE: Updated to use kebab-case keys.
 */
export function generateSummary(issueResult, type) {
  const { issueNumber, deterministicChecks, modelChecks } = issueResult;
  const failedChecks = [];

  if (type === "story") {
    if (!deterministicChecks["story-format"]?.passed) failedChecks.push("no story format");
    if (!deterministicChecks["story-context"]?.passed) failedChecks.push("no context");
    if (!deterministicChecks["epic-link"]?.passed) failedChecks.push("no epic link");
    if (!deterministicChecks["ac-presence"]?.passed) failedChecks.push("no AC");
    if (modelChecks["business-value"]?.passed === false) failedChecks.push("value unclear");
  } else if (type === "task") {
    if (!deterministicChecks["technical-scope"]?.passed) failedChecks.push("unclear technical scope");
    if (!deterministicChecks["justification"]?.passed) failedChecks.push("missing justification");
    if (!deterministicChecks["impact-analysis"]?.passed) failedChecks.push("missing impact analysis");
    if (!deterministicChecks["rollback-plan"]?.passed) failedChecks.push("missing rollback plan");
  } else if (type === "bug") {
    if (!deterministicChecks["reproduction-steps"]?.passed) failedChecks.push("no reproduction steps");
    if (!deterministicChecks["expected-vs-actual"]?.passed) failedChecks.push("expected vs. actual missing");
    if (!deterministicChecks["environment-info"]?.passed) failedChecks.push("environment info missing");
  } else if (type === "epic") {
    if (!deterministicChecks["goal-statement"]?.passed) failedChecks.push("no clear epic goal");
    if (!deterministicChecks["benefit-statement"]?.passed) failedChecks.push("no quantified benefit");
    if (!deterministicChecks["story-list"]?.passed) failedChecks.push("no child stories listed");

    if (modelChecks["ac-testability"]?.passed === false) failedChecks.push("AC not testable");
    if (type === "epic" && modelChecks["epic-goal"]?.passed === false) failedChecks.push("epic goal unclear");
    if (type === "epic" && modelChecks["epic-benefit"]?.passed === false) failedChecks.push("epic benefit unclear");
  }

  if (failedChecks.length === 0) {
    return `Issue #${issueNumber} is ready for refinement. All checks passed.`;
  }

  const firstThree = failedChecks.slice(0, 3).join(", ");
  const moreText = failedChecks.length > 3 ? ` And ${failedChecks.length - 3} more points.` : "";
  return `Issue #${issueNumber}: ${firstThree}.${moreText}`;
}

/**
 * checkReadyGate(result, type) – Checks if any required criterion failed.
 * 
 * NOTE: Now uses criterion.id directly (kebab-case) without replace().
 */
export function checkReadyGate(result, type) {
  const criteria = loadCriteria(type);
  if (!criteria || !criteria.criteria) return false;

  const requiredCriteria = criteria.criteria.filter((c) => c.required);

  // Check deterministic
  for (const criterion of requiredCriteria) {
    if (criterion.check === "code") {
      const checkResult = result.deterministicChecks[criterion.id];
      if (checkResult && !checkResult.passed) {
        return true; // Failed required criterion
      }
    }
  }

  // Check model
  for (const criterion of requiredCriteria) {
    if (criterion.check === "model") {
      const checkResult = result.modelChecks[criterion.id];
      if (checkResult && !checkResult.passed) {
        return true; // Failed required criterion
      }
    }
  }

  return false; // All required criteria passed
}

/**
 * processIssue(issue) – Verarbeitet ein einzelnes Issue.
 * ADDED: Central timing for deterministic and model checks.
 */
export async function processIssue(issue) {
  let type = determineType(issue.labels);
  let typeInference = null;

  if (type === "unknown") {
    console.log(`  Type unknown from labels, inferring via model...`);
    typeInference = await inferType(issue);
    type = typeInference.type;
  }

  // Timing: Deterministic checks
  const detStart = performance.now();
  const detChecks = runDeterministicChecks(issue, type);
  const detDuration = performance.now() - detStart;

  // Timing: Model checks
  let modelChecks = {};
  const modelStart = performance.now();
  try {
    console.log(`  Running model checks for type: ${type}...`);
    modelChecks = await runModelChecks(issue, type);
  } catch (err) {
    console.error(`  Model checks failed: ${err.message}`);
    modelChecks = { error: { status: "failed", reason: err.message } };
  }
  const modelDuration = performance.now() - modelStart;

  const result = {
    issueNumber: issue.number,
    title: issue.title,
    body: issue.body,
    type,
    typeInference,
    deterministicChecks: detChecks,
    modelChecks,
    timings: {
      deterministic: detDuration,
      model: modelDuration,
      total: detDuration + modelDuration,
    },
    timestamp: new Date().toISOString(),
  };

  result.score = calculateScore(result, type);

  // Check ready gate
  const hasFailedRequired = checkReadyGate(result, type);
  const statusInfo = calculateStatus(result.score, hasFailedRequired);
  result.status = statusInfo.status;
  result.emoji = statusInfo.emoji;
  result.summary = generateSummary(result, type);

  return result;
}

/**
 * runAgent() – Hauptfunktion.
 */
export async function runAgent() {
  console.log("Starting Phrom agent (Phase 2: criteria-based assessment)...\n");

  const issues = await listIssues();
  console.log(`Found ${issues.length} issues to process.\n`);

  const results = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Output directories
  const outputDir = path.join(process.cwd(), "output");
  const reportsDir = path.join(outputDir, "reports");
  mkdirSync(reportsDir, { recursive: true });

  for (const issue of issues) {
    const fullIssue = await getIssue(issue.number);
    console.log(`Processing Issue #${fullIssue.number}: "${fullIssue.title}"`);

    const result = await processIssue(fullIssue);
    results.push(result);

    const detPassed = Object.values(result.deterministicChecks).filter((c) => c.passed).length;
    const detTotal = Object.values(result.deterministicChecks).length;
    const modelStatus = result.modelChecks.error ? "error" : "ok";

    // Console output with timing
    const detTime = result.timings.deterministic.toFixed(1);
    const modelTime = (result.timings.model / 1000).toFixed(1);
    console.log(`  Deterministic: ${detPassed}/${detTotal} passed (${detTime} ms) | Model: ${modelStatus} (${modelTime} s) | Score: ${result.score}/100 ${result.emoji} ${result.status}\n`);

    // Save individual report immediately
    const markdown = generateMarkdownReport(result, result.type);
    const reportPath = path.join(reportsDir, `issue-${result.issueNumber}-report-${timestamp}.md`);
    writeFileSync(reportPath, markdown, "utf-8");
    console.log(`  → Report saved: ${reportPath}`);
  }

  // Save summary report
  const summaryMarkdown = generateSummaryReport(results, timestamp);
  const summaryPath = path.join(outputDir, `summary-${timestamp}.md`);
  writeFileSync(summaryPath, summaryMarkdown, "utf-8");
  console.log(`\n✓ Summary saved: ${summaryPath}`);

  // Save JSON results
  const jsonPath = path.join(outputDir, `results-${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`✓ Results saved: ${jsonPath}`);

  // Console summary
  const readyCount = results.filter((r) => r.status === "ready").length;
  const needsWorkCount = results.filter((r) => r.status === "needs-work").length;
  const notReadyCount = results.filter((r) => r.status === "not-ready").length;

  console.log(`\n=== Summary ===`);
  console.log(`🟢 Ready: ${readyCount}`);
  console.log(`🟡 Needs work: ${needsWorkCount}`);
  console.log(`🔴 Not ready: ${notReadyCount}`);
  console.log(`Total: ${results.length} issues`);

  return results;
}

/**
 * generateSummaryReport(results, timestamp) – Erstellt Summary-Report.
 * (Re-export from report.js for convenience if needed)
 */
export { generateSummaryReport };

/**
 * main() – Entry Point (nur wenn agent.js direkt gestartet wird).
 *
 * IMPORTANT: NO IMPROVEMENT GENERATION HERE.
 * Improvements are only generated via cli.js (phrom improve).
 */
async function main() {
  await runAgent();

  // Only execute if agent.js is run directly (not imported)
  if (import.meta.url === `file://${process.argv[1]}`) {
    // runAgent() already handles all output and saving
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Error:", error.message);
    process.exitCode = 1;
  });
}