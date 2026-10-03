/**
 * agent.js – Phrom Agenten-Loop Phase 3 (mit timestamped Results + Summary-Report).
 *
 * Liest Issues von GitHub, führt deterministische + Modell-Checks aus,
 * berechnet Score/Status/Summary und speichert Ergebnisse mit Timestamp.
 *
 * Phase 3: Read-only, mit Reports + Historie.
 */

import "dotenv/config";

import { listIssues, getIssue } from "./tools.js";
import {
  checkStoryFormat,
  checkContext,
  checkEpicLink,
  checkACPresence,
  checkStoryLinks,
} from "./checks.js";
import { runModelChecks, inferType } from "./model.js";
import { generateMarkdownReport } from "./report.js";
import { writeFileSync, mkdirSync } from "fs";

/**
 * determineType(labels) – Bestimmt den Typ anhand der Labels.
 */
function determineType(labels) {
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
 * runDeterministicChecks(issue) – Führt alle deterministischen Checks aus.
 */
function runDeterministicChecks(issue) {
  return {
    storyFormat: checkStoryFormat(issue.body),
    context: checkContext(issue.body),
    epicLink: checkEpicLink(issue.body),
    acPresence: checkACPresence(issue.body),
    storyLinks: checkStoryLinks(issue.body),
  };
}

/**
 * calculateScore(issueResult) – Berechnet 0–100 Punkte.
 */
function calculateScore(issueResult) {
  const { deterministicChecks, modelChecks, type } = issueResult;

  let formalScore = 0;
  if (deterministicChecks.storyFormat.passed) formalScore += 10;
  if (deterministicChecks.context.passed) formalScore += 10;
  if (deterministicChecks.epicLink.passed) formalScore += 10;
  if (deterministicChecks.acPresence.passed) formalScore += 10;
  if (deterministicChecks.storyLinks && deterministicChecks.storyLinks.passed) formalScore += 10;

  let contentScore = 0;

  if (modelChecks.acTestability && modelChecks.acTestability.passed) contentScore += 17;
  if (modelChecks.sizeRisk && modelChecks.sizeRisk.size) contentScore += 17;

  if (type === "story") {
    if (modelChecks.value && modelChecks.value.passed) contentScore += 16;
  } else if (type === "epic") {
    if (modelChecks.epicGoal && modelChecks.epicGoal.passed) contentScore += 8;
    if (modelChecks.epicBenefit && modelChecks.epicBenefit.passed) contentScore += 8;
  } else if (type === "task" || type === "bug") {
    contentScore += 16;
  }

  const totalScore = Math.min(100, formalScore + contentScore);
  return totalScore;
}

/**
 * calculateStatus(score) – Ampel-Status.
 */
function calculateStatus(score) {
  if (score >= 80) return { status: "ready", emoji: "🟢" };
  if (score >= 50) return { status: "needs-work", emoji: "🟡" };
  return { status: "not-ready", emoji: "🔴" };
}

/**
 * generateSummary(issueResult) – 1-2 Sätze für PO.
 */
function generateSummary(issueResult) {
  const { issueNumber, deterministicChecks, modelChecks, type } = issueResult;
  const failedChecks = [];

  if (!deterministicChecks.storyFormat.passed) failedChecks.push("no story format");
  if (!deterministicChecks.context.passed) failedChecks.push("no context");
  if (!deterministicChecks.epicLink.passed) failedChecks.push("no epic link");
  if (!deterministicChecks.acPresence.passed) failedChecks.push("no AC");

  if (modelChecks.acTestability && !modelChecks.acTestability.passed) failedChecks.push("AC not testable");
  if (type === "story" && modelChecks.value && !modelChecks.value.passed) failedChecks.push("value unclear");
  if (type === "epic" && modelChecks.epicGoal && !modelChecks.epicGoal.passed) failedChecks.push("epic goal unclear");
  if (type === "epic" && modelChecks.epicBenefit && !modelChecks.epicBenefit.passed) failedChecks.push("epic benefit unclear");

  if (failedChecks.length === 0) {
    return `Issue #${issueNumber} is ready for refinement. All checks passed.`;
  }

  const firstThree = failedChecks.slice(0, 3).join(", ");
  const moreText = failedChecks.length > 3 ? ` And ${failedChecks.length - 3} more points.` : "";

  return `Issue #${issueNumber}: ${firstThree}.${moreText}`;
}

/**
 * processIssue(issue) – Verarbeitet ein einzelnes Issue.
 */
async function processIssue(issue) {
  let type = determineType(issue.labels);
  let typeInference = null;

  if (type === "unknown") {
    console.log(`  Type unknown from labels, inferring via model...`);
    typeInference = await inferType(issue);
    type = typeInference.type;
  }

  const detChecks = runDeterministicChecks(issue);

  let modelChecks = {};
  try {
    console.log(`  Running model checks for type: ${type}...`);
    modelChecks = await runModelChecks(issue, type);
  } catch (err) {
    console.error(`  Model checks failed: ${err.message}`);
    modelChecks = {
      error: { status: "failed", reason: err.message },
    };
  }

  const result = {
    issueNumber: issue.number,
    title: issue.title,
    type,
    typeInference,
    deterministicChecks: detChecks,
    modelChecks,
    timestamp: new Date().toISOString(),
  };

  result.score = calculateScore(result);
  const statusInfo = calculateStatus(result.score);
  result.status = statusInfo.status;
  result.emoji = statusInfo.emoji;
  result.summary = generateSummary(result);

  return result;
}

/**
 * runAgent() – Hauptfunktion.
 */
export async function runAgent() {
  console.log("Starting Phrom agent (Phase 3: timestamped results + summary report)...");

  const issues = await listIssues();
  console.log(`Found ${issues.length} issues to process.\n`);

  const results = [];

  for (const issue of issues) {
    const fullIssue = await getIssue(issue.number);
    console.log(`Processing Issue #${fullIssue.number}: "${fullIssue.title}"`);

    const result = await processIssue(fullIssue);
    results.push(result);

    const detPassed = Object.values(result.deterministicChecks).filter((c) => c.passed).length;
    const detTotal = Object.values(result.deterministicChecks).length;
    const modelStatus = result.modelChecks.error ? "error" : "ok";
    console.log(`  Deterministic: ${detPassed}/${detTotal} passed | Model: ${modelStatus} | Score: ${result.score}/100 ${result.emoji} ${result.status}\n`);
  }

  return results;
}

/**
 * generateSummaryReport(results, timestamp) – Erstellt Summary-Report für alle Issues.
 */
function generateSummaryReport(results, timestamp) {
  const readyIssues = results.filter((r) => r.status === "ready");
  const needsWorkIssues = results.filter((r) => r.status === "needs-work");
  const notReadyIssues = results.filter((r) => r.status === "not-ready");

  let report = `# 🤖 Phrom Summary Report\n\n`;
  report += `**Generated:** ${timestamp}\n\n`;
  report += `---\n\n`;

  report += `## 📊 Overview\n\n`;
  report += `| Status | Count | Percentage |\n`;
  report += `|--------|-------|------------|\n`;
  report += `| 🟢 Ready | ${readyIssues.length} | ${Math.round((readyIssues.length / results.length) * 100)}% |\n`;
  report += `| 🟡 Needs work | ${needsWorkIssues.length} | ${Math.round((needsWorkIssues.length / results.length) * 100)}% |\n`;
  report += `| 🔴 Not ready | ${notReadyIssues.length} | ${Math.round((notReadyIssues.length / results.length) * 100)}% |\n`;
  report += `| **Total** | **${results.length}** | **100%** |\n\n`;

  report += `---\n\n`;

  report += `## 🟢 Ready Issues (${readyIssues.length})\n\n`;
  if (readyIssues.length > 0) {
    for (const issue of readyIssues) {
      report += `- **#${issue.issueNumber}**: "${issue.title}" – ${issue.score}/100\n`;
    }
  } else {
    report += `*No ready issues.*\n`;
  }
  report += `\n`;

  report += `## 🟡 Needs Work (${needsWorkIssues.length})\n\n`;
  if (needsWorkIssues.length > 0) {
    for (const issue of needsWorkIssues) {
      report += `- **#${issue.issueNumber}**: "${issue.title}" – ${issue.score}/100 – ${issue.summary}\n`;
    }
  } else {
    report += `*No issues needing work.*\n`;
  }
  report += `\n`;

  report += `## 🔴 Not Ready (${notReadyIssues.length})\n\n`;
  if (notReadyIssues.length > 0) {
    for (const issue of notReadyIssues) {
      report += `- **#${issue.issueNumber}**: "${issue.title}" – ${issue.score}/100 – ${issue.summary}\n`;
    }
  } else {
    report += `*No not-ready issues.*\n`;
  }
  report += `\n`;

  report += `---\n\n`;

  report += `## 🎯 Top 3 Priorities\n\n`;
  const sortedByScore = [...results].sort((a, b) => a.score - b.score);
  const top3 = sortedByScore.slice(0, 3);
  for (const [index, issue] of top3.entries()) {
    report += `${index + 1}. **#${issue.issueNumber} "${issue.title}"** – Score: ${issue.score}/100\n`;
    report += `   - ${issue.summary}\n\n`;
  }

  report += `---\n\n`;
  report += `*This summary was automatically generated by Phrom.*\n`;

  return report;
}

/**
 * main() – Entry Point.
 */
async function main() {
  const results = await runAgent();

  // Timestamp für alle Files
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // JSON-Ergebnisse speichern (timestamped)
  const outputDir = "output";
  mkdirSync(outputDir, { recursive: true });

  const jsonPath = `${outputDir}/results-${timestamp}.json`;
  writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✓ Results saved to ${jsonPath}`);

  // Markdown-Reports für jedes Issue speichern
  const reportsDir = `${outputDir}/reports`;
  mkdirSync(reportsDir, { recursive: true });

  for (const result of results) {
    const markdown = generateMarkdownReport(result);
    const reportPath = `${reportsDir}/issue-${result.issueNumber}-report-${timestamp}.md`;
    writeFileSync(reportPath, markdown, "utf-8");
    console.log(`  → Report saved: ${reportPath}`);
  }

  // Summary-Report für alle Issues
  const summaryMarkdown = generateSummaryReport(results, timestamp);
  const summaryPath = `${outputDir}/summary-${timestamp}.md`;
  writeFileSync(summaryPath, summaryMarkdown, "utf-8");
  console.log(`  → Summary saved: ${summaryPath}`);

  // Kurze Zusammenfassung am Ende
  const readyCount = results.filter((r) => r.status === "ready").length;
  const needsWorkCount = results.filter((r) => r.status === "needs-work").length;
  const notReadyCount = results.filter((r) => r.status === "not-ready").length;

  console.log(`\n=== Summary ===`);
  console.log(`🟢 Ready: ${readyCount}`);
  console.log(`🟡 Needs work: ${needsWorkCount}`);
  console.log(`🔴 Not ready: ${notReadyCount}`);
  console.log(`Total: ${results.length} issues`);
}

main().catch(console.error);
