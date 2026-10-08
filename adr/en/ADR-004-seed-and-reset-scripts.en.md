# ADR-004: Seed and Reset Scripts for the Demo Backlog

- **Status:** Accepted (amended 2026-10-07: seed runs through the GitHub CLI without the analysis token; issue-number limitation)
- **Date:** 2026-10-07
- **Decision-maker:** Marius Kalder (Product Owner / Author of Phrom)
- **Scope:** Reproducibly populating and resetting the demo backlog (`phrom-backlog-demo`)

## Context

The demo backlog in `phrom-backlog-demo` is used to demonstrate and test Phrom without write access to production repositories. Issues must therefore be created reproducibly and reset when necessary. This raises the following questions:

- How are demo issues created: manually, through a script, or through the GitHub CLI?
- How is the backlog reset: by deleting and recreating issues, or by recreating the entire repository?
- Where should seed data reside: in the code repository or the demo repository?
- Which permissions do seeding and reset require?

ADR-002 separates the code and demo backlog into two repositories. This ADR describes how the demo repository is populated and reset.

## Decision Drivers

- **Reproducibility:** Every run should start with the same issues to support model comparisons and tests.
- **Security:** Seed and reset are write operations. They must not be combined with the analysis token.
- **Simplicity:** No additional build step, database, or external infrastructure.
- **Versioning:** Seed data should be versioned in the code repository so changes remain traceable.
- **Protection against data loss:** Reset is destructive. It requires explicit confirmation (`--confirm`) to prevent accidental deletion.
- **Issue numbering:** GitHub does not allow the issue counter to be reset. This is a known limitation that must be documented.

## Options Considered

**Option A: Manual creation through the GitHub UI.** Advantages: no code and no dependencies. Disadvantages: not reproducible, error-prone, time-consuming for 12 or more issues, and no reset capability.

**Option B: One script that deletes and recreates issues.** Advantages: one command and simple operation. Disadvantages: seed and reset are combined, the token requires both write and delete permissions, and accidental execution deletes the backlog.

**Option C: Two separate scripts (seed and reset).** Seed creates issues with write permissions. Reset deletes all issues through the GraphQL API with admin permissions. Advantages: separation of permissions, explicit reset confirmation, and seed data versioned in the code repository. Disadvantages: two scripts to maintain, and issue numbering continues after a reset.

**Option D: Delete and recreate the repository.** Advantages: the issue counter starts at 1 and the state is clean. Disadvantages: the repository ID changes, links break, the demo URL must be updated, and the GitHub CLI or API is required to recreate it.

## Decision

I choose **Option C: Two separate scripts (seed and reset).**

- **Seed:** `seed/seed.js` for issues and `seed/labels.js` for labels. Both call the GitHub CLI (`gh issue create`, `gh label create`) with write permissions (`Issues: Read & Write`). They remove `GITHUB_TOKEN` and `GH_TOKEN` from the CLI's environment and use either the `gh auth login` account or `SEED_GITHUB_TOKEN`, so the read-only analysis token is never used for writes. Seed data is stored as JSON in the code repository; titles must be unique, because existing issues are detected by title and skipped.
- **Reset:** `reset_backlog/reset-demo-backlog.js`. Uses the GitHub GraphQL API with the `deleteIssue` mutation because the REST API does not support deleting issues. Requires admin permissions for the demo repository. Runs only with an explicit `--confirm` flag.

Rationale:

- **Separation of permissions:** Seed requires only issue write permission, while reset requires admin permission to delete. Separate scripts allow separate credentials, and neither uses the analysis token.
- **Safety:** Reset is destructive. The `--confirm` flag and the safety check that permits only `phrom-backlog-demo` prevent accidental deletion.
- **Reproducibility:** Seed data is versioned in the code repository. Every run starts with the same issue content.
- **Documented limitation:** Issue numbering continues after a reset. This is known and documented. Currently, reports and CLI commands use GitHub issue numbers, and the seed data carries a `seedId` (position in the test set) that is not a GitHub number. The offline evaluation (`scripts/eval-seed.js`) works on the seed file and is therefore independent of GitHub numbering.

## Consequences

### Positive

- Seed and reset can run independently.
- Seed data is versioned and traceable in the code repository.
- Reset is protected by the `--confirm` flag and repository-name validation.
- The analysis token requires read-only access; seed and reset use separate credentials.

### Negative / Risks

- **Issue numbering:** After a reset, new issues do not start at 1 but at the next counter value. This can complicate tests and documentation.
- **Two scripts:** Seed and reset must be maintained and documented separately.
- **GraphQL dependency:** Reset depends on the GraphQL API. If GitHub changes it, the script must be updated.
- **Admin permissions for reset:** The reset token requires admin access to the demo repository. This carries a higher risk level than write-only permissions.

## Validation

The decision is considered validated when:

- `npm run seed` reliably populates the demo repository with all defined issues (titles in `issues.json` are unique; duplicate titles in the seed file abort the run, and issues whose title already exists in the repository are skipped),
- `npm run reset:demo:confirm` deletes all issues and restores the repository to its initial content state,
- seed data is versioned in the code repository and changes are traceable,
- the documentation clearly states the issue-numbering limitation.

## Open Questions

- **Issue numbering:** Whether moving to stable identifiers, for example a `seed-id` label, is worthwhile for tests and reports remains open.
- **Automation:** Whether seed and reset should be integrated into CI/CD, for example through a nightly reset, is a later decision.
- **Soft reset:** An option to close issues rather than delete them would be safer, but would not reset the counter and would leave the backlog cluttered.
- **GitHub write-back:** If Phrom is later allowed to write comments, the seed script may also need to store metadata such as `seed-run-id` in issues. This would be a separate decision.
