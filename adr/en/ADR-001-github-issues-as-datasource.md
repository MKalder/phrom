# ADR-001: GitHub Issues as the Backlog Data Source

- Status: Proposed
- Date: 2026-10-01
- Decision Maker: Marius Kalder (Product Owner / Author of Phrom)
- Applies to: Data source selection for the demo backlog and agent integration

## Context

Phrom is intended to analyze selected backlog items and provide improvement suggestions. For this, the agent needs a data source that:

- contains issues with titles, descriptions, labels, and comments,
- can be read from and written to via a stable API,
- is publicly accessible in the demo scenario,
- can be restricted to a single repository using a fine-grained access token,
- and is familiar to Product Owners in their daily work.

The options considered were GitHub Issues, Trello, and a self-hosted Kanban board.

## Decision Drivers

- Portfolio coherence: Code, demo, and results should be visible in one place for recruiters.
- Security: The agent should have minimal permissions and only access a single demo repository.
- Demo value: An agent working with a real, familiar tool is easier for non-technical stakeholders to understand.
- Technical simplicity: The REST API should be well documented and usable without an OAuth flow.
- Operations: No additional infrastructure besides Ollama on the VPS.

## Considered Options

**Option A: GitHub Issues.** A dedicated repository contains the demo issues. The agent uses the GitHub REST API with a fine-grained Personal Access Token restricted to read and write access for Issues in this single repository.

**Option B: Trello.** A board contains cards representing backlog items. The Trello API also supports token-based access, but requires an account-wide token and provides less granular permission management. It also involves additional costs.

**Option C:** Self-hosted Kanban (Wekan, a “Trello clone”). Full data control on the own VPS, but additional maintenance effort and resource consumption alongside Ollama.

## Decision

I choose Option A: **GitHub Issues.**

Rationale:

- Security: A fine-grained Personal Access Token can be restricted to exactly one repository. Even if the token is compromised or the agent makes a mistake, the potential impact is limited to this demo repository. With Trello, the token applies to the entire account.
- Portfolio coherence: The agent code, demo issues, and later the case study will be located within the same GitHub profile. A potential client or recruiter can see the code and its impact in one place.
- API maturity: The GitHub REST API is comprehensively documented, provides endpoints for issues, comments, and labels, and allows authenticated requests with a rate limit of 5,000 requests per hour — more than sufficient for the MVP.
- No additional infrastructure: Unlike a self-hosted board, this does not introduce another service on the VPS.
- Familiarity: GitHub Issues are a familiar format for technical stakeholders, lowering the barrier to understanding the demo.

## Consequences

**Positive**

- The agent can read issues, post comments (Phase 2), and set labels without accessing other repositories.
- The demo can be understood by anyone with a browser (public repository), without requiring additional accounts.
- The REST API is stable and well documented; examples and clients for Node.js are available.

**Negative / Risks**

- External dependency: The agent requires access to the GitHub API and valid credentials. A GitHub outage or expired token will block the demo.
- Free-text nature: GitHub Issues do not provide structured fields for “User Story” or “Acceptance Criteria”. The agent must parse content flexibly and rely on conventions.
- No native Kanban: GitHub Projects (the board) does not have a REST API, only GraphQL. For the MVP, we will work exclusively with Issues; the board is an optional view.

## Validation

The decision will be considered validated when:

- the agent can successfully read issues and post comments using the fine-grained token,
- the GitHub API rate limits are never reached during MVP operation,
- the demo can be understood by an external viewer without any additional setup.

## Open Questions

- Whether a GitHub Project will later be used as a publicly accessible board remains open and does not affect the data source decision.
- Whether a local JSON file will additionally be maintained as a seed for reproducible demos is an implementation detail and does not conflict with this decision.
