# ADR-002: Separate Repositories for Code and the Demo Backlog

- **Status:** Accepted
- **Date:** 2026-10-02
- **Decision-maker:** Marius Kalder (Product Owner / Author of Phrom)
- **Scope:** Separation into `phrom` (code) and `phrom-backlog-demo` (demo data)

## Context

Phrom consists of two parts: the code (Node.js, rules, scripts, and seed data) and the demo backlog (GitHub Issues assessed by Phrom). The question is whether both should reside in a single repository or in two separate repositories.

A single repository would be easier to manage. Two repositories clearly separate code and data, allow different visibility settings, and prevent actual development issues from being mixed with demo data.

## Decision Drivers

- **Clear scope:** For demonstration purposes, Phrom should initially assess only demo issues, not actual development issues.
- **Reusability:** The demo backlog should be resettable at any time without affecting the code.
- **Security:** A separate demo repository allows a token to be restricted to that repository.
- **Portfolio clarity:** Interested parties should be able to explore the code and the demo separately.
- **Measurability:** A fixed set of demo issues enables reproducible model comparisons and tests.

## Options Considered

**Option A: One repository.** Code and issues reside in the same repository. Advantages: less administration and everything in one place. Disadvantages: demo issues and actual development issues are mixed, resetting the backlog is risky, and the token has access to both.

**Option B: Two repositories.** `phrom` contains the code, rules, and seed data. `phrom-backlog-demo` contains only demo issues. Advantages: clear separation, restricted token access, and an isolated reset process. Disadvantages: two repositories to maintain, and Phrom requires repository configuration.

**Option C: One repository with strict label filtering.** All issues reside in the same repository, but Phrom filters by `demo-seed`. Advantages: only one repository. Disadvantages: filtering is error-prone, actual development issues remain within the token's scope, and the repository may become harder to navigate.

## Decision

I choose **Option B: Two repositories**.

Rationale:

- **Security:** The fine-grained token can be restricted to `phrom-backlog-demo`. Only demo data is in the token's scope.
- **Reproducibility:** The demo repository can be reset at any time by deleting issues and running the seed script, without affecting the code.
- **Clear scope:** Phrom assesses only demo issues. Actual development issues in the code repository are outside its scope.
- **Portfolio:** Interested parties can explore the architecture in the code repository and see Phrom's results in the demo repository.

## Consequences

### Positive

- The token has access only to the demo repository.
- Demo issues can be reset without risking the code or actual development issues.
- Phrom has a clear scope: only `phrom-backlog-demo`.

### Negative / Risks

- **Additional administration:** Two repositories mean two READMEs, two issue trackers, and two configurations.
- **Configuration effort:** Phrom needs the demo repository to be specified through environment variables or configuration parameters.
- **Documentation:** The relationship between the repositories must be explained in the README.

## Validation

The decision is considered validated when:

- Phrom works successfully with a token that has read access only to `phrom-backlog-demo`.
- A seed script can populate the backlog automatically.
- A reset script restores the demo repository to its initial state without affecting the code.
- Interested parties can explore the code and the demo separately.

## Open Questions

- Whether a seed script in the code repository creates issues in the demo repository is an implementation decision. The same applies to the reset script.
