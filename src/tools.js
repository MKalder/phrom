/**
 * tools.js – GitHub-Tools für den Phrom-Agenten.
 *
 * Tools, die der Agent nutzt, um Issues zu lesen.
 * Kein Schreiben an dieser Stelle – nur Lesen.
 */

import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  baseUrl: "https://api.github.com",
});

const DEMO_REPO = process.env.DEMO_REPO; // "owner/repo"

/**
 * listIssues() – Holt alle offenen Issues mit dem Label `demo-seed`.
 * @returns {Promise<Array>} Array von Issues (nummer, title, labels, body)
 */
export async function listIssues() {
  const [owner, repo] = DEMO_REPO.split("/");

  const response = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: "open",
    labels: "demo-seed",
    per_page: 100,
  });

  return response.data.map((issue) => ({
    number: issue.number,
    title: issue.title,
    labels: issue.labels.map((l) => l.name),
    body: issue.body || "",
    html_url: issue.html_url,
  }));
}

/**
 * getIssue() – Holt ein einzelnes Issue nach Nummer.
 * @param {number} issueNumber – Die Issue-Nummer im Demo-Repo.
 * @returns {Promise<Object>} Issue-Objekt mit number, title, labels, body.
 */
export async function getIssue(issueNumber) {
  const [owner, repo] = DEMO_REPO.split("/");

  const response = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return {
    number: response.data.number,
    title: response.data.title,
    labels: response.data.labels.map((l) => l.name),
    body: response.data.body || "",
    html_url: response.data.html_url,
  };
}
