/**
 * Phrom Model-Improvement Generator (Phase 2)
 * LLM-powered improvement suggestions AND complete issue draft.
 */

import ollama from 'ollama';

const MODEL_NAME = process.env.MODEL_NAME || 'qwen3:30b-instruct';

/**
 * Generate a complete revised issue draft based on one reference quality example.
 * Returns Markdown.
 *
 * @param {Object} issue - Issue object: title, body, number, type
 * @param {Array} suggestions - Array of improvement suggestions
 * @param {Object} reference - Reference quality example for this type
 * @returns {Promise<string>} Markdown issue draft
 */
export async function generateRevisedIssueDraft(issue, suggestions, reference) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return '';
  }

  const type = issue.type || 'unknown';

  const prompt = `
You are an expert product owner. Create a COMPLETE revised issue draft.

REFERENCE ${type.toUpperCase()} (style and quality guide – DO NOT copy concrete values):
${JSON.stringify(reference, null, 2)}

ORIGINAL ISSUE:
Title: ${issue.title}
Current Description:
${issue.body || '(empty)'}

IMPROVEMENT SUGGESTIONS (incorporate all of these):
${suggestions
      .map(
        (s, i) =>
          `${i + 1}. ${s.check}\n   Problem: ${s.suggestion}\n   Recommended: ${s.after}`
      )
      .join('\n')}

YOUR TASK:
Write a COMPLETE revised issue description that:
1. Follows the STRUCTURE and STYLE of the reference
2. Addresses ALL improvement suggestions above
3. Uses [placeholders] for information that cannot be inferred from the original issue
4. Marks uncertain information as "Open discovery question: [question]"
5. Does NOT copy concrete names, numbers, issue IDs, dates, metrics, systems, or business facts from the reference
6. Is written entirely in English

REQUIRED STRUCTURE (adapt based on type):

For stories:
## Context
- Operator: [your company/product]
- Product: [product name]
- Target Group: [user group]
- Part of Epic: #[number] [epic title]

## Story
As a [role], I want [feature], so that [benefit].

## Acceptance Criteria
**Happy Path**
- [ ] Given [initial context], when [action], then [expected result]

**Error Cases**
- [ ] Given [error context], when [action], then [error message / behavior]

## Dependencies
- Depends on #[number] ([title])
- Blocks #[number] ([title])
- Related to #[number] ([title])

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

OUTPUT:
Provide ONLY the Markdown issue description. No JSON, no explanations, no meta-commentary.
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
      console.warn('LLM returned an empty revised issue draft.');
      return '';
    }

    return draft;
  } catch (error) {
    console.error(`Revised draft generation failed: ${error.message}`);
    return '';
  }
}

/**
 * Generate improvement suggestions using LLM + reference quality example.
 * Returns array of suggestions with check, suggestion, before, after.
 *
 * @param {string} type - Issue type: story | task | bug | epic
 * @param {Object} issue - Issue object: title, body, number, type
 * @param {Array} failedCriteria - Failed criterion IDs
 * @param {Object} reference - Reference quality example for this type
 * @returns {Promise<Array>} Suggestions
 */
export async function generateLLMImprovements(type, issue, failedCriteria, reference) {
  if (!Array.isArray(failedCriteria) || failedCriteria.length === 0) {
    return [];
  }

  const failedCriteriaCount = failedCriteria.length;

  const prompt = `
You are an expert product owner. Generate ${failedCriteriaCount} improvement suggestions.

ISSUE:
Title: ${issue.title}
Body: ${issue.body?.slice(0, 500) || '(empty)'}

FAILED CRITERIA (${failedCriteriaCount}):
${failedCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

REFERENCE ${type.toUpperCase()} (style guide only – do NOT copy values):
${JSON.stringify(reference).slice(0, 1500)}...

TASK:
Return EXACTLY ${failedCriteriaCount} JSON objects (one per failed criterion):
{
  "check": "criterion-id",
  "suggestion": "What to improve",
  "before": "Current text or (not present)",
  "after": "Recommended text with [placeholders]"
}

RULES:
- ONE suggestion per failed criterion
- Use [placeholders] for unknown info
- Do NOT copy reference values
- Output ONLY the JSON array, nothing else

EXAMPLE OUTPUT:
[
  {"check":"goalStatement","suggestion":"Make it SMART","before":"(not present)","after":"Goal: [metric] from [X] to [Y] by [date]"},
  {"check":"benefitStatement","suggestion":"Quantify benefits","before":"(not present)","after":"Benefits: Customers save [X], team saves [Y]"}
]
`.trim();

  try {
    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt,
      format: 'json',
      options: {
        temperature: 0.2,
        top_p: 0.9,
      },
    });

    const rawResponse = response.response?.trim() || '';

    if (!rawResponse) {
      console.warn('LLM returned an empty improvement response.');
      return [];
    }

    let parsed;

    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.warn(`Failed to parse LLM improvement response as JSON: ${parseError.message}`);
      console.warn(`Raw response preview: ${rawResponse.slice(0, 300)}...`);
      return [];
    }

    /*
     * Compatibility layer:
     * Handle various LLM output formats including single objects
     */
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (Array.isArray(parsed.suggestions)) {
        console.warn('LLM returned an object with .suggestions; unwrapping the array.');
        parsed = parsed.suggestions;
      } else if (Array.isArray(parsed.improvements)) {
        console.warn('LLM returned an object with .improvements; unwrapping the array.');
        parsed = parsed.improvements;
      } else if (Array.isArray(parsed.data)) {
        console.warn('LLM returned an object with .data; unwrapping the array.');
        parsed = parsed.data;
      } else if (
        typeof parsed.check === 'string' &&
        typeof parsed.suggestion === 'string' &&
        typeof parsed.after === 'string'
      ) {
        // NEW: Handle single suggestion object by wrapping it in an array
        console.warn('LLM returned a single suggestion object; wrapping in array.');
        parsed = [parsed];
      } else {
        console.warn(
          `LLM returned an unsupported JSON object. Keys: ${Object.keys(parsed).join(', ') || '(none)'}`
        );
        console.warn(`Raw response preview: ${rawResponse.slice(0, 300)}...`);
        return [];
      }
    }

    if (!Array.isArray(parsed)) {
      console.warn(`LLM response is not an array after normalization: ${typeof parsed}`);
      console.warn(`Raw response preview: ${rawResponse.slice(0, 300)}...`);
      return [];
    }

    const validChecks = new Set(failedCriteria);

    return parsed
      .filter(
        (suggestion) =>
          suggestion &&
          typeof suggestion === 'object' &&
          typeof suggestion.check === 'string' &&
          typeof suggestion.suggestion === 'string' &&
          typeof suggestion.after === 'string'
      )
      .filter((suggestion) => validChecks.has(suggestion.check))
      .map((suggestion) => ({
        check: suggestion.check.trim(),
        suggestion: suggestion.suggestion.trim(),
        before:
          typeof suggestion.before === 'string' && suggestion.before.trim()
            ? suggestion.before.trim()
            : '(not present)',
        after: suggestion.after.trim(),
      }));
  } catch (error) {
    console.error(`LLM improvement generation failed: ${error.message}`);
    return [];
  }
}