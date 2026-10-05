#!/usr/bin/env node

/**
 * Phrom CLI
 * Command-line interface for Phrom agent.

 * Usage:
 * phrom run – Full analysis (all issues, deterministic + AI)
 * phrom list – List all open issues (fast, no AI checks)
 * phrom status – Quick status (deterministic checks only, no AI)
 * phrom select – Analyze specific issues (e.g., 12 3 2)
 * phrom filter – Analyze issues by type (story, task, bug, epic)
 * phrom improve – Analyze issue(s) and show concrete improvement suggestions
 * phrom help – Show help
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import existing agent functions
import { runAgent, processIssue, determineType, runDeterministicChecks, calculateScore, calculateStatus } from './agent.js';
import { listIssues, getIssue } from './tools.js';
import { generateSummaryReport } from './report.js';

// Ensure output directory exists
const outputDir = path.join(process.cwd(), 'output');
const reportsDir = path.join(outputDir, 'reports');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const program = new Command();

// Helper function
const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

program
  .name('phrom')
  .description('Autonomous agent for GitHub Issue quality assessment')
  .version('1.0.0');

// ─────────────────────────────────────────────────────────────────────────────
// phrom run
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('run')
  .description('Run full analysis on all open issues (deterministic + AI checks)')
  .action(async () => {
    console.log('🤖 Starting Phrom agent (full analysis)...\n');
    try {
      const results = await runAgent();
      console.log('\n✓ Full analysis complete.');
      console.log(` → Results: ${path.join(outputDir, 'results-*.json')}`);
      console.log(` → Reports: ${path.join(reportsDir, 'issue-*-report-*.md')}`);
      console.log(` → Summary: ${path.join(outputDir, 'summary-*.md')}`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// phrom list
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('list')
  .description('List all open issues (fast, no AI checks)')
  .action(async () => {
    console.log('📋 Fetching issues...\n');
    try {
      const issues = await listIssues();
      console.log(`Found ${issues.length} open issues:\n`);
      for (const issue of issues) {
        const labels = issue.labels && issue.labels.length > 0
          ? `[${issue.labels.map(l => l.name).join(', ')}]`
          : '[no labels]';
        console.log(`#${issue.number}: ${issue.title} ${labels}`);
      }
      console.log(`\n✓ Done in ${(process.uptime() % 60).toFixed(1)}s`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// phrom status
// ─────────────────────────────────────────────────────────────────────────────
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
        const checksObj = runDeterministicChecks(fullIssue, type);

        const checksArray = Object.values(checksObj);
        const passed = checksArray.filter(c => c && c.passed).length;
        const total = checksArray.length;

        const detScore = total > 0 ? Math.round((passed / total) * 50) : 0;
        const status = detScore >= 40 ? 'ready' : detScore >= 25 ? 'needs-work' : 'not-ready';
        const statusEmoji = status === 'ready' ? '🟢' : status === 'needs-work' ? '🟡' : '🔴';

        results.push({
          issue: { number: fullIssue.number, title: fullIssue.title },
          type,
          score: detScore,
          status,
          statusEmoji,
          passed,
          total
        });

        console.log(`${statusEmoji} #${fullIssue.number}: ${fullIssue.title} – ${detScore}/50 (det: ${passed}/${total})`);
      }

      const ready = results.filter(r => r.status === 'ready').length;
      const needsWork = results.filter(r => r.status === 'needs-work').length;
      const notReady = results.filter(r => r.status === 'not-ready').length;

      console.log(`\n=== Summary ===`);
      console.log(`🟢 Ready: ${ready}`);
      console.log(`🟡 Needs work: ${needsWork}`);
      console.log(`🔴 Not ready: ${notReady}`);
      console.log(`Total: ${issues.length} issues`);
      console.log(`\n✓ Done in ${(process.uptime() % 60).toFixed(1)}s (deterministic only)`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// phrom select
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('select <numbers...>')
  .description('Analyze specific issues (e.g., phrom select 12 3 2)')
  .action(async (numbers) => {
    console.log(`🔍 Analyzing ${numbers.length} specific issue(s)...\n`);

    const results = [];
    for (const num of numbers) {
      try {
        const issue = await getIssue(parseInt(num));
        console.log(`Processing Issue #${issue.number}: "${issue.title}"`);

        const result = await processIssue(issue);
        results.push(result);

        const statusEmoji = result.status === 'ready' ? '🟢' : result.status === 'needs-work' ? '🟡' : '🔴';
        console.log(` ${statusEmoji} Score: ${result.score}/100 – ${result.status}`);

        // Timing-Ausgabe pro Issue
        if (result.timings) {
          const detTime = result.timings.deterministic.toFixed(1);
          const modelTime = (result.timings.model / 1000).toFixed(1);
          console.log(`   ⏱️  ${detTime} ms det | ${modelTime} s model`);
        }
        console.log();
      } catch (error) {
        console.error(` ❌ Issue #${num}: ${error.message}\n`);
      }
    }

    if (results.length === 0) {
      console.log('❌ No issues analyzed successfully.');
      process.exit(1);
    }

    // Summary
    console.log(`\n=== Summary ===`);
    const ready = results.filter(r => r.status === 'ready').length;
    const needsWork = results.filter(r => r.status === 'needs-work').length;
    const notReady = results.filter(r => r.status === 'not-ready').length;
    console.log(`🟢 Ready: ${ready}`);
    console.log(`🟡 Needs work: ${needsWork}`);
    console.log(`🔴 Not ready: ${notReady}`);
    console.log(`Total: ${results.length} issues`);

    // Reports speichern (KEINE Improvements)
    const { generateMarkdownReport, generateSummaryReport } = await import('./report.js');

    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const result of results) {
      const markdown = generateMarkdownReport(result, result.type);
      const reportPath = path.join(reportsDir, `issue-${result.issueNumber}-report-${timestamp}.md`);
      fs.writeFileSync(reportPath, markdown, 'utf-8');
      console.log(` → Report: ${reportPath}`);
    }

    // Summary-Report
    const summaryMarkdown = generateSummaryReport(results);
    const summaryPath = path.join(outputDir, `summary-select-${timestamp}.md`);
    fs.writeFileSync(summaryPath, summaryMarkdown, 'utf-8');
    console.log(` → Summary: ${summaryPath}`);
  });

// ─────────────────────────────────────────────────────────────────────────────
// phrom filter
// ─────────────────────────────────────────────────────────────────────────────
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

      // First pass: filter by type
      for (const issue of issues) {
        const fullIssue = await getIssue(issue.number);
        const issueType = determineType(fullIssue.labels);

        if (issueType === type) {
          filtered.push(fullIssue);
        }
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

        const statusEmoji = result.status === 'ready' ? '🟢' : result.status === 'needs-work' ? '🟡' : '🔴';
        console.log(` ${statusEmoji} Score: ${result.score}/100 – ${result.status}`);

        // Timing-Ausgabe pro Issue
        if (result.timings) {
          const detTime = result.timings.deterministic.toFixed(1);
          const modelTime = (result.timings.model / 1000).toFixed(1);
          console.log(`   ⏱️  ${detTime} ms det | ${modelTime} s model`);
        }
        console.log();
      }

      // Summary
      console.log(`\n=== Summary ===`);
      const ready = results.filter(r => r.status === 'ready').length;
      const needsWork = results.filter(r => r.status === 'needs-work').length;
      const notReady = results.filter(r => r.status === 'not-ready').length;
      console.log(`🟢 Ready: ${ready}`);
      console.log(`🟡 Needs work: ${needsWork}`);
      console.log(`🔴 Not ready: ${notReady}`);
      console.log(`Total: ${results.length} issues`);

      // Reports speichern (KEINE Improvements)
      const { generateMarkdownReport, generateSummaryReport } = await import('./report.js');

      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      for (const result of results) {
        const markdown = generateMarkdownReport(result, result.type);
        const reportPath = path.join(reportsDir, `issue-${result.issueNumber}-report-${timestamp}.md`);
        fs.writeFileSync(reportPath, markdown, 'utf-8');
        console.log(` → Report: ${reportPath}`);
      }

      // Summary-Report
      const summaryMarkdown = generateSummaryReport(results);
      const summaryPath = path.join(outputDir, `summary-filter-${type}-${timestamp}.md`);
      fs.writeFileSync(summaryPath, summaryMarkdown, 'utf-8');
      console.log(` → Summary: ${summaryPath}`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// phrom improve (UNTERSTÜTZT JETZT MEHRERE ISSUES)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('improve <numbers...>')
  .description('Analyze issue(s) and show concrete improvement suggestions')
  .action(async (numbers) => {
    console.log(`🔍 Analyzing ${numbers.length} issue(s) for improvements...\n`);

    const results = [];
    for (const num of numbers) {
      try {
        const issue = await getIssue(parseInt(num));
        console.log(`Processing Issue #${issue.number}: "${issue.title}"`);

        // Analyse mit Timing
        const analysisStart = performance.now();
        const result = await processIssue(issue);
        const analysisDuration = performance.now() - analysisStart;
        results.push(result);

        const statusEmoji = result.status === 'ready' ? '🟢' : result.status === 'needs-work' ? '🟡' : '🔴';
        console.log(`\n${statusEmoji} Issue #${result.issueNumber}: "${result.title}"`);
        console.log(`Type: ${result.type}`);
        console.log(`Score: ${result.score}/100`);
        console.log(`Status: ${result.status}`);
        console.log(`\nSummary: ${result.summary}`);

        // Analyse-Timing anzeigen
        if (result.timings) {
          const detTime = result.timings.deterministic.toFixed(1);
          const modelTime = (result.timings.model / 1000).toFixed(1);
          console.log(`\n⏱️  Analysis Timing:`);
          console.log(`   Deterministic: ${detTime} ms`);
          console.log(`   Model: ${modelTime} s`);
        }

        // Improvements mit Timing
        console.log(`\n🤖 Generating improvement suggestions...`);
        console.log(`   (This may take 10–30 seconds)\n`);

        const improveStart = performance.now();
        const { generateAllSuggestions, generateImprovementReport } = await import('./improve.js');
        const suggestionsObj = await generateAllSuggestions(result);
        const suggestions = suggestionsObj.suggestions || [];
        const revisedDraft = suggestionsObj.revisedDraft || '';
        const improveDuration = performance.now() - improveStart;

        // Improvement-Timing anzeigen
        console.log(`\n⏱️  Improvement Timing:`);
        console.log(`   Suggestions + Draft: ${(improveDuration / 1000).toFixed(1)} s`);

        const totalDuration = analysisDuration + improveDuration;
        console.log(`\n✓ Issue #${result.issueNumber} done in ${(totalDuration / 1000).toFixed(1)} s total`);

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

        // Report speichern
        const { generateMarkdownReport } = await import('./report.js');
        const markdown = generateMarkdownReport(result, result.type);
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(reportsDir, `issue-${result.issueNumber}-report-${timestamp}.md`);
        fs.writeFileSync(reportPath, markdown, 'utf-8');

        // Improvement report speichern
        const improvementsDir = path.join(outputDir, 'improvement-suggestions');
        if (!fs.existsSync(improvementsDir)) fs.mkdirSync(improvementsDir, { recursive: true });
        const improvementMarkdown = generateImprovementReport(result, suggestions, revisedDraft);
        const improvementPath = path.join(improvementsDir, `issue-${result.issueNumber}-improvements-${timestamp}.md`);
        fs.writeFileSync(improvementPath, improvementMarkdown, 'utf-8');

        console.log(`\n✓ Done.`);
        console.log(` → Full report: ${reportPath}`);
        console.log(` → Improvements: ${improvementPath}`);
        console.log();
      } catch (error) {
        console.error(` ❌ Issue #${num}: ${error.message}\n`);
      }
    }

    if (results.length === 0) {
      console.log('❌ No issues analyzed successfully.');
      process.exit(1);
    }

    // Summary für alle verbesserten Issues
    const { generateSummaryReport } = await import('./report.js');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summaryMarkdown = generateSummaryReport(results);
    const summaryPath = path.join(outputDir, `summary-improve-${timestamp}.md`);
    fs.writeFileSync(summaryPath, summaryMarkdown, 'utf-8');
    console.log(` → Summary: ${summaryPath}`);
  });

program.parse();