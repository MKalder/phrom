# Phrom Analyzer

The Phrom Analyzer evaluates GitHub Issues before they are discussed in Backlog Refinement. It combines deterministic rule-based checks with AI-assisted analysis to identify quality gaps, assess whether an issue is ready for refinement, and — when requested — generate concrete improvement suggestions.

The goal is not to replace Backlog Refinement. Instead, the analyzer helps ensure that refinement time is spent where it creates value: understanding the problem, challenging requirements, discussing potential solution approaches, identifying risks and dependencies, and estimating the work.

A well-prepared issue should provide enough context for the team to start that discussion without first having to reconstruct the basic requirements.

## How the Analyzer Works

The analyzer uses three complementary mechanisms:

- **Deterministic Checks** validate objective, rule-based criteria such as issue structure, story format, required fields, or Epic links.
- **AI Checks** evaluate aspects that require contextual understanding, such as acceptance-criteria testability, ambiguity, or potential size risks.
- **The Ready Gate** ensures that certain mandatory criteria are met before an issue can be considered ready, regardless of its overall score.

The resulting score provides an overall indication of issue quality, while the Ready Gate prevents critical deficiencies from being hidden by a high score.

The following sections provide an overview of the available commands, the underlying components, their outputs, and the meaning of the individual checks.

# Command Overview

| Command          | Deterministic Checks | AI Checks | Ready Gate | Score        | Improvements (LLM) | Use Case                                   |
| ---------------- | -------------------- | --------- | ---------- | ------------ | ------------------ | ------------------------------------------ |
| `run`            | ✅                   | ✅        | ✅         | ✅ 0–100     | ❌                 | Analyze all issues (batch, fast)           |
| `improve <n...>` | ✅                   | ✅        | ✅         | ✅ 0–100     | ✅                 | Improve selected issues (one or many)      |
| `select <n...>`  | ✅                   | ✅        | ✅         | ✅ 0–100     | ❌                 | Analyze selected issues (one or many)      |
| `filter <type>`  | ✅                   | ✅        | ✅         | ✅ 0–100     | ❌                 | Analyze issues by type                     |
| `status`         | ✅                   | ❌        | ❌         | ⚠️ 0–50 only | ❌                 | Quick overview (deterministic checks only) |
| `list`           | ❌                   | ❌        | ❌         | ❌           | ❌                 | List issues only                           |

# Components and Files

| Component                      | File(s)                                                | Used By                                        |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------------- |
| GitHub access (load issues)    | `tools.js`                                             | All commands                                   |
| Deterministic checks           | `checks.js`, called via `agent.js`                     | `run`, `improve`, `select`, `filter`, `status` |
| AI checks                      | `model.js` (Ollama)                                    | `run`, `improve`, `select`, `filter`           |
| Ready Gate (required criteria) | `criteria-loader.js` + `*-check-criteria.json`         | `run`, `improve`, `select`, `filter`           |
| Score and status               | `agent.js` (`calculateScore`, `calculateStatus`)       | `run`, `improve`, `select`, `filter`           |
| Improvements                   | `improve.js` → `model-improve.js` + `*-reference.json` | `improve` only                                 |
| Markdown reports               | `report.js`                                            | `run`, `improve`, `select`, `filter`           |

# Command Output Overview

| Command          | Console Output                                                                                                                         | Files in `output/`                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `run`            | Per issue: passed checks, execution time (ms/s), score, status. Ends with a summary showing the number of 🟢/🟡/🔴 issues.             | `reports/issue-N-report-_.md`, `summary-_.md`, `results-*.json`                                            |
| `improve <n...>` | Per issue: score, status, summary, analysis timing. Then `Generating…`, improvement timing, and top improvements. Ends with a summary. | `reports/issue-N-report-_.md`, `improvement-suggestions/issue-N-improvements-_.md`, `summary-improve-*.md` |
| `select <n...>`  | Per issue: score, status, timing. Ends with a summary.                                                                                 | `reports/issue-N-report-_.md`, `summary-select-_.md`                                                       |
| `filter <type>`  | Per issue: score, status, timing. Ends with a summary.                                                                                 | `reports/issue-N-report-_.md`, `summary-filter-<type>-_.md`                                                |
| `status`         | Per issue: deterministic score (`x/50`) and number of passed checks. Ends with a summary.                                              | ❌ None                                                                                                    |
| `list`           | Number, title, labels, execution time                                                                                                  | ❌ None                                                                                                    |

# Glossary

| Term                          | Meaning                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deterministic Checks**      | Rule-based checks implemented in code, such as story format or Epic links. They run within milliseconds.                                                                                |
| **AI Checks**                 | Model-based checks, such as AC testability or size risk. They run within seconds.                                                                                                       |
| **Ready Gate**                | An issue is considered 🟢 ready only if all criteria marked as `required` pass. Otherwise, it is 🔴, even if it has a high score.                                                       |
| **Score 0–100**               | Sum of the points awarded for passed checks. An issue is considered ready at 80 or above and needs work below 80 but at or above 50.                                                    |
| **Det-Score 0–50 (`status`)** | Only the formal/deterministic portion of the score, without AI checks or the Ready Gate. Therefore, these values are not directly comparable with the score produced by `run`.          |
| **Improvements**              | One suggestion is generated for each failed criterion, including before/after examples, along with a revised issue draft. The LLM receives the Reference JSON as an example (one-shot). |
| **`*-check-criteria.json`**   | Defines which criteria exist and which criteria are marked as `required`.                                                                                                               |
| **`*-reference.json`**        | A quality reference example used for generating improvements. It has no influence on the issue evaluation or score.                                                                     |
