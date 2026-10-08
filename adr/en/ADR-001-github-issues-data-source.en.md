# ADR-001: GitHub Issues as the Data Source for the Backlog

- **Status:** Accepted. Permissions and write access amended on 2026-10-07: analysis is read-only (ADR-003); write access exists only for seeding (ADR-004).
- **Date:** 2026-10-01
- **Decision-maker:** Marius Kalder (Product Owner / Author of Phrom)
- **Scope:** Choice of data source for the demo backlog and Phrom's GitHub integration

## Context

Phrom is intended to analyze selected backlog items and provide improvement suggestions. To do this, Phrom needs a data source that:

- Contains issues with titles, descriptions, labels, and comments.
- Supports read access through a stable API (write access for seeding the demo backlog).
- Is publicly accessible in the demo scenario.
- Allows access to be restricted to a single repository through a fine-grained access token.
- Is familiar to the Product Owner in their day-to-day work.

The options considered were GitHub Issues, Trello, and a self-hosted Kanban board.

## Decision Drivers

- **Portfolio coherence:** Code, demo, and results should be visible to recruiters in one place.
- **Security:** Phrom should access only a demo repository with minimal permissions.
- **Demo value:** A tool working with a real, familiar system is easier for non-technical stakeholders to understand.
- **Technical simplicity:** The REST API should be well documented and work without an OAuth flow.
- **Operations:** No additional infrastructure beyond the machine running Ollama.

## Options Considered

**Option A: GitHub Issues.** A dedicated repository contains the demo issues. Phrom uses the GitHub REST API with a fine-grained personal access token limited to that single repository. For analysis, _Issues: Read-only_ is sufficient.

**Option B: Trello.** A board with cards as backlog items. The Trello API also supports token-based access, but requires an account-wide token and offers less granular permissions. It is also a paid option.

**Option C: Self-hosted Kanban (Wekan, a "Trello clone").** Full control over the data on a dedicated VPS, but with additional maintenance effort and resource consumption alongside Ollama.

## Decision

I choose **Option A: GitHub Issues**.

Rationale:

- **Security:** A fine-grained personal access token can be restricted to exactly one repository. Even if the token is compromised, the impact is limited to this repository, and a read-only analysis token cannot change anything. With Trello, a token applies to the entire account.
- **Portfolio coherence:** The code, demo issues, and subsequent case study are hosted under the same GitHub profile. Interested parties can see the code and its impact in one place.
- **API maturity:** The GitHub REST API is extensively documented, provides endpoints for issues, comments, and labels, and allows 5,000 authenticated requests per hour—more than enough for the MVP.
- **No additional infrastructure:** Unlike self-hosted boards, this option does not require another service.
- **Familiarity:** GitHub Issues is a familiar format for technical stakeholders. This lowers the barrier to understanding the demo.

## Consequences

### Positive

- Phrom can read issues without access to other repositories. Writing comments or labels is not part of the MVP (see Open Questions).
- Anyone with a browser can explore the demo in the public repository without additional accounts.
- The REST API is stable and well documented; examples and clients for Node.js are available.

### Negative / Risks

- **External dependency:** Phrom requires access to the GitHub API (and a valid token, if one is used). A GitHub outage or an expired token blocks the demo.
- **Reliance on free text:** GitHub Issues does not have structured fields for "User Story" or "Acceptance Criteria." Phrom must parse content flexibly and rely on conventions.
- **No board integration:** GitHub Projects (the board) is not used in the MVP. When this ADR was first written, Projects was available only through GraphQL; GitHub added a REST API for Projects in September 2025. Phrom works exclusively with issues; the board is an optional view.

## Validation

The decision is considered validated when:

- Phrom can read all open issues of the demo repository with a fine-grained, read-only token.
- GitHub API rate limits are never reached during MVP operation.
- An external viewer can understand the demo without additional setup.

## Open Questions

- Whether a GitHub Project will later be made public as a board remains open and does not change the choice of data source.
- Writing comments or labels back to GitHub would change the guardrails of ADR-003 and requires a separate ADR.
- Whether a local JSON file will also be maintained as seed data for reproducible demos is an implementation decision and does not contradict this decision.
