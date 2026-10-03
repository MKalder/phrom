/**
 * tools.js – GitHub-Tools mit @octokit/rest.
 *
 * Konfiguration über .env:
 *   GITHUB_TOKEN=your_token
 *   GITHUB_OWNER=your_username_or_org
 *   GITHUB_REPO=your_repo_name
 */

import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;

if (!OWNER || !REPO) {
  throw new Error("GITHUB_OWNER and GITHUB_REPO must be set in .env");
}

/**
 * listIssues() – Holt alle offenen Issues (ohne Pull Requests).
 * Rückgabe: Array von { number, title, labels } (ohne Body).
 */
export async function listIssues() {
  const { data } = await octokit.issues.listForRepo({
    owner: OWNER,
    repo: REPO,
    state: "open",
    filter: "all",
  });

  // Pull Requests herausfiltern (GitHub mischt Issues und PRs)
  const issues = data.filter((item) => !item.pull_request);

  return issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    labels: issue.labels || [],
  }));
}

/**
 * getIssue(number) – Holt ein einzelnes Issue mit vollem Body.
 */
export async function getIssue(number) {
  const { data } = await octokit.issues.get({
    owner: OWNER,
    repo: REPO,
    issue_number: number,
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body || "",
    labels: data.labels || [],
  };
}

/**
 * postComment(issueNumber, body) – Schreibt einen Kommentar unter ein Issue.
 * Wird in Phase 3 benötigt (mit Freigabe-Workflow).
 */
export async function postComment(issueNumber, body) {
  const { data } = await octokit.issues.createComment({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    body,
  });

  return data;
}
