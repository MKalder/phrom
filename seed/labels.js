#!/usr/bin/env node
/**
 * labels.js – Creates the required labels in the demo repository (write operation).
 *
 * Requirements:
 * - GitHub CLI (`gh`) is installed and logged in (`gh auth login`), or SEED_GITHUB_TOKEN is set
 * - The demo repository exists (e.g. YOUR-USER/phrom-backlog-demo)
 *
 * Usage:
 *   node seed/labels.js
 *
 * Creates the labels type:epic, type:story, type:task, type:bug and demo-seed.
 * Existing labels are updated (color, description).
 * Permissions: the analysis token (GITHUB_TOKEN) is NOT used – see gh-env.js.
 */


import { execFileSync } from "node:child_process";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';  // loads .env
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


const labels = [
  { name: "type:epic", color: "6f42c1", description: "Large item, needs slicing into stories" },
  { name: "type:story", color: "0e8a16", description: "User story with role, goal, benefit" },
  { name: "type:task", color: "1d76db", description: "Technical task without user value" },
  { name: "type:bug", color: "d73a4a", description: "Defect or regression" },
  { name: "demo-seed", color: "cccccc", description: "Seed item for the Phrom demo" },
];


console.log(`Creating/updating labels in ${REPO}...\n`);


for (const label of labels) {
  try {
    const output = execFileSync(
      "gh",
      [
        "label",
        "create",
        label.name,
        "--color",
        label.color,
        "--description",
        label.description,
        "--force",
        "-R",
        REPO,
      ],
      { encoding: "utf8", env }
    ).trim();


    console.log(`✓ ${label.name} – ${output || "updated"}`);
  } catch (err) {
    console.error(`✗ ${label.name} – Failed:`, err.message);
  }
}


console.log("\nLabels completed.");