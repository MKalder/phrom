# Phrom Rules

**Version:** 0.3.0 (Draft)
**Date:** 2026-10-06
**Scope:** Pre-refinement assessment of GitHub Issues

This document describes what Phrom checks, how the score is calculated, and when an issue is considered "Ready". It is **not a Definition of Done** and does not decide sprint readiness. The criteria themselves are stored in machine-readable form in `criteria/*.json`, from which point weights and required flags are read.

---

## Table of Contents

- [Overview](#overview)
- [Type Detection](#type-detection)
- [Score and Ready Gate](#score-and-ready-gate)
- [Criteria by Type](#criteria-by-type)
- [Deterministic Check Rules](#deterministic-check-rules)
- [AI Checks](#ai-checks)
- [Quick Status (`phrom status`)](#quick-status-phrom-status)
- [Examples](#examples)
- [Limitations](#limitations)
- [Planned Criteria](#planned-criteria)

---

## Overview

Phrom evaluates each issue on two levels:

1. **Score (0–100):** Proportion of achieved points to achievable points.
2. **Ready Gate:** All criteria marked as **required** must pass.

| Status        | Condition                                               |
| ------------- | ------------------------------------------------------- |
| 🟢 Ready      | Ready Gate passed **and** Score ≥ 80                    |
| 🟡 Needs work | Ready Gate passed **and** Score 50–79                   |
| 🔴 Not ready  | Ready Gate not passed **or** Score < 50                 |

**The Ready Gate overrides the score.** If a required criterion fails, the issue is 🔴 regardless of the point total. The score shows progress; the gate decides.

There are two types of criteria:

- **Deterministic (`code`):** Rule-based checks implemented in code, executed in milliseconds, reproducible.
- **AI (`model`):** A local model provides a reasoned assessment. This is an assessment, not a fact.

"Ready for refinement" is not the same as "ready for sprint planning". Phrom does not prioritize, does not estimate, and does not confirm technical feasibility.

---

## Type Detection

The type determines which criteria apply.

1. **Label:** `type:epic`, `type:story`, `type:task`, or `type:bug`.
2. **Fallback when label is missing:** The model assigns the issue to exactly one of the four types (with confidence `high`, `medium`, or `low` and a reason). This fallback is used in `run`, `select`, and `improve`.
3. `phrom filter <type>` considers only issues with a label. `phrom status` applies the story checks when no label is present.

---

## Score and Ready Gate

**Score** = `round(achieved points ÷ achievable points × 100)`

- A criterion awards its points either fully or not at all.
- Only criteria that are implemented (`implemented` is not `false`) and carry points are achievable.
- The sum of points per type is stored in `scoring.totalPoints` in the respective JSON file. Story and Task sum to 100, Epic to 90, and Bug to 105; the score is therefore normalized to 100.

**Ready Gate:** For each required criterion, a result must exist **and** be passing. If a result is missing (e.g., because Ollama was unreachable), the criterion is considered not passed. The issue is then marked as 🔴.

```javascript
function calculateStatus(score, gateFailed) {
  if (gateFailed) return { status: "not-ready", emoji: "🔴" };
  if (score >= 80) return { status: "ready", emoji: "🟢" };
  if (score >= 50) return { status: "needs-work", emoji: "🟡" };
  return { status: "not-ready", emoji: "🔴" };
}
```

**Why different point totals?** Each type has its own criteria with its own weights. The sum is in `scoring.totalPoints`: Story and Task 100, Epic 90, Bug 105. Because the score is normalized to 100, values are comparable across types.

**When is 🟡 achievable?** An issue with a passed gate has at least the required portion as its score. 🟡 (Score 50–79) is therefore only possible when the required criteria make up less than 80 % of the points:

| Type  | Required Points | Total Points | Required Share | 🟡 possible |
| ----- | --------------: | -----------: | -------------: | :---------: |
| Story |              47 |          100 |           47 % |     ✅      |
| Task  |              90 |          100 |           90 % |      –      |
| Epic  |              90 |           90 |          100 % |      –      |
| Bug   |              85 |          105 |           81 % |      –      |

For Task, Epic, and Bug, the status in the current configuration is effectively 🟢 or 🔴. This is a consequence of the weighting, not a separate rule. If points or required flags change in `criteria/*.json`, whether 🟡 is achievable also changes.

---

## Criteria by Type

Points, type, and requirement per criterion. ✅ = required (Ready Gate), "–" = optional (counts only in the score).

### Story (100 points)

| Criterion        | Type | Points | Required |
| ---------------- | ---- | -----: | :------: |
| `story-format`   | Rule |     10 |    ✅    |
| `story-context`  | Rule |     10 |    ✅    |
| `epic-link`      | Rule |     10 |     –    |
| `ac-presence`    | Rule |     10 |    ✅    |
| `story-links`    | Rule |     10 |     –    |
| `ac-testability` | AI   |     17 |    ✅    |
| `size-risk`      | AI   |     17 |     –    |
| `business-value` | AI   |     16 |     –    |

Stories can exist without an epic (bug fixes, spikes, small features). The epic link is therefore a recommendation for traceability, not a requirement. `size-risk` is a risk signal, not an estimate and not a team commitment.

### Task (100 points)

| Criterion               | Type | Points | Required |
| ----------------------- | ---- | -----: | :------: |
| `technical-scope`       | Rule |     15 |    ✅    |
| `justification`         | Rule |     10 |    ✅    |
| `impact-analysis`       | Rule |     10 |    ✅    |
| `rollback-plan`         | Rule |     10 |    ✅    |
| `ac-presence`           | Rule |      5 |     –    |
| `ac-testability`        | AI   |     20 |    ✅    |
| `size-risk`             | AI   |     15 |    ✅    |
| `technical-feasibility` | AI   |     10 |    ✅    |
| `rollback-risk`         | AI   |      5 |     –    |

### Bug (105 points, normalized to 100)

| Criterion            | Type | Points | Required |
| -------------------- | ---- | -----: | :------: |
| `reproduction-steps` | Rule |     15 |    ✅    |
| `expected-vs-actual` | Rule |     15 |    ✅    |
| `environment-info`   | Rule |     10 |    ✅    |
| `ac-presence`        | Rule |     10 |     –    |
| `ac-testability`     | AI   |     20 |    ✅    |
| `size-risk`          | AI   |     15 |    ✅    |
| `severity`           | AI   |     10 |    ✅    |
| `reproducibility`    | AI   |     10 |     –    |

### Epic (90 points, normalized to 100)

| Criterion           | Type | Points | Required |
| ------------------- | ---- | -----: | :------: |
| `goal-statement`    | Rule |     15 |    ✅    |
| `benefit-statement` | Rule |     15 |    ✅    |
| `story-list`        | Rule |     10 |    ✅    |
| `ac-testability`    | AI   |     17 |    ✅    |
| `size-risk`         | AI   |     17 |    ✅    |
| `epic-goal`         | AI   |      8 |    ✅    |
| `epic-benefit`      | AI   |      8 |    ✅    |

---

## Deterministic Check Rules

All deterministic checks operate on the issue body (case-insensitive). An empty body causes every deterministic check to fail.

### Story

**`story-format`** passes if the text follows a known pattern or contains all three components:

- German: "Als … möchte ich … damit …", "… um … zu …", "… will ich … damit …"
- English: "As a … I want … so that …", "… in order to …", "As a … I need … so that …", "… I should be able to … so that …"
- Fallback: role ("als" / "as a"), want (möchte, will, want, need, should be able to), and benefit (damit, um … zu, so that, in order to) appear somewhere in the text, even without the standard formulation.

**`story-context`** passes if at least one keyword from the lists Product (e.g., product, feature, system, portal, app, platform, service), Target Group (e.g., user, customer, client, admin, kunde, benutzer), or Business (e.g., value, benefit, goal, need, problem) appears, or one of the context patterns ("as a user", "for the customer", "in the app", …). The search works with substrings (see [Limitations](#limitations)).

**`epic-link`** passes if an issue reference (`#12` or `owner/repo#12`) is present and

- exactly one reference exists (considered the likely parent epic), or
- multiple references exist and an epic context word appears (epic, parent, part of, belongs to, under, related to, tracking, initiative).

Whether the referenced epic exists in GitHub is not verified.

**`ac-presence`** counts acceptance criteria in three ways and takes the maximum: checklist items (`- [ ] …`), Gherkin scenarios (lines with Given/When/Then/And/But, three lines ≙ one scenario), and occurrences of "must", "should", "verify that", "it is required that". Passes with **at least two**. If a happy path (successfully, happy path, normal case, standard flow) or an error case (error, fail, invalid, exception, edge case, boundary) is missing, a hint appears, but the criterion still passes.

**`story-links`** passes with any non-empty body. Recognized patterns (depends on, blocked by, requires, blocks, related to, see also, duplicate of) are output as a hint. There is no deduction for missing links; the 10 points are therefore effectively always awarded.

<!-- DECISION D6: story-links currently always awards points. Alternatives: remove the criterion from the score (Story sum 90, normalized) or award points only when links are actually present. -->

### Task

**`technical-scope`** passes if a section "What / Scope / Technical Scope" or a list with action verbs is present and at least **two** list lines (`-` or `*`) contain an action verb (upgrade, migrate, implement, create, update, configure, refactor, deploy, setup, install, remove, add).

**`justification`** passes if a justification section (Why, Reason, Justification, Background, Motivation) or a keyword appears **and** a concrete trigger is named: EOL/year/quarter (eol, end-of-life, `Q1`–`Q4`, `202x`), security, performance, or compliance. "debt" or "deprecated" alone are not sufficient.

**`impact-analysis`** passes if an impact section (Impact, Affected, Downtime, Risks) or a keyword appears **and** at least **two of three** elements are named: affected systems (affected systems, databases, services), downtime (downtime, window, maintenance), risks (risk, risks).

**`rollback-plan`** passes if a "Rollback" section exists **and** at least **two of four** details are named: procedure (procedure, steps, restore, backup), test (tested, test), time estimate (e.g., "15 minutes", "within 30"), and location (runbook, documented in, location).

**`ac-presence`:** as for Story.

### Bug

**`reproduction-steps`** passes if a reproduction section, a numbered list, or "Step n" appears and at least **two** numbered steps or "Step" markers are present.

**`expected-vs-actual`** passes if "expected" appears and additionally "actual", "instead", or "but got".

**`environment-info`** passes if an environment section or a keyword (browser, os, version, device, platform, ios, android, windows, mac, safari, chrome, firefox) appears and at least **two** details are recognized (Browser, OS, Version, Device/Platform).

**`ac-presence`:** as for Story.

### Epic

**`goal-statement`** passes if a goal section (Goal, Objective, Aim, Purpose) or "goal is to" / "objective is to" appears and at least **two of three** SMART hints are recognized: specific (specific, clear, defined), measurable (percentage, reduce, increase, within, "by Q", deadline), time-bound ("by 2026", Q specification, deadline, target date).

**`benefit-statement`** passes if a benefit section (Benefit, Value, Impact, Outcome) or "benefit is/will be" appears and the benefit is quantified (number with unit such as %, minutes, hours, tickets, € or the words reduce, increase, save).

**`story-list`** passes if at least **one** issue reference (`#n`) appears in the body.

---

## AI Checks

AI checks run locally via Ollama (default model `qwen3:30b-instruct`, changeable via `MODEL_NAME`).

**Technical details:**

- Response as JSON according to a fixed schema (Structured Output), no free-text parsing.
- `temperature: 0`, `top_k: 1`, `seed: 42` for as consistent results as possible on the same setup. There is no bit-exact guarantee across hardware or model versions.
- Up to two retries on errors (wait time 2 s and 4 s).
- Each check provides a short reason in the language of the issue.
- If Ollama is unavailable, AI results are missing. Required criteria are then considered not passed (fail-closed).

| Criterion               | Types | Passes when …                                                                                                                                                |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ac-testability`        | all   | all acceptance criteria are clear, measurable, unambiguous, and verifiable. Vague formulations ("works well", "user-friendly") and missing criteria fail     |
| `size-risk`             | all   | the estimated size is **S** or **M** (S: < 1 day, low risk; M: 1–3 days, open questions; L: 3–10 days; XL: > 10 days). L and XL fail                         |
| `business-value`        | Story | user or role, concrete need, and understandable benefit are recognizable. "Improve X" without benefit fails                                                  |
| `epic-goal`             | Epic  | the goal describes an outcome for business or users and not just a topic                                                                                     |
| `epic-benefit`          | Epic  | the benefit is comprehensible: who gains what, ideally measurable                                                                                            |
| `technical-feasibility` | Task  | the technical approach is feasible and understood; significant technical uncertainty fails                                                                   |
| `rollback-risk`         | Task  | the rollback is appropriate for the production impact; an untested rollback fails                                                                            |
| `severity`              | Bug   | the severity (Critical, Major, Minor) is clearly justified                                                                                                   |
| `reproducibility`       | Bug   | the reproducibility (Always, Sometimes, Rarely) is clearly stated                                                                                            |

AI results are marked as `(ai)` in reports and drafts, deterministic ones as `(deterministic)`.

---

## Quick Status (`phrom status`)

`phrom status` runs **only the deterministic checks**. It knows neither AI criteria nor point weights nor the Ready Gate.

- Value = `round(passed checks ÷ number of checks × 50)`
- 🟢 from 40, 🟡 from 25, otherwise 🔴 (each out of 50)

🟢 here means "at least around 80 % of the formal checks passed", **not** "ready for refinement". An issue can be 🟢 in quick status and 🔴 in the full analysis, for example because its acceptance criteria are not testable. Binding is only the analysis with AI (`run`, `select`, `filter`, `improve`).

---

## Examples

### Issue #3 "Improve login" (Story): 27/100, 🔴 Not ready

| Criterion                       | Result | Points |
| ------------------------------- | :----: | -----: |
| `story-format`                  |   ✖    |      0 |
| `story-context`                 |   ✖    |      0 |
| `epic-link`                     |   ✖    |      0 |
| `ac-presence` (only 1 criterion)|   ✖    |      0 |
| `story-links`                   |   ✔    |     10 |
| `ac-testability`                |   ✖    |      0 |
| `size-risk`                     |   ✔    |     17 |
| `business-value`                |   ✖    |      0 |
| **Total**                       |        | **27** |

The Ready Gate fails on four required criteria.

### Issue #5 "Manage account settings" (Story): 73/100, 🔴 Not ready

Only `epic-link` (rule) and `ac-testability` (AI) fail. The score of 73 is in the 🟡 range, but `ac-testability` is required and the gate fails. This example shows that the Ready Gate overrides the score: the acceptance criteria ("All options", "change is applied") are not testable, so the issue is not ready even though it is largely complete formally.

<!-- NOTE: The value 73 applies after fixing the score calculation (key business-value, see instructions). Until then, Phrom shows 57. -->

---

## Limitations

- **Heuristics:** Deterministic checks recognize keywords and patterns, not meaning. A text can pass without being good, and vice versa.
- **Substring search:** For `story-context`, a hit as a substring is sufficient (e.g., "app" in "happy"). The criterion is therefore generous and does not check that both product and target group are named.
- **Languages:** Formats and keywords are designed for German and English.
- **Epic link:** The existence and backlink of the epic in GitHub are not verified.
- **AI assessments** are reasoned opinions. They can be wrong, and their quality depends on the model. Measurement against a manually assessed test set is planned.
- **No failure status:** If the model fails, the issue is fail-closed as 🔴. A separate "incomplete" status is planned.
- **Summary in the report:** It names the most important gaps but is not a complete list. The criteria list in the report is authoritative.

---

## Planned Criteria

These criteria are described in `criteria/*.json` with `implemented: false` but are not yet implemented. They carry no points and do not affect the Ready Gate.

| Type  | Criteria                                                                                                                                                                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Story | `independence` (overlap with other stories via similarity search)                                                                                                                                                                                         |
| Task  | `task-context`, `task-dependencies`                                                                                                                                                                                                                       |
| Bug   | `bug-impact`                                                                                                                                                                                                                                              |
| Epic  | `epic-context`, `epic-boundary`, `epic-success-measure`, `epic-slicing`, `epic-oversize-risk`, `epic-owner`, `epic-stakeholders`, `epic-company-goal`, `epic-milestones`, `epic-timeline`, `epic-risks`, `epic-dependencies`, `epic-child-story-status` |

Further planned rules from the JSON files:

- **Three-valued result** (`pass`, `flag`, `not-assessable`) instead of `pass / fail`.
- **Evidence requirement** (`requireEvidence`): The AI cites the passage on which its assessment is based.
- **Status `incomplete`** when Ollama is unreachable or AI checks fail; such a run must be repeated.
