# ADR-001: GitHub Issues as the Data Source for the Backlog

- **Status:** Accepted
- **Date:** 2026-10-01
- **Decision-maker:** Marius Kalder (Product Owner / Author of Phrom)
- **Scope:** Choice of data source for the demo backlog and agent integration

## Context

Phrom is intended to analyze selected backlog items and provide improvement suggestions. To do this, the agent needs a data source that:

- Contains issues with titles, descriptions, labels, and comments.
- Supports read and write access through a stable API.
- Is publicly accessible in the demo scenario.
- Allows access to be restricted to a single repository through a fine-grained access token.
- Is familiar to the Product Owner in their day-to-day work.

The options considered were GitHub Issues, Trello, and a self-hosted Kanban board.

## Decision Drivers

- **Portfolio coherence:** Code, demo, and results should be visible to recruiters in one place.
- **Security:** The agent should access only a demo repository with minimal permissions.
- **Demo value:** An agent working with a real, familiar tool is easier for non-technical stakeholders to understand.
- **Technical simplicity:** The REST API should be well documented and work without an OAuth flow.
- **Operations:** No additional infrastructure beyond the VPS running Ollama.

## Options Considered

**Option A: GitHub Issues.** A dedicated repository contains the demo issues. The agent uses the GitHub REST API with a fine-grained personal access token that grants only read and write access to issues in that single repository.

**Option B: Trello.** A board with cards as backlog items. The Trello API also supports token-based access, but requires an account-wide token and offers less granular permissions. It is also a paid option.

**Option C: Self-hosted Kanban (Wekan, a "Trello clone").** Full control over the data on a dedicated VPS, but with additional maintenance effort and resource consumption alongside Ollama.

## Decision

I choose **Option A: GitHub Issues**.

Rationale:

- **Security:** A fine-grained personal access token can be restricted to exactly one repository. Even if the token is compromised or the agent makes mistakes, the impact is limited to this demo repository. With Trello, a token applies to the entire account.
- **Portfolio coherence:** The agent code, demo issues, and subsequent case study are hosted under the same GitHub profile. Interested parties can see the code and its impact in one place.
- **API maturity:** The GitHub REST API is extensively documented, provides endpoints for issues, comments, and labels, and allows 5,000 authenticated requests per hour—more than enough for the MVP.
- **No additional infrastructure:** Unlike self-hosted boards, this option does not require another service on the VPS.
- **Familiarity:** GitHub Issues is a familiar format for technical stakeholders. This lowers the barrier to understanding the demo.

## Consequences

### Positive

- The agent can read issues, post comments (Phase 2), and apply labels without accessing other repositories.
- Anyone with a browser can explore the demo in the public repository without additional accounts.
- The REST API is stable and well documented; examples and clients for Node.js are available.

### Negative / Risks

- **External dependency:** The agent requires access to the GitHub API and valid credentials. A GitHub outage or an expired token blocks the demo.
- **Reliance on free text:** GitHub Issues does not have structured fields for "User Story" or "Acceptance Criteria." The agent must parse content flexibly and rely on conventions.
- **No native Kanban integration:** GitHub Projects (the board) has no REST API, only GraphQL. For the MVP, we work exclusively with issues; the board is an optional view.

## Validation

The decision is considered validated when:

- The agent can successfully read issues and post comments using the fine-grained token.
- GitHub API rate limits are never reached during MVP operation.
- An external viewer can understand the demo without additional setup.

## Open Questions

- Whether a GitHub Project will later be made public as a board remains open and does not change the choice of data source.
- Whether a local JSON file will also be maintained as seed data for reproducible demos is an implementation decision and does not contradict this decision.
