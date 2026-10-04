/**
 * Phrom Report Generator (Phase 2)
 * Generates Markdown reports.
 *
 * IMPORTANT: NO IMPROVEMENT SUGGESTIONS HERE.
 * Improvements are only generated via cli.js (phrom improve).
 */

// ---------- Normalisierung ----------

function toCheckArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value.checks)) return value.checks;
    if (typeof value === 'object') {
        return Object.entries(value)
            .filter(([, v]) => v && typeof v === 'object' && 'passed' in v)
            .map(([key, v]) => ({ name: key, ...v }));
    }
    return [];
}

function normalizeCheck(c) {
    return {
        name: c.name || c.id || c.check || 'Unnamed check',
        passed: Boolean(c.passed ?? c.pass ?? c.ok),
        evidence: c.evidence || c.message || '',
        reason: c.reason || c.message || 'No reason provided.',
    };
}

function normalizeResult(result, typeOverride) {
    const src = result || {};
    const issueObj = src.issue || {};
    const modelRaw = src.modelChecks || src.model || src.aiChecks || null;

    return {
        number: issueObj.number ?? src.number ?? src.issueNumber ?? '?',
        title: issueObj.title ?? src.title ?? '(no title)',
        body: src.body || issueObj.body || '',
        type: typeOverride || src.type || issueObj.type || 'unknown',
        score: src.score ?? 0,
        status: src.status ?? 'not-ready',
        summary: src.summary || 'No summary available.',
        checks: toCheckArray(src.checks || src.deterministicChecks || src.deterministic).map(normalizeCheck),
        modelError: modelRaw && modelRaw.error ? modelRaw.error : null,
        modelChecks: toCheckArray(modelRaw).map(normalizeCheck),
    };
}

function statusEmoji(status) {
    return status === 'ready' ? '🟢' : status === 'needs-work' ? '🟡' : '🔴';
}

function statusLabel(status) {
    return status === 'ready' ? 'Ready' : status === 'needs-work' ? 'Needs Work' : 'Not Ready';
}

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function renderCheckSection(checks, suggestions = []) {
    const passed = checks.filter(c => c.passed);
    const failed = checks.filter(c => !c.passed);
    let out = '';

    if (passed.length > 0) {
        out += `### ✅ Passed (${passed.length})\n\n`;
        for (const c of passed) out += `- **${c.name}**: ${c.evidence || 'Check passed.'}\n`;
        out += '\n';
    }

    if (failed.length > 0) {
        out += `### ❌ Needs Improvement (${failed.length})\n\n`;
        for (const c of failed) {
            const suggestion = suggestions.find(s => s.check === c.name);
            out += `- **${c.name}**: ${c.reason}\n`;
            // Suggestions are now only shown in `phrom improve`, not in standard reports
            // if (suggestion && suggestion.after) {
            //   out += ` - 💡 **How to fix:** ${suggestion.suggestion}\n`;
            //   out += ` - **Instead of:** \`${suggestion.before || 'current content'}\`\n`;
            //   out += ` - **Write:** \`${suggestion.after.slice(0, 100)}${suggestion.after.length > 100 ? '...' : ''}\`\n`;
            // }
            out += '\n';
        }
    }

    if (checks.length === 0) out += `_No checks available._\n\n`;
    return out;
}

// ---------- Einzelreport ----------

/**
 * @param {Object} result - Verarbeitetes Issue-Ergebnis
 * @param {string} [type] - story | task | bug | epic
 * @returns {string} Markdown
 */
export function generateMarkdownReport(result, type) {
    const r = normalizeResult(result, type);
    const failedChecks = r.checks.filter(c => !c.passed);
    const aiPassedCount = r.modelChecks.filter(c => c.passed).length;

    // NO IMPROVEMENT SUGGESTIONS HERE – only via `phrom improve`
    const suggestions = [];
    const revisedDraft = '';

    let report = `# ${statusEmoji(r.status)} Issue #${r.number}: "${r.title}"\n\n`;
    report += `**Type:** ${capitalize(r.type)} \n`;
    report += `**Score:** ${r.score}/100 \n`;
    report += `**Status:** ${statusLabel(r.status)} \n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `---\n\n## 📝 Summary\n\n${r.summary}\n\n---\n\n`;

    if (r.type === 'epic') {
        report += `## 🎯 Epic Definition\n\n`;
        report += `An Epic is a large body of work that can be broken down into multiple user stories. It should have:\n`;
        report += `- A clear, measurable goal\n- Quantified benefits for stakeholders\n- A list of child stories\n\n---\n\n`;
    } else if (r.type === 'task') {
        report += `## 🔧 Technical Task Definition\n\n`;
        report += `A Technical Task describes work that is not user-facing (e.g., infrastructure, refactoring, migrations). It should have:\n`;
        report += `- Clear technical scope\n- Justification (why is this needed?)\n- Impact analysis\n- Rollback plan\n\n---\n\n`;
    } else if (r.type === 'bug') {
        report += `## 🐛 Bug Report Definition\n\n`;
        report += `A Bug Report describes unexpected behavior. It should have:\n`;
        report += `- Reproduction steps (numbered, ≥2 steps)\n- Expected vs. actual behavior\n- Environment info (browser, OS, device)\n\n---\n\n`;
    }

    report += `## ✅ Deterministic Checks (Rule-Based)\n\n`;
    report += renderCheckSection(r.checks, suggestions.filter(s => s.type === 'deterministic'));
    report += `---\n\n`;

    report += `## 🤖 AI-Powered Checks (LLM-Based)\n\n`;
    if (r.modelError) {
        report += `⚠️ Model checks failed: ${r.modelError}\n\n`;
    } else {
        report += renderCheckSection(r.modelChecks, suggestions.filter(s => s.type === 'ai'));
    }
    report += `---\n\n`;

    if (r.type === 'story') {
        report += `## ⚠️ Mandatory Requirements (Definition of Ready)\n\n`;
        report += `These must be met before refinement:\n\n`;
        report += `- [ ] **Happy Path AC**: At least one acceptance criterion describes the success scenario.\n`;
        report += `- [ ] **Error Case AC**: At least one acceptance criterion describes error handling.\n`;
        report += `- [ ] **Testable**: All AC can be verified with pass/fail.\n\n---\n\n`;
    }

    // Improvement Suggestions Section – REMOVED (only in `phrom improve`)
    // The section below will now always show "No improvements needed" or be omitted.
    // We keep the structure but it will be empty.

    report += `## 🎯 Next Steps\n\n`;
    if (r.status === 'ready') {
        report += `✅ This issue is ready for refinement. No action needed.\n\n`;
    } else if (r.status === 'needs-work') {
        report += `🔧 **Recommended actions before refinement:**\n\n`;
        report += `1. Address the failed checks above (especially deterministic checks).\n`;
        report += `2. Run \`phrom improve ${r.number}\` for concrete improvement suggestions.\n`;
        report += `3. Ensure acceptance criteria are testable (SMART).\n\n`;
    } else {
        report += `🚨 **Critical issues must be fixed before refinement:**\n\n`;
        const top = failedChecks.slice(0, 3);
        if (top.length > 0) {
            top.forEach((c, i) => { report += `${i + 1}. ${c.reason}\n`; });
            report += `\n`;
        } else {
            report += `1. Review the AI-powered findings above.\n\n`;
        }
    }

    report += `---\n\n`;
    report += `*Generated by Phrom Agent (Phase 2) – Deterministic checks: ${r.checks.filter(c => c.passed).length}/${r.checks.length} passed | AI checks: ${aiPassedCount}/${r.modelChecks.length} passed*\n`;

    return report;
}

// ---------- Summary ----------

/**
 * @param {Array} results - Alle verarbeiteten Issue-Ergebnisse
 * @returns {string} Markdown
 */
export function generateSummaryReport(results) {
    const items = (results || []).map(r => normalizeResult(r));
    const total = items.length;
    const pct = n => (total > 0 ? Math.round((n / total) * 100) : 0);

    const ready = items.filter(r => r.status === 'ready');
    const needsWork = items.filter(r => r.status === 'needs-work');
    const notReady = items.filter(r => r.status === 'not-ready');

    const byType = {};
    for (const r of items) {
        const t = r.type || 'unknown';
        if (!byType[t]) byType[t] = { ready: 0, needsWork: 0, notReady: 0, total: 0 };
        byType[t].total++;
        if (r.status === 'ready') byType[t].ready++;
        else if (r.status === 'needs-work') byType[t].needsWork++;
        else byType[t].notReady++;
    }

    const typeOrder = ['story', 'task', 'bug', 'epic'];
    const sortedTypes = Object.keys(byType).sort((a, b) => {
        const ai = typeOrder.indexOf(a);
        const bi = typeOrder.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    const listSection = (title, list, emptyText) => {
        let out = `## ${title} (${list.length})\n\n`;
        if (list.length > 0) {
            for (const r of list) out += `- **#${r.number}** (${capitalize(r.type)}): "${r.title}" – ${r.score}/100\n`;
        } else {
            out += `${emptyText}\n`;
        }
        return out + `\n---\n\n`;
    };

    let report = `# 🤖 Phrom Summary Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n---\n\n`;

    report += `## 📊 Overview\n\n`;
    report += `| Status | Count | Percentage |\n|--------|-------|------------|\n`;
    report += `| 🟢 Ready | ${ready.length} | ${pct(ready.length)}% |\n`;
    report += `| 🟡 Needs work | ${needsWork.length} | ${pct(needsWork.length)}% |\n`;
    report += `| 🔴 Not ready | ${notReady.length} | ${pct(notReady.length)}% |\n`;
    report += `| **Total** | **${total}** | **100%** |\n\n---\n\n`;

    report += `## 📋 Breakdown by Type\n\n`;
    report += `| Type | 🟢 Ready | 🟡 Needs Work | 🔴 Not Ready | Total |\n`;
    report += `|------|----------|---------------|--------------|-------|\n`;
    for (const t of sortedTypes) {
        const c = byType[t];
        report += `| ${capitalize(t)} | ${c.ready} | ${c.needsWork} | ${c.notReady} | ${c.total} |\n`;
    }

    report += `\n---\n\n`;

    report += listSection('🟢 Ready Issues', ready, 'No issues ready.');
    report += listSection('🟡 Needs Work', needsWork, 'No issues need work.');
    report += listSection('🔴 Not Ready', notReady, 'No issues not ready.');

    report += `## 🎯 Top 3 Priorities\n\n`;
    const priorities = [...items].sort((a, b) => a.score - b.score).slice(0, 3);
    priorities.forEach((r, i) => {
        report += `${i + 1}. **#${r.number} "${r.title}"** (${capitalize(r.type)}) – Score: ${r.score}/100\n`;
        const reasons = r.checks.filter(c => !c.passed).slice(0, 2).map(c => c.reason).join('; ');
        if (reasons) report += ` - ${reasons}\n`;
    });
    report += `\n---\n\n`;

    report += `## ℹ️ About This Report\n\n`;
    report += `- **Deterministic checks**: Rule-based (regex, pattern matching) – 100% reliable, instant.\n`;
    report += `- **AI-powered checks**: LLM-based (Ollama) – evaluates testability, value, risk.\n`;
    report += `- **Score**: Type-specific (0–100 points).\n`;
    report += `- **Status**: 🟢 Ready (≥80), 🟡 Needs Work (50–79), 🔴 Not Ready (<50).\n\n`;
    report += `*Generated by Phrom Agent (Phase 2)*\n`;

    return report;
}