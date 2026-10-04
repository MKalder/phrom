#!/usr/bin/env node

/**
 * Phrom CLI
 * Command-line interface for Phrom agent.
 *
 * Usage:
 *   phrom run                  – Full analysis (all issues, deterministic + AI)
 *   phrom list                 – List all open issues (fast, no AI checks)
 *   phrom status               – Quick status (deterministic checks only, no AI)
 *   phrom issue <number>       – Analyze single issue (full analysis with AI)
 *   phrom select <numbers...>  – Analyze specific issues
 *   phrom filter <type>        – Analyze issues by type (story, task, bug, epic)
 *   phrom improve <number>     – Analyze issue + improvement suggestions (LLM + Reference)
 *   phrom help                 – Show help
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

import { runAgent, processIssue, determineType, runDeterministicChecks } from './agent.js';
import { listIssues, getIssue } from './tools.js';
import { generateSummaryReport, generateMarkdownReport } from './report.js';

const outputDir = path.join(process.cwd(), 'output');
const reportsDir = path.join(outputDir, 'reports');
const improvementsDir = path.join(outputDir, 'improvement-suggestions');
fs.mkdirSync(reportsDir, { recursive: true });

const program = new Command();
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const emojiFor = (status) =>
  status === 'ready' ? '🟢' : status === 'needs-work' ? '🟡' : '🔴';
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

function printSummary(results) {
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\n=== Summary ===`);
  console.log(`🟢 Ready: ${count('ready')}`);
  console.log(`🟡 Needs work: ${count('needs-work')}`);
  console.log(`🔴 Not ready: ${count('not-ready')}`);
  console.log(`Total: ${results.length} issues`);
}

function saveReports(results, summaryName) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = stamp();
  for (const result of results) {
    const markdown = generateMarkdownReport(result, result.type);
    const reportPath = path.join(reportsDir, `issue-${result.issueNumber}-report-${timestamp}.md`);
    fs.writeFileSync(reportPath, markdown, 'utf-8');
    console.log(` → Report: ${reportPath}`);
  }
  const summaryPath = path.join(outputDir, `${summaryName}-${timestamp}.md`);
  fs.writeFileSync(summaryPath, generateSummaryReport(results), 'utf-8');
  console.log(` → Summary: ${summaryPath}`);
}

program
  .name('phrom')
  .description('Autonomous agent for GitHub Issue quality assessment')
  .version('1.0.0');

// ─── phrom run ───────────────────────────────────────────────────────────────
program
  .command('run')
  .description('Run full analysis on all open issues (deterministic + AI checks)')
  .action(async () => {
    console.log('🤖 Starting Phrom agent (full analysis)...\n');
    try {
      await runAgent();
      console.log('\n✓ Full analysis complete.');
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─── phrom list ──────────────────────────────────────────────────────────────
program
  .command('list')
  .description('List all open issues (fast, no AI checks)')
  .action(async () => {
    console.log('📋 Fetching issues...\n');
    try {
      const issues = await listIssues();
      console.log(`Found ${issues.length} open issues:\n`);
      for (const issue of issues) {
        const labels =
          issue.labels && issue.labels.length > 0
            ? `[${issue.labels.map((l) => l.name).join(', ')}]`
            : '[no labels]';
        console.log(`#${issue.number}: ${issue.title} ${labels}`);
      }
      console.log(`\n✓ Done in ${(process.uptime() % 60).toFixed(1)}s`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─── phrom status ────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show quick status (deterministic checks only, no AI)')
  .action(async () => {
    console.log('📊 Calculating status (deterministic checks only)...\n');
    try {
      const issues = await listIssues();
      console.log(`Processing ${issues.length} issues...\n`);

      const results = [];
      for (const issue of issues) {
        const fullIssue = await getIssue(issue.number);
        const type = determineType(fullIssue.labels);
        const checksArray = Object.values(runDeterministicChecks(fullIssue, type));
        const passed = checksArray.filter((c) => c && c.passed).length;
        const total = checksArray.length;

        const detScore = total > 0 ? Math.round((passed / total) * 50) : 0;
        const status = detScore >= 40 ? 'ready' : detScore >= 25 ? 'needs-work' : 'not-ready';
        results.push({ status });

        console.log(
          `${emojiFor(status)} #${fullIssue.number}: ${fullIssue.title} – ${detScore}/50 (det: ${passed}/${total})`
        );
      }

      printSummary(results);
      console.log(`\n✓ Done in ${(process.uptime() % 60).toFixed(1)}s (deterministic only)`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─── phrom issue <number> ────────────────────────────────────────────────────
program
  .command('issue <number>')
  .description('Analyze a single issue (full analysis with AI)')
  .action(async (number) => {
    console.log(`🔍 Analyzing issue #${number}...\n`);
    try {
      const issue = await getIssue(parseInt(number, 10));
      const result = await processIssue(issue);

      console.log(`\n${emojiFor(result.status)} Issue #${result.issueNumber}: "${result.title}"`);
      console.log(`Type: ${result.type}`);
      console.log(`Score: ${result.score}/100`);
      console.log(`Status: ${result.status}`);
      console.log(`\nSummary: ${result.summary}`);

      const markdown = generateMarkdownReport(result, result.type);
      const reportPath = path.join(reportsDir, `issue-${result.issueNumber}-report-${stamp()}.md`);
      fs.writeFileSync(reportPath, markdown, 'utf-8');

      console.log(`\n✓ Done.`);
      console.log(` → Full report: ${reportPath}`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─── phrom select <numbers...> ───────────────────────────────────────────────
program
  .command('select <numbers...>')
  .description('Analyze specific issues (e.g., phrom select 12 3 2)')
  .action(async (numbers) => {
    console.log(`🔍 Analyzing ${numbers.length} specific issue(s)...\n`);

    const results = [];
    for (const num of numbers) {
      try {
        const issue = await getIssue(parseInt(num, 10));
        console.log(`Processing Issue #${issue.number}: "${issue.title}"`);
        const result = await processIssue(issue);
        results.push(result);
        console.log(` ${emojiFor(result.status)} Score: ${result.score}/100 – ${result.status}\n`);
      } catch (error) {
        console.error(` ❌ Issue #${num}: ${error.message}\n`);
      }
    }

    if (results.length === 0) {
      console.log('❌ No issues analyzed successfully.');
      process.exit(1);
    }

    printSummary(results);
    saveReports(results, 'summary-select');
  });

// ─── phrom filter <type> ─────────────────────────────────────────────────────
program
  .command('filter <type>')
  .description('Analyze issues by type (story, task, bug, epic)')
  .action(async (typeArg) => {
    const validTypes = ['story', 'task', 'bug', 'epic'];
    const type = typeArg.toLowerCase();

    if (!validTypes.includes(type)) {
      console.error(`❌ Invalid type "${type}". Valid types: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    console.log(`🔍 Filtering issues by type: ${type}...\n`);

    try {
      const issues = await listIssues();
      const filtered = [];
      for (const issue of issues) {
        const fullIssue = await getIssue(issue.number);
        if (determineType(fullIssue.labels) === type) filtered.push(fullIssue);
      }

      if (filtered.length === 0) {
        console.log(`No issues found with type "${type}".`);
        process.exit(0);
      }

      console.log(`Found ${filtered.length} issues with type "${type}".\n`);

      const results = [];
      for (const issue of filtered) {
        console.log(`Processing Issue #${issue.number}: "${issue.title}"`);
        const result = await processIssue(issue);
        results.push(result);
        console.log(` ${emojiFor(result.status)} Score: ${result.score}/100 – ${result.status}\n`);
      }

      printSummary(results);
      saveReports(results, `summary-filter-${type}`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─── phrom improve <number> – EINZIGER Command mit LLM-Improvements ─────────
program
  .command('improve <number>')
  .description('Analyze issue and show concrete improvement suggestions (LLM + Reference + Criteria)')
  .action(async (number) => {
    console.log(`🔍 Analyzing issue #${number} for improvements...\n`);
    try {
      const issue = await getIssue(parseInt(number, 10));
      const result = await processIssue(issue);

      console.log(`\n${emojiFor(result.status)} Issue #${result.issueNumber}: "${result.title}"`);
      console.log(`Type: ${result.type}`);
      console.log(`Score: ${result.score}/100`);
      console.log(`Status: ${result.status}`);
      console.log(`\nSummary: ${result.summary}`);

      const { generateAllSuggestions, generateImprovementReport } = await import('./improve.js');
      const suggestionsObj = await generateAllSuggestions(result, true); // LLM explizit aktiviert
      const suggestions = suggestionsObj.suggestions || [];
      const revisedDraft = suggestionsObj.revisedDraft || '';

      if (suggestions.length > 0) {
        console.log(`\n💡 Top ${suggestions.length} Improvements:\n`);
        suggestions.forEach((s, i) => {
          console.log(`${i + 1}. **${capitalize(s.check)}** (${s.type})`);
          console.log(`   Problem: ${s.suggestion}`);
          console.log(`   Instead of: ${s.before}`);
          console.log(`   Write: ${s.after.slice(0, 80)}${s.after.length > 80 ? '...' : ''}\n`);
        });
      } else {
        console.log(`\n✅ No improvements needed – issue is ready!`);
      }

      const timestamp = stamp();
      const markdown = generateMarkdownReport(result, result.type);
      const reportPath = path.join(reportsDir, `issue-${result.issueNumber}-report-${timestamp}.md`);
      fs.writeFileSync(reportPath, markdown, 'utf-8');

      fs.mkdirSync(improvementsDir, { recursive: true });
      const improvementPath = path.join(
        improvementsDir,
        `issue-${result.issueNumber}-improvements-${timestamp}.md`
      );
      fs.writeFileSync(
        improvementPath,
        generateImprovementReport(result, suggestions, revisedDraft),
        'utf-8'
      );

      console.log(`\n✓ Done.`);
      console.log(` → Full report: ${reportPath}`);
      console.log(` → Improvements: ${improvementPath}`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse();