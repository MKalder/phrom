#!/usr/bin/env node
/**
 * labels.js – Legt die benötigten Labels im Demo-Repo an.
 *
 * Voraussetzungen:
 * - GitHub CLI (`gh`) ist installiert und eingeloggt (`gh auth login`)
 * - Das Demo-Repo existiert (z. B. DEIN-USER/phrom-backlog-demo)
 *
 * Nutzung:
 *   cd seed
 *   node labels.js
 *
 * Das Skript legt die Labels type:epic, type:story, type:task, type:bug und demo-seed an.
 * Bereits existierende Labels werden aktualisiert (Farbe, Beschreibung).
 */


import { execFileSync } from "node:child_process";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';  // Lädt .env


// __dirname in ES Modules nachbauen
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;


// Validierung
if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
  console.error('❌ Fehler: Bitte .env konfigurieren (GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN)');
  process.exit(1);
}


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
      { encoding: "utf8" }
    ).trim();


    console.log(`✓ ${label.name} – ${output || "updated"}`);
  } catch (err) {
    console.error(`✗ ${label.name} – Failed:`, err.message);
  }
}


console.log("\nLabels completed.");