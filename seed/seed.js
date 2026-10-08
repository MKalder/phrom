#!/usr/bin/env node
/**
 * seed.js – Creates the demo issues in the backlog repository (write operation).
 *
 * Requirements:
 * - GitHub CLI (`gh`) is installed and logged in (`gh auth login`), or SEED_GITHUB_TOKEN is set
 * - The demo repository exists (e.g. YOUR-USER/phrom-backlog-demo)
 * - issues.json is in the same folder
 *
 * Usage:
 *   npm run seed     (or: node seed/seed.js)
 *
 * Reads issues.json and creates one issue per entry. Issues whose title already exists are skipped,
 * so every title in issues.json must be unique.
 *
 * Permissions: the analysis token (GITHUB_TOKEN) is NOT used – see gh-env.js.
 * seedId is the position in the test set, not the GitHub issue number.
 */


import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';  // loads .env (GITHUB_OWNER, GITHUB_REPO, optional SEED_GITHUB_TOKEN)
import { ghEnv } from './gh-env.js';


// __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

if (!GITHUB_OWNER || !GITHUB_REPO) {
  console.error('❌ Error: please set GITHUB_OWNER and GITHUB_REPO in .env');
  process.exit(1);
}

const env = ghEnv();


const REPO = `${GITHUB_OWNER}/${GITHUB_REPO}`;


// Load issues.json from the same folder as seed.js
const issues = JSON.parse(readFileSync(join(__dirname, "issues.json"), "utf8"));

// Titles are the duplicate check below, so they must be unique.
const titles = issues.map((i) => i.title);
const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
if (duplicates.length > 0) {
  console.error(`❌ Error: duplicate titles in issues.json: ${[...new Set(duplicates)].join(", ")}`);
  process.exit(1);
}


console.log(`Start seeding ${issues.length} issues into ${REPO}...\n`);


for (const issue of issues) {
  const { seedId, title, labels, body } = issue;


  // Skip if an issue with this exact title already exists
  try {
    const existing = execFileSync(
      "gh",
      ["issue", "list", "--repo", REPO, "--search", `in:title "${title}"`, "--json", "number,title", "--jq", `[.[] | select(.title == "${title}")] | length`],
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], env }
    ).trim();


    if (parseInt(existing, 10) > 0) {
      console.log(`[seed ${seedId}] SKIP – issue "${title}" already exists.`);
      continue;
    }
  } catch (err) {
    console.error(err.message);


  }


  try {
    const url = execFileSync(
      "gh",
      [
        "issue",
        "create",
        "--repo",
        REPO,
        "--title",
        title,
        "--body",
        body,
        "--label",
        labels.join(","),
      ],
      { encoding: "utf8", env }
    ).trim();


    console.log(`[seed ${seedId}] CREATED – ${url}`);
  } catch (err) {
    console.error(`[seed ${seedId}] ERROR – Failed to create "${title}":`, err.message);
  }
}


console.log("\nSeeding completed.");