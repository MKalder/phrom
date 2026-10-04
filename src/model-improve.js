/**
 * Phrom Model-Improvement Generator (Phase 2)
 * LLM-powered improvement suggestions using reference quality examples.
 *
 * Robust parsing: handles both array and object responses from LLM.
 */

import ollama from "ollama";

const MODEL_NAME = process.env.MODEL_NAME || "qwen3:30b-instruct";

/**
 * Generate improvement suggestions using LLM + reference quality example.
 *
 * @param {string} type - Issue type: story | task | bug | epic
 * @param {Object} issue - Issue object: title, body, number, type
 * @param {Array<string>} failedCriteria - Failed criterion IDs
 * @param {Object} reference - Reference quality example for this type
 * @returns {Promise<Array>} Suggestions with check, suggestion, before, after
 */
export async function generateLLMImprovements(
  type,
  issue,
  failedCriteria,
  reference,
) {
  if (!Array.isArray(failedCriteria) || failedCriteria.length === 0) {
    return [];
  }

  const prompt = `
You are an expert product owner helping to improve GitHub issue quality.

REFERENCE ${type.toUpperCase()} (quality standard for this organization):
${JSON.stringify(reference, null, 2)}

ISSUE TO IMPROVE:
Title: ${issue.title}
Current Description:
${issue.body || "(empty)"}

FAILED CRITERIA:
${failedCriteria.map((criterion) => `- ${criterion}`).join("\n")}

YOUR TASK:
For each failed criterion, provide one concrete improvement suggestion.

Rules:
1. Explain what is missing or needs improvement.
2. Provide an example in the STRUCTURE and STYLE of the reference.
3. Adapt the suggestion to the current issue context.
4. Use [placeholders] for information that cannot be derived from the issue.
5. Keep suggestions concise and actionable.
6. Do NOT copy concrete values from the reference, including issue numbers, names, dates, metrics, systems, or company facts.
7. Write all output in English.

REQUIRED JSON ARRAY FORMAT:
[
  {
    "check": "criterion-id",
    "suggestion": "What should be improved.",
    "before": "Current content or (not present)",
    "after": "Recommended Markdown text using [placeholders] where required."
  }
]

IMPORTANT OUTPUT RULES:
- Output ONLY one valid JSON array.
- Do NOT wrap the array in an object such as {"suggestions": [...]}.
- Do NOT add Markdown fences.
- Do NOT add explanations before or after the JSON array.
- If no suggestion can be produced, return [].
`.trim();

  try {
    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt,
      format: "json",
      options: {
        temperature: 0.2,
        top_p: 0.9,
      },
    });

    const rawResponse = response.response?.trim() || "";

    if (!rawResponse) {
      console.warn("LLM returned an empty improvement response.");
      return [];
    }

    let parsed;

    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error(
        `Failed to parse LLM improvement response as JSON: ${parseError.message}`,
      );
      console.error(`Raw response preview: ${rawResponse.slice(0, 300)}...`);
      return [];
    }

    /*
     * Compatibility layer:
     * Some models ignore the requested array and produce:
     * { "suggestions": [...] }
     * { "improvements": [...] }
     * { "data": [...] }
     */
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.suggestions)) {
        console.warn(
          "LLM returned an object with .suggestions; unwrapping the array.",
        );
        parsed = parsed.suggestions;
      } else if (Array.isArray(parsed.improvements)) {
        console.warn(
          "LLM returned an object with .improvements; unwrapping the array.",
        );
        parsed = parsed.improvements;
      } else if (Array.isArray(parsed.data)) {
        console.warn(
          "LLM returned an object with .data; unwrapping the array.",
        );
        parsed = parsed.data;
      } else {
        console.warn(
          `LLM returned an unsupported JSON object. Keys: ${Object.keys(parsed).join(", ") || "(none)"}`,
        );
        console.warn(`Raw response preview: ${rawResponse.slice(0, 300)}...`);
        return [];
      }
    }

    if (!Array.isArray(parsed)) {
      console.warn(
        `LLM response is not an array after normalization: ${typeof parsed}`,
      );
      console.warn(`Raw response preview: ${rawResponse.slice(0, 300)}...`);
      return [];
    }

    const validChecks = new Set(failedCriteria);

    return parsed
      .filter(
        (suggestion) =>
          suggestion &&
          typeof suggestion === "object" &&
          typeof suggestion.check === "string" &&
          typeof suggestion.suggestion === "string" &&
          typeof suggestion.after === "string",
      )
      .filter((suggestion) => validChecks.has(suggestion.check))
      .map((suggestion) => ({
        check: suggestion.check.trim(),
        suggestion: suggestion.suggestion.trim(),
        before:
          typeof suggestion.before === "string" && suggestion.before.trim()
            ? suggestion.before.trim()
            : "(not present)",
        after: suggestion.after.trim(),
      }));
  } catch (error) {
    console.error(`LLM improvement generation failed: ${error.message}`);
    return [];
  }
}

/**
 * Generate a complete revised issue draft based on suggestions.
 *
 * The reference is only a style and quality example. Concrete facts must never
 * be copied from it into the draft.
 *
 * @param {Object} issue - Issue object
 * @param {Array} suggestions - Improvement suggestions
 * @param {Object} reference - Matching reference quality example
 * @returns {Promise<string>} Markdown issue draft
 */
export async function generateRevisedIssueDraft(
  issue,
  suggestions,
  reference,
) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return "";
  }

  const issueType = issue.type || "unknown";

  const prompt = `
You are an expert product owner. Create a complete revised GitHub issue draft.

REFERENCE ${issueType.toUpperCase()} (style and quality guide only):
${JSON.stringify(reference, null, 2)}

ORIGINAL ISSUE:
Title: ${issue.title}
Description:
${issue.body || "(empty)"}

IMPROVEMENT SUGGESTIONS:
${suggestions
      .map(
        (suggestion, index) =>
          `${index + 1}. ${suggestion.check}
Problem: ${suggestion.suggestion}
Recommended direction: ${suggestion.after}`,
      )
      .join("\n\n")}

YOUR TASK:
Write a complete revised Markdown issue description.

Rules:
1. Preserve facts that are present in the original issue.
2. Use the reference only for structure, depth, writing style, and quality level.
3. Do NOT copy concrete names, numbers, issue IDs, dates, metrics, systems, teams, or business facts from the reference.
4. Use [placeholders] for information that cannot be safely inferred.
5. Use exactly this text for unresolved information:
   Open discovery question: [question]
6. Do not invent facts.
7. Write entirely in English.
8. Do not include a title heading; only return the issue body.

Required structure by type:

For epics:
## Context
## Company Goal
## Goal
## Benefits
## Scope
### In Scope
### Out of Scope
## Owner
## Stakeholders
## Child Stories / Candidate Slices
## Milestones
## Success Measures
## Risks and Mitigations
## Dependencies

For stories:
## Context
## Story
## Acceptance Criteria
### Happy Path
### Error Cases
## Dependencies

For tasks:
## Context
## Justification
## Technical Scope
## Impact Analysis
## Rollback Plan
## Verification Criteria
## Dependencies

For bugs:
## Steps to Reproduce
## Expected Behavior
## Actual Behavior
## Environment
## Severity
## Reproducibility
## Verification Criteria
`.trim();

  try {
    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt,
      options: {
        temperature: 0.3,
        top_p: 0.9,
      },
    });

    const draft = response.response?.trim();

    if (!draft) {
      console.warn("LLM returned an empty revised issue draft.");
      return "";
    }

    return draft;
  } catch (error) {
    console.error(`Revised draft generation failed: ${error.message}`);

    return [
      "## Revised Issue Draft",
      "",
      `Draft generation failed: ${error.message}`,
      "",
      "Please apply the improvement suggestions manually.",
    ].join("\n");
  }
}