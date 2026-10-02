# Phrom (พร้อม)

**An AI agent to prepare GitHub issues for backlog refinement.**

> Project status: Concept / planned MVP. The workflows described below are target behavior, not already implemented features.

## Table of Contents

- [Problem and Goal](#problem-and-goal)
- [Product Vision](#product-vision)
- [What This Project Demonstrates](#what-this-project-demonstrates)
- [Target Audience](#target-audience)
- [Planned MVP](#planned-mvp)
- [Planned Architecture](#planned-architecture)
- [Rule Set and Safety Boundaries](#rule-set-and-safety-boundaries)
- [Fault Tolerance and Review](#fault-tolerance-and-review)
- [Planned Success Criteria](#planned-success-criteria)
- [Open Questions](#open-questions)

## Problem and Goal

Unclear stories, missing or non-testable acceptance criteria, and possible duplicates consume time in refinement. Phrom is designed to analyze selected issues in advance and provide evidenced improvement proposals. **"Ready for discussion in refinement" is not the same as "ready for sprint planning".** Whether an item is sufficiently understood, sensibly sliced, and feasible is a joint decision by the product owner and the team.

The background: The biggest wastes in refinement fall into four groups: poorly prepared items, the wrong level of detail at the wrong time, an overloaded backlog, and a poorly run session. Important for Phrom: only the first group is intended to be addressed by the agent.

## Product Vision

Backlog refinement should spend time on what only a team can do: build shared understanding, estimate, and decide on the technical approach. Today, part of that time is lost to work that could be done beforehand: unclear wording, missing acceptance criteria, oversized items, and duplicate entries.

**Phrom** (พร้อม, Thai for "ready") is an AI agent that takes this preparatory work off product owners' plates. It checks selected GitHub issues against a transparent rule set and delivers evidenced improvement proposals. The product owner keeps every decision: nothing is changed in GitHub without their explicit approval.

The vision behind the project is an agent that automates craft but does not replace judgment. Phrom does not prioritize, does not estimate, and does not assess technical feasibility. It ensures that items enter refinement in a better state, so the team starts where the discussion that truly needs team time begins.

Phrom is also a demonstration project: it shows how to build an agent with clear tools, a traceable loop, durably stored results, and human approval—without a framework and without cloud dependency for model execution.

## What This Project Demonstrates

Phrom shows how a product owner translates a real process problem—avoidable preparatory work in backlog refinement—into a controllable AI agent. The project demonstrates:

- **Product work:** from problem analysis through target audience, scope and MVP to measurable success criteria.
- **Agent architecture:** an agent loop with limited tools, stored intermediate results, and resumption after failures.
- **Human control:** the model proposes; every change to an issue requires explicit approval by the product owner.
- **Reasoned decisions:** architectural decisions are documented as ADRs; model quality is measured against a test set.

Phrom does not show that AI replaces product owners. Prioritization, estimation, and feasibility remain with the team. Outsourcing the team's thinking process is not desirable.

## Target Audience

### Primary: Product Owners

Phrom is aimed at product owners who:

- maintain (or could maintain) a backlog in GitHub issues,
- have to sharpen many items before each refinement without a dedicated tooling budget,
- value data control and do not want to hand backlog content to a cloud service,
- want to review and approve proposals rather than receive automatic changes.

Typical context: a Scrum team, a backlog with a few dozen open items, and a refinement that regularly starts with wording questions instead of substantive questions and decisions.

### Secondary: Domain and Technical Observers

As a public demonstration project, Phrom also appeals to:

- **Tech leads and engineering managers** who want to assess how an agent with tool access, error handling, and an approval step can be built,
- **Recruiters and hiring managers** who want to understand product and architecture competence through an end-to-end example, from vision through decisions to implementation.

### Not the Target Audience

Phrom is not intended for:

- teams that want to automate prioritization, estimation, or sprint planning,
- organizations with a large backlog of hundreds of items across multiple teams,
- users who want changes without human review.

### Usage Assumptions

These assumptions apply to the MVP and will be validated in the project:

- The backlog lives in GitHub issues, not in another tool.
- Items carry exactly one type label (Epic, Story, Task, or Bug).
- The team accepts a shared rule set for pre-checks.
- A locally run model is qualitatively sufficient for the task. This is a hypothesis, not a result, and will be measured with a test set.

## Planned MVP

- A PO starts a check for specific issue numbers or for all supported issues in the demo repository that are not yet marked as `refinement-ready`.
- Phrom reads the selected issues via the GitHub API, determines their type based on exactly one `type:*` label, and checks them against a versioned, project-specific rule set. If a type is missing or ambiguous, the item is not processed silently but flagged with a diagnosis.
- The focus is on user stories: clarity of role, goal, and benefit; presence of observable, testable acceptance criteria; unclear wording; possible oversizing and content overlaps. For epics, goal and possible slicing are assessed as a basis for discussion. Tasks and bugs are not assessed for content in the first MVP, but transparently marked as out of scope.
- A Node.js orchestrator processes items one by one and persistently stores snapshot, findings, proposal, and status in PostgreSQL **after each item**. Results are shown to the PO for review in aggregate when all selected items are completed or have a declared error state.
- The PO can accept a proposal, reject it, or request a re-check with a hint. The application may only change GitHub after explicit acceptance; the model receives no tool to overwrite issues on its own.

A run is considered complete even if individual items have failed after limited retries: the PO sees a complete overview of successful, skipped, and failed items, not the appearance of a fully successful check.

## Planned Architecture

```text
PO → Node.js CLI / Orchestrator → GitHub REST API → Issues in phrom-backlog-demo
                   │
                   ├─ Ollama on local VPS (CPU-only, model to be selected)
                   ├─ versioned rule set + deterministic checks
                   └─ PostgreSQL: runs, issue snapshots, findings, proposals,
                                  error states and PO decisions

PO review → explicit approval → Node.js application → update GitHub issue
```

- `phrom` will eventually contain agent code, rules, tests, and architectural decisions.
- `phrom-backlog-demo` contains real GitHub issues as a demo backlog; a public GitHub Project can display them as a board. Project drafts are **not** repository issues accessible via the planned issues REST integration.
- GitHub is the source of truth for backlog content; PostgreSQL holds check and review state. There is no second, manually maintained copy of the backlog.
- The agent loop selects read/check steps within defined bounds, observes tool results, and generates a proposal. The question of whether model tool calling or more deterministic orchestration is more reliable for the first cut will be tested in the prototype.

## Rule Set and Safety Boundaries

The concrete rule set will be defined **before** implementation, with examples and expected findings. Formal criteria can be checked in code; semantic questions are supplied by the model as a reasoned assessment, not as fact. A supposedly "too large" item cannot be reliably fixed to sprint size from text alone.

Phrom does not prioritize by business value, does not estimate for the team, does not confirm technical feasibility, and does not declare an item sprint-ready on its own. In particular, a mere `refinement-ready` label must not be an automatic consequence of a model answer: assigning it is a separate PO decision yet to be defined.

For GitHub, a fine-grained personal access token with access only to the demo repository is intended. Secrets remain outside the repository. Analysis and GitHub write access are separated. Before acceptance, the stored issue snapshot is checked against the current issue state so that intervening changes are not overwritten. Repeated calls must not create duplicate changes.

## Fault Tolerance and Review

Each started run records the selected issue numbers and, per item, a state such as `pending`, `running`, `done`, `skipped`, or `failed`. After a crash, the application should not recompute finished items and should deliberately resume hanging items. Errors and retries are limited and logged. The exact state machine and transaction boundaries are still to be specified.

In the review, the PO sees per item: original content, finding with evidence, proposed change, and uncertainties. "Re-check" creates a traceable new attempt and does not silently replace the previous decision.

## Planned Success Criteria

- Findings match a previously defined demo test set; false alarms on good control issues remain visible.
- No data loss when a run aborts late; resumption processes only open items.
- No GitHub change without explicit PO approval.
- Duration per item and per run, error rate, and acceptance/rejection rate are measurable.

## Open Questions

Model and thinking mode, concrete check criteria per type, CLI review design, database schema, retry strategy, handling of multiple labels, and the scope of the epic check will be decided only after a small test set. This README describes the target picture; a quick start will follow once the implementation is actually executable.
