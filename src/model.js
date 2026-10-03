/**
 * model.js – Ollama-Wrapper für Modell-Checks (Phase 2).
 *
 * Nutzt die offizielle ollama-Library für strukturierte Calls.
 * Konfiguration über .env:
 *   OLLAMA_HOST=http://localhost:11434
 *   MODEL_NAME=qwen3:30b-instruct
 */

import ollama from "ollama";

const MODEL_NAME = process.env.MODEL_NAME || "qwen3:30b-instruct";


/**
 * askModel(prompt, schema) – Führt einen Modell-Call mit Structured Output aus.
 * @param {string} prompt - Der vollständige Prompt.
 * @param {object} schema - JSON-Schema für die erwartete Antwort.
 * @returns {Promise<object>} Geparste JSON-Antwort.
 */
async function askModel(prompt, schema) {
  const response = await ollama.chat({
    model: MODEL_NAME,
    messages: [{ role: "user", content: prompt }],
    format: schema,
    options: {
      temperature: 0,
      top_k: 1,
      seed: 42,
    },
  });

  return JSON.parse(response.message.content);
}

/**
 * askModelWithRetry(prompt, schema, retries) – Mit einfachem Retry.
 */
async function askModelWithRetry(prompt, schema, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await askModel(prompt, schema);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

/**
 * Helper: Issue-Kontext als Prompt-Block.
 */
function issueBlock(issue) {
  return `## Issue #${issue.number}: ${issue.title}\n\n${issue.body || "(empty body)"}`;
}

// ---------------------------------------------------------------------------
// JSON-Schemas pro Check-Dimension
// ---------------------------------------------------------------------------

const PASS_FAIL_SCHEMA = {
  type: "object",
  properties: {
    passed: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["passed", "reason"],
};

const SIZE_RISK_SCHEMA = {
  type: "object",
  properties: {
    size: { type: "string", enum: ["S", "M", "L", "XL"] },
    reason: { type: "string" },
  },
  required: ["size", "reason"],
};

const TYPE_INFERENCE_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["story", "epic", "task", "bug"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reason: { type: "string" },
  },
  required: ["type", "confidence", "reason"],
};

// ---------------------------------------------------------------------------
// Check-Funktionen (je eine pro Dimension)
// ---------------------------------------------------------------------------

/**
 * checkAcTestability(issue) – Prüft, ob Acceptance Criteria testbar sind.
 */
export async function checkAcTestability(issue) {
  const prompt = `You are a senior QA engineer reviewing a backlog item.
Evaluate whether the acceptance criteria of this issue are testable:
clear, measurable, unambiguous, and verifiable (no vague wording like
"works well" or "is user-friendly"). If there are no acceptance criteria
at all, the check fails.

${issueBlock(issue)}

Respond as JSON: passed = true if all acceptance criteria are testable,
false otherwise. Give a short reason (1-2 sentences, in the language of the issue).`;

  return askModelWithRetry(prompt, PASS_FAIL_SCHEMA);
}

/**
 * checkSizeRisk(issue) – Schätzt Aufwand/Risiko des Items.
 */
export async function checkSizeRisk(issue) {
  const prompt = `You are an experienced software project lead estimating backlog items.
Estimate the implementation effort and risk of this issue.
Use the following scale:
- S: small, well understood, < 1 day, low risk
- M: medium, 1-3 days, some open questions
- L: large, 3-10 days, significant uncertainty or dependencies
- XL: too large, must be split, > 10 days or many unknowns

${issueBlock(issue)}

Respond as JSON: size (S/M/L/XL) and a short reason (1-2 sentences, in the language of the issue).`;

  return askModelWithRetry(prompt, SIZE_RISK_SCHEMA);
}

/**
 * checkValue(issue) – Bewertet den Business-Wert einer Story.
 */
export async function checkValue(issue) {
  const prompt = `You are a product owner reviewing a user story.
Evaluate whether this story clearly communicates business value:
a specific user or role, a concrete need, and an understandable benefit.
Vague stories like "improve X" without a stated benefit fail this check.

${issueBlock(issue)}

Respond as JSON: passed = true if the business value is clearly stated,
false otherwise. Give a short reason (1-2 sentences, in the language of the issue).`;

  return askModelWithRetry(prompt, PASS_FAIL_SCHEMA);
}

/**
 * checkEpicGoal(issue) – Prüft, ob ein Epic ein klares Ziel hat.
 */
export async function checkEpicGoal(issue) {
  const prompt = `You are a product owner reviewing an epic.
Evaluate whether this epic has a clearly formulated goal:
what problem it solves or which outcome it achieves for the business or user.
Epics that only list topics without a goal fail this check.

${issueBlock(issue)}

Respond as JSON: passed = true if the goal is clear, false otherwise.
Give a short reason (1-2 sentences, in the language of the issue).`;

  return askModelWithRetry(prompt, PASS_FAIL_SCHEMA);
}

/**
 * checkEpicBenefit(issue) – Prüft, ob ein Epic einen nachvollziehbaren Nutzen formuliert.
 */
export async function checkEpicBenefit(issue) {
  const prompt = `You are a product owner reviewing an epic.
Evaluate whether this epic states a comprehensible benefit:
who gains what from completing it, ideally in a measurable or at least
plausible form. Epics without a stated benefit fail this check.

${issueBlock(issue)}

Respond as JSON: passed = true if the benefit is clear, false otherwise.
Give a short reason (1-2 sentences, in the language of the issue).`;

  return askModelWithRetry(prompt, PASS_FAIL_SCHEMA);
}

/**
 * inferType(issue) – Fallback-Typermittlung per Modell (bei unbekannten Labels).
 */
export async function inferType(issue) {
  const prompt = `You are a project manager triaging a backlog item.
Classify this issue into exactly one type:
- epic: a large initiative spanning multiple stories
- story: a user-facing requirement with value for a user
- task: technical work without direct user value (e.g. migration, refactoring)
- bug: a defect report describing broken behavior

${issueBlock(issue)}

Respond as JSON: type, your confidence (high/medium/low),
and a short reason (1-2 sentences, in the language of the issue).`;

  return askModelWithRetry(prompt, TYPE_INFERENCE_SCHEMA);
}

/**
 * runModelChecks(issue, type) – Führt alle passenden Modell-Checks für ein Issue aus.
 * Gibt ein Objekt mit den Ergebnissen zurück.
 */
export async function runModelChecks(issue, type) {
  const results = {};

  results.acTestability = await checkAcTestability(issue);
  results.sizeRisk = await checkSizeRisk(issue);

  if (type === "story") {
    results.value = await checkValue(issue);
  } else if (type === "epic") {
    results.epicGoal = await checkEpicGoal(issue);
    results.epicBenefit = await checkEpicBenefit(issue);
  }

  return results;
}

export { MODEL_NAME };
