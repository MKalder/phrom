/**
 * tools.js – Read-only GitHub access using @octokit/rest (REST API).
 *
 * Phrom only reads issues. There is deliberately no function that writes to GitHub;
 * a fine-grained token with "Issues: Read-only" is sufficient.
 *
 * Configuration through .env:
 * GITHUB_TOKEN=your_token
 * GITHUB_OWNER=your_username_or_org
 * GITHUB_REPO=your_repo_name
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
 * List open issues, optionally filtered by label.
 *
 * @param {string|null} label Optional GitHub label, e.g. "type:epic"
 * @returns {Promise<Array>}
 */
export async function listIssues(label = null) {
    const params = {
        owner: OWNER,
        repo: REPO,
        state: "open",
        per_page: 100,
    };

    if (label) {
        params.labels = label;
    }

    // paginate() follows all result pages; a single call returns at most 100 items.
    const data = await octokit.paginate(octokit.issues.listForRepo, params);

    return data
        .filter((item) => !item.pull_request)
        .map((issue) => ({
            number: issue.number,
            title: issue.title,
            labels: issue.labels || [],
        }));
}

/**
 * Get one issue with full body.
 *
 * @param {number} number
 * @returns {Promise<Object>}
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
        state: data.state,
        htmlUrl: data.html_url,
    };
}
