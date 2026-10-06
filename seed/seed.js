#!/usr/bin/env node
/**
 * seed.js – add Demo-Issues to Backlog-Repo.
 *
 * Voraussetzungen:
 * - GitHub CLI (`gh`) ist installiert und eingeloggt (`gh auth login`)
 * - Das Demo-Repo existiert (z. B. DEIN-USER/phrom-backlog-demo)
 * - Die Datei issues.json liegt im selben Ordner
 *
 * Nutzung:
 *   cd seed
 *   node seed.js
 *
 * Das Skript liest issues.json und legt für jeden Eintrag ein Issue im Demo-Repo an.
 * Bereits existierende Issues werden anhand des Titels erkannt und übersprungen.
 */


import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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


// Issues.json im selben Ordner wie seed.js laden
const issues = JSON.parse(readFileSync(join(__dirname, "issues.json"), "utf8"));


console.log(`Start seeding ${issues.length} issues into ${REPO}...\n`);


for (const issue of issues) {
  const { number, title, labels, body, expected } = issue;


  // Prüfen, ob ein Issue mit diesem Titel bereits existiert
  try {
    const existing = execFileSync(
      "gh",
      ["issue", "list", "--repo", REPO, "--search", `in:title "${title}"`, "--json", "number,title", "--jq", `[.[] | select(.title == "${title}")] | length`],
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
    ).trim();


    if (parseInt(existing, 10) > 0) {
      console.log(`[#${number}] SKIP – Issue "${title}" exists already.`);
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
      { encoding: "utf8" }
    ).trim();


    console.log(`[#${number}] CREATED – ${url}`);
  } catch (err) {
    console.error(`[#${number}] ERROR – Failed to create "${title}":`, err.message);
  }
}


console.log("\nSeeding completed.");