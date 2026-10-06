// scripts/demo.js
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { printBanner } from './banner.js';

const execAsync = promisify(exec);

// Files older than the start of this run are treated as stale.
const startedAtWall = Date.now() - 2000;

// Flags: --verbose (full preflight), --full (show placeholder sections), --showcase=<n>
const verbose = process.argv.includes('--verbose');
const showFull = process.argv.includes('--full');
const showcaseArg = process.argv.find((arg) => arg.startsWith('--showcase='));
const showcaseNumber = Number(showcaseArg?.split('=')[1]) || 3;

// ============================================================================
// UI HELPERS
// ============================================================================

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const ansi = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text));

const bold = ansi(1);
const dim = ansi(2);
const red = ansi(31);
const green = ansi(32);
const yellow = ansi(33);

const SYMBOL = { ok: green('✔'), fail: red('✖'), warn: yellow('▲') };
const DOT = { ready: green('●'), needsWork: yellow('●'), notReady: red('●'), unknown: dim('●') };

const STATUS = {
    ready: { dot: DOT.ready, text: 'Ready' },
    'needs-work': { dot: DOT.needsWork, text: 'Needs work' },
    'not-ready': { dot: DOT.notReady, text: 'Not ready' },
};

const RULE = dim('─'.repeat(44));
const TEXT_WIDTH = 76;

const section = (title) => console.log(`\n${bold(title)}\n`);
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const firstLine = (text = '') => String(text).split('\n')[0];

const fmtDuration = (ms) =>
    ms < 1000 ? '<1 s' : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

/** Animated spinner for async work. Silent when stdout is not a TTY. */
async function withSpinner(label, fn) {
    if (!process.stdout.isTTY) return fn();

    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const timer = setInterval(() => {
        process.stdout.write(`\r\x1b[2K  ${dim(frames[i++ % frames.length])} ${label}`);
    }, 80);

    try {
        return await fn();
    } finally {
        clearInterval(timer);
        process.stdout.write('\r\x1b[2K');
    }
}

/** Word-wrap a single line with hanging indent for list items. */
function wrapLine(line, width) {
    const lead = (line.match(/^\s*(?:[-*•☐☑]\s+|\d+\.\s+)?/) || [''])[0];
    const pad = ' '.repeat(lead.length);
    const words = line.slice(lead.length).split(/\s+/).filter(Boolean);

    if (words.length === 0) return [''];

    const out = [];
    let current = lead;
    let empty = true;

    for (const word of words) {
        const candidate = empty ? current + word : `${current} ${word}`;
        if (candidate.length > width && !empty) {
            out.push(current);
            current = pad + word;
        } else {
            current = candidate;
        }
        empty = false;
    }
    out.push(current);
    return out;
}

/** Light markdown → terminal rendering (headings/labels bold, checkboxes as ☐). */
function renderMarkdown(text, width = TEXT_WIDTH - 2) {
    return text.split('\n').flatMap((raw) => {
        const heading = raw.match(/^#{1,6}\s+(.*)$/);
        if (heading) return [bold(heading[1].replace(/\*\*/g, ''))];

        const label = raw.match(/^\*\*(.+?)\*\*\s*$/);
        if (label) return [bold(label[1])];

        const line = raw
            .replace(/^(\s*)[-*]\s+\[ \]\s+/, '$1☐ ')
            .replace(/^(\s*)[-*]\s+\[[xX]\]\s+/, '$1☑ ')
            .replace(/\*\*/g, '')
            .replace(/`/g, '');

        return wrapLine(line, width);
    });
}

function printBlock(label, lines, note = '') {
    console.log(`  ${bold(label)}${note ? dim(`  ${note}`) : ''}`);
    console.log(`  ${dim('─'.repeat(40))}`);
    lines.forEach((line) => console.log(`  ${line}`));
    console.log();
}

const run = async (command) => {
    const { stdout } = await execAsync(command, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 5 * 60_000,
    });
    return stdout;
};

// ============================================================================
// FILE HELPERS
// ============================================================================

const REPORT_DIR = path.resolve('output/reports');
const DRAFT_DIR = path.resolve('output/improvement-suggestions');

const relPath = (filePath) => path.relative(process.cwd(), filePath);
const readIfExists = (filePath) => (filePath ? fs.readFileSync(filePath, 'utf-8') : '');

/** Newest .md file in `dir` for the issue (e.g. "issue-3-…"), optionally only if modified after `since`. */
function latestFileForIssue(dir, issueNumber, { include, since = 0 } = {}) {
    if (!fs.existsSync(dir)) return null;

    const issueRe = new RegExp(`issue[-_ ]?${issueNumber}(?!\\d)`, 'i');

    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.md') && issueRe.test(f) && (!include || include.test(f)))
        .map((f) => ({ file: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
        .filter((f) => f.mtime >= since)
        .sort((a, b) => b.mtime - a.mtime);

    return files.length ? path.join(dir, files[0].file) : null;
}

// ============================================================================
// PARSING (Phrom markdown output)
// ============================================================================

function extractScore(text) {
    const match = text.match(/(\d{1,3})\s*\/\s*100/);
    if (!match) return null;
    const value = Number(match[1]);
    return value <= 100 ? value : null;
}

/** "**Current Status:** Not-ready" → "Not-ready" */
function extractStatus(text) {
    const match = text.match(/status:?\**\s*(not[-\s]?ready|needs[-\s]?work|ready)/i);
    return match ? match[1] : null;
}

function normalizeStatus(raw) {
    if (!raw) return null;
    return STATUS[raw.toLowerCase().replace(/[\s_]+/g, '-')] ?? null;
}

/** Score + status from the best available source; never invented. */
function resolveAssessment(number, selectOutput) {
    const texts = [
        selectOutput,
        readIfExists(latestFileForIssue(REPORT_DIR, number, { since: startedAtWall })),
        readIfExists(latestFileForIssue(DRAFT_DIR, number, { include: /improvement/i, since: startedAtWall })),
    ];

    let score = null;
    let status = null;
    for (const text of texts) {
        if (!text) continue;
        score ??= extractScore(text);
        status ??= normalizeStatus(extractStatus(text));
    }
    return { score, status };
}

/** "Ac-testability" → "AC testability" */
function humanizeCriterion(raw) {
    const text = raw
        .replace(/\*\*|`/g, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\bac\b/gi, 'AC')
        .replace(/\s+/g, ' ')
        .trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/**
 * Parses "### 1. Story-format (deterministic)" blocks from the detailed suggestions
 * and their "**Problem:** …" line. Returns [] if the structure is not found.
 */
function parseFindings(markdown) {
    const headingRe = /^###\s+\d+\.\s+(.+?)\s+\((deterministic|ai)\)\s*$/i;
    const findings = [];
    let current = null;

    for (const line of markdown.split('\n')) {
        const heading = line.match(headingRe);
        if (heading) {
            current = { name: humanizeCriterion(heading[1]), kind: heading[2].toLowerCase(), problem: '' };
            findings.push(current);
            continue;
        }
        if (/^##\s/.test(line)) {
            current = null; // a new level-2 section ends the detail list
            continue;
        }
        const problem = current && line.match(/^\*\*Problem:\*\*\s*(.+)$/);
        if (problem) current.problem = problem[1].trim();
    }
    return findings;
}

/** Content of "## 📝 Revised Issue Draft" up to "## 🎯 Next Steps", without intro sentence and separators. */
function extractRevisedDraft(markdown) {
    const lines = markdown.split('\n');
    const start = lines.findIndex((l) => /^##\s+.*revised issue draft/i.test(l));
    if (start === -1) return null;

    let end = lines.findIndex((l, i) => i > start && /^##\s+.*next steps/i.test(l));
    if (end === -1) end = lines.length;

    const body = lines.slice(start + 1, end);

    // Skip the intro sentence and the "---" separator: the draft starts at its first "## " heading.
    const firstHeading = body.findIndex((l) => /^##\s/.test(l));
    if (firstHeading === -1) return null;

    const content = body.slice(firstHeading);
    while (content.length && /^(\s*|-{3,})$/.test(content[content.length - 1])) content.pop();

    return content.filter((l) => l.trim()).length >= 3 ? content.join('\n') : null;
}

const HIDEABLE_SECTIONS = /^(context|dependencies)$/i;

/** Hides Context/Dependencies sections that only contain unfilled [placeholders]; reports what was hidden. */
function hidePlaceholderSections(text) {
    const hidden = [];

    const kept = text.split(/^(?=##\s)/m).filter((part) => {
        const lines = part.split('\n');
        const heading = lines[0].match(/^##\s+(.*)$/);
        if (!heading || !HIDEABLE_SECTIONS.test(heading[1].trim())) return true;

        const content = lines.slice(1).filter((l) => l.trim());
        const onlyPlaceholders = content.length > 0 && content.every((l) => /\[[^\]]+\]/.test(l));
        if (onlyPlaceholders) hidden.push(heading[1].trim());
        return !onlyPlaceholders;
    });

    return { text: kept.join('').trim(), hidden };
}

// ============================================================================
// CONFIG
// ============================================================================

const githubOwner = process.env.GITHUB_OWNER;
const githubRepo = process.env.GITHUB_REPO;
const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
const modelName = process.env.MODEL_NAME || 'qwen3:30b-instruct';

const isDemoRepo = githubOwner === 'MKalder' && githubRepo === 'phrom-backlog-demo';
const repoLabel = isDemoRepo
    ? 'demo repository'
    : githubOwner && githubRepo
        ? `${githubOwner}/${githubRepo}`
        : 'not configured';

const ollamaHostname = (() => {
    try {
        return new URL(ollamaHost).hostname;
    } catch {
        return '';
    }
})();
const isLocalAI = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(ollamaHostname);

let octokit = null;
let resolvedModel = modelName;

async function fetchIssue(number) {
    if (!octokit) return null;
    try {
        const { data } = await octokit.issues.get({
            owner: githubOwner,
            repo: githubRepo,
            issue_number: number,
        });
        return { title: data.title, body: (data.body ?? '').trim() };
    } catch {
        return null;
    }
}

// ============================================================================
// BANNER
// ============================================================================

printBanner('1.0.0');

console.log(`  Repository  ${repoLabel}`);
console.log('  Mode        read-only');
console.log(
    isLocalAI
        ? `  AI          local (Ollama) ${dim('· no backlog data sent to a cloud LLM')}\n`
        : `  AI          Ollama @ ${ollamaHostname || ollamaHost} ${dim('(remote host)')}\n`
);

// ============================================================================
// PREFLIGHT
// ============================================================================

const checks = [];
const addCheck = (name, status, detail = '') => checks.push({ name, status, detail });

// --- 1. Environment ---
if (githubOwner && githubRepo) {
    addCheck('Environment', 'ok', '.env loaded');
} else {
    addCheck('Environment', 'fail', 'GITHUB_OWNER / GITHUB_REPO missing in .env');
}

// --- 2. GitHub ---
if (githubOwner && githubRepo) {
    try {
        const { Octokit } = await import('@octokit/rest');
        octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        await octokit.repos.get({ owner: githubOwner, repo: githubRepo });
        addCheck('GitHub', 'ok', repoLabel);
    } catch (error) {
        octokit = null;
        addCheck('GitHub', 'fail', error.message);
    }
} else {
    addCheck('GitHub', 'fail', 'skipped (environment incomplete)');
}

// --- 3. Ollama ---
let ollamaModels = null;
try {
    const response = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    ollamaModels = data.models || [];
    addCheck('Ollama', 'ok', ollamaHost);
} catch {
    addCheck('Ollama', 'fail', `not reachable at ${ollamaHost}`);
}

// --- 4. AI model ---
if (ollamaModels) {
    const installed = ollamaModels.find((m) => m.name.includes(modelName));
    if (installed) {
        resolvedModel = installed.name;
        addCheck(modelName, 'ok', 'available locally');
    } else {
        addCheck(modelName, 'warn', `not found – run: ollama pull ${modelName}`);
    }
} else {
    addCheck(modelName, 'warn', 'not checked (Ollama unreachable)');
}

// --- Results: compact on success, detailed on problems or --verbose ---
const hasFailure = checks.some((c) => c.status === 'fail');
const allOk = checks.every((c) => c.status === 'ok');

if (verbose || !allOk) {
    console.log(bold('Preflight\n'));
    for (const check of checks) {
        console.log(`  ${SYMBOL[check.status]} ${check.name.padEnd(20)}${dim(check.detail)}`);
    }
} else {
    console.log(`  ${SYMBOL.ok} Preflight passed ${dim(`(${checks.length} checks)`)}`);
}

if (hasFailure) {
    console.error(`\n${red('✖ Preflight failed.')} Please fix the errors above and try again.\n`);
    process.exit(1);
}

console.log(`\n${RULE}`);

// ============================================================================
// 1. BACKLOG OVERVIEW
// ============================================================================

const deterministicStart = performance.now();

section('1. BACKLOG OVERVIEW');

let listOutput;
try {
    listOutput = await run('npm run phrom list --silent');
} catch {
    console.error(`  ${SYMBOL.fail} Failed to load issues\n`);
    process.exit(1);
}

const countMatch = listOutput.match(/Found (\d+) open issues/);
const issueCount = countMatch
    ? Number(countMatch[1])
    : listOutput.split('\n').filter((line) => line.startsWith('#')).length;

console.log(`  ${bold(issueCount)} open issues`);

// ============================================================================
// 2. REFINEMENT READINESS
// ============================================================================

section('2. REFINEMENT READINESS');

let statusOutput = '';
try {
    statusOutput = await run('npm run phrom status --silent');
} catch {
    console.error(`  ${SYMBOL.fail} Failed to calculate readiness\n`);
    process.exit(1);
}

const pickNumber = (regex) => {
    const match = statusOutput.match(regex);
    return match ? Number(match[1]) : null;
};

const ready = pickNumber(/🟢 Ready: (\d+)/);
const needsWork = pickNumber(/🟡 Needs work: (\d+)/);
const notReady = pickNumber(/🔴 Not ready: (\d+)/);

const deterministicMs = performance.now() - deterministicStart;

const show = (value) => (value === null ? '?' : value);

console.log(`  ${DOT.ready} Ready        ${show(ready)}`);
console.log(`  ${DOT.needsWork} Needs work   ${show(needsWork)}`);
console.log(`  ${DOT.notReady} Not ready    ${show(notReady)}`);

const countsKnown = [ready, needsWork, notReady].every((value) => value !== null);
const needAttention = countsKnown ? needsWork + notReady : null;
const assessedCount = countsKnown ? ready + needsWork + notReady : issueCount;

if (countsKnown) {
    console.log(`\n  ${bold('Recommendation')}`);
    console.log(`  → ${ready} issues can enter refinement`);
    console.log(`  → ${needAttention} require attention first`);
    console.log(dim(`\n  ${needAttention} issues flagged before they reach refinement.`));
}

// ============================================================================
// 3. AI ANALYSIS
// ============================================================================

const aiStart = performance.now();

section('3. AI ANALYSIS');

// Which issues are showcased is a deliberate demo choice (change with --showcase=<n>).
// Titles come from GitHub; the fixed titles are only a fallback if GitHub is unreachable.
const FALLBACK_TITLES = { 3: 'Improve login', 4: 'Reset password', 5: 'Manage account settings' };
const demoIssues = [...new Set([showcaseNumber, 4])].map((number) => ({
    number,
    fallbackTitle: FALLBACK_TITLES[number] ?? `Issue #${number}`,
}));

const analysisResults = [];

for (const demo of demoIssues) {
    const original = await fetchIssue(demo.number);
    const title = original?.title ?? demo.fallbackTitle;

    let selectOutput = '';
    let failed = false;

    await withSpinner(`Analyzing #${demo.number} ${title}…`, async () => {
        try {
            selectOutput = await run(`npm run phrom select ${demo.number} --silent`);
        } catch {
            failed = true;
        }
    });

    if (failed) {
        console.log(`  ${SYMBOL.fail} #${demo.number}  Failed to analyze`);
        continue;
    }

    const { score, status } = resolveAssessment(demo.number, selectOutput);
    const { dot, text } = status ?? { dot: DOT.unknown, text: '' };
    const scoreCell = score === null ? '    n/a' : `${String(score).padStart(3)}/100`;

    console.log(`  #${demo.number}  ${truncate(title, 22).padEnd(22)} ${dot} ${scoreCell}  ${text}`);
    analysisResults.push({ number: demo.number, title, original, score, status });
}

// ============================================================================
// 4. IMPROVEMENT (BEFORE → AFTER)
// ============================================================================

section('4. IMPROVEMENT');

/** Uses a draft from this run; otherwise lets Phrom generate it via `phrom improve <n>`. */
async function ensureDraft(number) {
    const find = () =>
        latestFileForIssue(DRAFT_DIR, number, { include: /improvement/i, since: startedAtWall });

    let file = find();
    if (file) return file;

    await withSpinner(`Generating improvement draft for #${number}…`, () =>
        run(`npm run phrom improve ${number} --silent`)
    );

    file = find();
    if (!file) throw new Error('no draft file was written to output/improvement-suggestions/');
    return file;
}

let improvementsGenerated = 0;
const showcase = analysisResults.find((issue) => issue.number === showcaseNumber);

if (!showcase) {
    console.log(dim(`  Skipped – analysis of #${showcaseNumber} failed.`));
} else {
    let draftPath = null;
    let draftError = null;

    try {
        draftPath = await ensureDraft(showcase.number);
    } catch (error) {
        draftError = firstLine(error.message);
    }

    const markdown = readIfExists(draftPath);

    // Score/status: the draft header is authoritative (Phrom's own verdict).
    const fromDraft = markdown
        ? { score: extractScore(markdown), status: normalizeStatus(extractStatus(markdown)) }
        : { score: null, status: null };

    const score = fromDraft.score ?? showcase.score;
    const status = fromDraft.status ?? showcase.status ?? { dot: DOT.unknown, text: '' };
    const scoreSuffix = score === null ? '' : ` · ${score}/100`;

    console.log(`  ${bold(`#${showcase.number} ${showcase.title}`)}  ${status.dot} ${status.text}${scoreSuffix}\n`);

    // --- Findings: parsed from the real Phrom draft ---
    const findings = parseFindings(markdown);

    if (findings.length > 0) {
        console.log(`  Phrom identified ${findings.length} gaps:\n`);
        for (const finding of findings) {
            const kind = finding.kind === 'ai' ? 'AI  ' : 'rule';
            const problem = truncate(finding.problem.split(/(?<=[.!?])\s/)[0] ?? '', 52);
            console.log(`  ${SYMBOL.fail} ${finding.name.padEnd(18)} ${dim(kind)}  ${dim(problem)}`);
        }

        const aiCount = findings.filter((f) => f.kind === 'ai').length;
        console.log(dim(`\n  ${findings.length - aiCount} rule-based · ${aiCount} AI-detected\n`));
    } else if (!draftError) {
        console.log(`  ${SYMBOL.warn} No gap list found in ${relPath(draftPath)}\n`);
    }

    // --- BEFORE: original issue from GitHub ---
    const original = showcase.original;
    const beforeBody = original?.body ? original.body.split('\n').slice(0, 8).join('\n') : '';

    printBlock('BEFORE', [
        bold(original?.title ?? showcase.title),
        ...(beforeBody ? renderMarkdown(beforeBody) : [dim('(no description)')]),
    ]);

    // --- AFTER: revised draft produced by Phrom ---
    const revised = extractRevisedDraft(markdown);

    if (revised) {
        const { text, hidden } = showFull ? { text: revised, hidden: [] } : hidePlaceholderSections(revised);

        improvementsGenerated = 1;
        printBlock('AFTER', renderMarkdown(text), 'revised draft by Phrom');

        if (hidden.length > 0) {
            console.log(dim(`  Hidden (placeholders only): ${hidden.join(', ')} · show all: --full\n`));
        }
    } else {
        const reason = draftError ?? 'no revised draft in the output';
        console.log(`  ${SYMBOL.warn} Could not show the improved ticket ${dim(`(${reason})`)}\n`);
    }

    if (draftPath) {
        console.log(dim(`  Full analysis: ${relPath(draftPath)}`));
    }
}

const aiMs = performance.now() - aiStart;

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n${RULE}\n`);

console.log(`${SYMBOL.ok} ${bold('Refinement assessment complete')}\n`);

const row = (left, right) => console.log(`  ${left.padEnd(30)}${dim(right)}`);

row(`${assessedCount} issues assessed`, `deterministic · ${fmtDuration(deterministicMs)}`);
row(`${analysisResults.length} issues analyzed with AI`, `${resolvedModel} · ${fmtDuration(aiMs)}`);
row(`${improvementsGenerated} improvement generated`, 'before → after');

if (countsKnown) {
    console.log(`\n  ${ready} ready for refinement · ${needAttention} require attention`);
}

console.log(
    isLocalAI
        ? `\n  ${SYMBOL.ok} AI ran locally – no issue data was sent to a cloud LLM.`
        : `\n  ${SYMBOL.warn} AI ran on a remote Ollama host (${ollamaHostname}).`
);

console.log(dim('\n  Reports: output/reports/ · output/improvement-suggestions/'));

// ============================================================================
// NEXT STEPS
// ============================================================================

console.log(`\n${bold('Next')}\n`);

if (countsKnown && improvementsGenerated) {
    const remaining = Math.max(needAttention - 1, 0);
    if (remaining > 0) {
        console.log(`  → ${remaining} more issues need a rewrite: npm run phrom improve <issue-number>`);
    }
}

if (isDemoRepo) {
    console.log('  → Run Phrom on your own backlog (see README Option B)\n');
} else {
    console.log('  → Seed demo data in your repository: npm run seed');
    console.log(dim('    requires: gh auth login\n'));
}