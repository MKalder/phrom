/**
 * agent.js – Minimaler Agenten-Loop für Phrom.
 *
 * Liest Issues von GitHub, führt deterministische Checks aus
 * und speichert Ergebnisse in JSON.
 *
 * Phase 1: Nur lesen, nur deterministische Checks (kein Modell, kein Schreiben).
 */

import { listIssues, getIssue } from "./tools.js";
import {
  checkStoryFormat,
  checkContext,
  checkEpicLink,
  checkACPresence,
} from "./checks.js";
import { writeFileSync, mkdirSync } from "fs";

/**
 * determineType(labels) – Bestimmt den Typ anhand der Labels.
 * Erwartet: labels = [{ name: "type:story" }, ...] oder undefined.
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
 * Rückgabe: Objekt mit Ergebnissen pro Check.
 */
function runDeterministicChecks(issue) {
  return {
    storyFormat: checkStoryFormat(issue.body),
    context: checkContext(issue.body),
    epicLink: checkEpicLink(issue.body),
    acPresence: checkACPresence(issue.body),
  };
}

/**
 * processIssue(issue) – Verarbeitet ein einzelnes Issue.
 * Rückgabe: Ergebnis-Objekt für dieses Issue.
 */
function processIssue(issue) {
  const type = determineType(issue.labels);
  const detChecks = runDeterministicChecks(issue);

  // Modell-Checks (Phase 1: nur Platzhalter)
  const modelChecks = {
    acTestability: { status: "pending", reason: "Model not integrated yet" },
    sizeRisk: { status: "pending", reason: "Model not integrated yet" },
    value: type === "story" ? { status: "pending", reason: "Model not integrated yet" } : null,
    epicGoal: type === "epic" ? { status: "pending", reason: "Model not integrated yet" } : null,
    epicBenefit: type === "epic" ? { status: "pending", reason: "Model not integrated yet" } : null,
  };

  return {
    issueNumber: issue.number,
    title: issue.title,
    type,
    deterministicChecks: detChecks,
    modelChecks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * runAgent() – Hauptfunktion: Liest Issues, verarbeitet sie, gibt Ergebnisse zurück.
 */
export async function runAgent() {
  console.log("Starting Phrom agent (Phase 1: read-only, deterministic checks only)...");

  const issues = await listIssues();
  console.log(`Found ${issues.length} issues to process.\n`);

  const results = [];

  for (const issue of issues) {
    const fullIssue = await getIssue(issue.number);
    console.log(`Processing Issue #${fullIssue.number}: "${fullIssue.title}"`);

    const result = processIssue(fullIssue);
    results.push(result);

    // Kurze Zusammenfassung pro Issue
    const detPassed = Object.values(result.deterministicChecks).filter((c) => c.passed).length;
    const detTotal = Object.values(result.deterministicChecks).length;
    console.log(`  Deterministic checks: ${detPassed}/${detTotal} passed (type: ${result.type})\n`);
  }

  return results;
}

/**
 * main() – Entry Point für node src/agent.js
 */
async function main() {
  const results = await runAgent();

  console.log("\n=== Agent Results ===");
  console.log(JSON.stringify(results, null, 2));

  // Ergebnisse in Datei schreiben
  const outputDir = "output";
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (e) {
    // Dir exists, ignore
  }

  const outputPath = `${outputDir}/results.json`;
  writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✓ Results saved to ${outputPath}`);
}

main().catch(console.error);
