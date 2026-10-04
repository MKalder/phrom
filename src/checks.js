/**
 * checks.js – Deterministische Prüfungen für Phrom (vollständig, alle Typen).
 *
 * Diese Funktionen prüfen Issues ohne Modell, rein regelbasiert.
 * Rückgabe: { passed: boolean, evidence?: string, reason?: string }
 */

/**
 * checkStoryFormat(body) – Prüft das Story-Format.
 */
export function checkStoryFormat(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const germanPatterns = [
    /als\s+\w+.*\s+möchte\s+ich\s+.*\s+damit\s+.*/i,
    /als\s+\w+.*\s+möchte\s+ich\s+.*\s+um\s+.*\s+zu\s+.*/i,
    /als\s+\w+.*\s+will\s+ich\s+.*\s+damit\s+.*/i,
  ];

  const englishPatterns = [
    /as\s+a\s+\w+.*\s+i\s+want\s+.*\s+so\s+that\s+.*/i,
    /as\s+a\s+\w+.*\s+i\s+want\s+.*\s+in\s+order\s+to\s+.*/i,
    /as\s+a\s+\w+.*\s+i\s+need\s+.*\s+so\s+that\s+.*/i,
    /as\s+a\s+\w+.*\s+i\s+should\s+be\s+able\s+to\s+.*\s+so\s+that\s+.*/i,
  ];

  const alternativePatterns = [
    /in\s+order\s+to\s+.*,\s*as\s+a\s+\w+.*\s+i\s+want\s+.*/i,
    /um\s+.*\s+zu\s+.*,\s*als\s+\w+.*\s+möchte\s+ich\s+.*/i,
  ];

  const allPatterns = [...germanPatterns, ...englishPatterns, ...alternativePatterns];
  const matchedPattern = allPatterns.find(pattern => pattern.test(body));

  if (matchedPattern) {
    return { passed: true, evidence: "Story format found (recognized pattern)" };
  }

  const hasRole = /(als|as)\s+(a\s+)?\w+/i.test(body);
  const hasWant = /(möchte|will|want|need|should be able to)/i.test(body);
  const hasWhy = /(damit|um.*zu|so that|in order to)/i.test(body);

  if (hasRole && hasWant && hasWhy) {
    return { passed: true, evidence: "Story elements found (role, want, why), but not in standard format" };
  }

  return { passed: false, reason: "No story format found. Expected: \'As a [role], I want [goal] so that [benefit]\' or \'Als [Rolle], möchte ich [Ziel] damit [Nutzen]\'" };
}

/**
 * checkContext(body) – Prüft, ob Kontext (Produkt, Zielgruppe) benannt ist.
 */
export function checkContext(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const productKeywords = [
    "product", "feature", "system", "module", "component",
    "portal", "app", "application", "platform", "service"
  ];

  const userKeywords = [
    "user", "customer", "client", "consumer", "end user",
    "admin", "operator", "stakeholder", "role",
    "zielgruppe", "kunde", "benutzer", "anwender"
  ];

  const businessKeywords = [
    "business", "value", "benefit", "goal", "objective",
    "requirement", "need", "pain point", "problem"
  ];

  const contextPatterns = [
    /as a\s+(user|customer|admin|role)/i,
    /for\s+(the\s+)?(user|customer|client)/i,
    /in the\s+(product|system|app)/i,
    /within the\s+(context|scope)/i,
  ];

  const foundProduct = productKeywords.filter(kw => body.toLowerCase().includes(kw));
  const foundUser = userKeywords.filter(kw => body.toLowerCase().includes(kw));
  const foundBusiness = businessKeywords.filter(kw => body.toLowerCase().includes(kw));
  const matchedPattern = contextPatterns.some(p => p.test(body));

  const totalMatches = foundProduct.length + foundUser.length + foundBusiness.length + (matchedPattern ? 1 : 0);

  if (totalMatches === 0) {
    return { passed: false, reason: "No context (product, target group, or business value) found" };
  }

  const evidence = [
    foundProduct.length > 0 ? `Product: ${foundProduct.slice(0, 2).join(", ")}` : null,
    foundUser.length > 0 ? `User: ${foundUser.slice(0, 2).join(", ")}` : null,
    foundBusiness.length > 0 ? `Business: ${foundBusiness.slice(0, 2).join(", ")}` : null,
  ].filter(Boolean);

  return { passed: true, evidence: `Context keywords found: ${evidence.join("; ")}` };
}

/**
 * checkEpicLink(body) – Prüft, ob ein Epic-Link vorhanden ist.
 */
export function checkEpicLink(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const issueRegex = /(?:[\w-]+\/[\w-]+)?#\d+/g;
  const matches = body.match(issueRegex) || [];

  if (matches.length === 0) {
    return { passed: false, reason: "No epic link (e.g., \'#1\' or \'owner/repo#1\') found" };
  }

  const epicContextKeywords = [
    "epic", "parent", "part of", "belongs to", "under",
    "related to", "tracking", "initiative"
  ];

  const hasEpicContext = epicContextKeywords.some(keyword => body.toLowerCase().includes(keyword));

  if (matches.length === 1 && !hasEpicContext) {
    return { passed: true, evidence: `Epic link found: ${matches[0]} (single reference, likely parent epic)` };
  }

  if (hasEpicContext) {
    return { passed: true, evidence: `Epic link(s) found: ${matches.join(", ")} (with epic context)` };
  }

  return { passed: false, reason: `Multiple issue references found (${matches.join(", ")}), but no epic context. Please specify which is the parent epic.` };
}

/**
 * checkACPresence(body) – Prüft, ob Acceptance Criteria vorhanden sind.
 */
export function checkACPresence(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const checklistPattern = /^[\s]*[-*]\s*\[\s*\]\s+.*/gim;
  const checklistItems = body.match(checklistPattern) || [];

  const gherkinPattern = /^(Given|When|Then|And|But)\s+/gim;
  const gherkinLines = body.match(gherkinPattern) || [];
  const gherkinScenarios = Math.ceil(gherkinLines.length / 3);

  const acSectionPattern = /(?:^|\n)\s*#+\s*(acceptance\s*(criteria)?|test\s*cases?|validation)\s*(?:\n|$)/i;
  const hasAcSection = acSectionPattern.test(body);

  const mustShouldPattern = /\b(must|should|verify that|it is required that)\b/gi;
  const mustShouldMatches = body.match(mustShouldPattern) || [];

  const totalAC = Math.max(
    checklistItems.length,
    gherkinScenarios,
    mustShouldMatches.length > 0 ? mustShouldMatches.length : 0
  );

  if (totalAC === 0 && !hasAcSection) {
    return { passed: false, reason: "No acceptance criteria section found" };
  }

  if (totalAC < 2) {
    return { passed: false, reason: `Only ${totalAC} acceptance criterion found; expected at least 2 (happy path + error case)` };
  }

  const hasHappyPath = /(successfully|happy path|normal case|standard flow)/i.test(body);
  const hasErrorCase = /(error|fail|invalid|exception|edge case|boundary)/i.test(body);

  if (!hasHappyPath || !hasErrorCase) {
    return { passed: true, evidence: `${totalAC} acceptance criteria found, but consider adding ${!hasHappyPath ? "a happy path" : ""}${!hasHappyPath && !hasErrorCase ? " and " : ""}${!hasErrorCase ? "an error case" : ""}` };
  }

  return { passed: true, evidence: `${totalAC} acceptance criteria found (happy path + error case covered)` };
}

/**
 * checkStoryLinks(body) – Prüft, ob Referenzen zu anderen Stories/Issues existieren.
 */
export function checkStoryLinks(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const linkPatterns = {
    depends: /(?:depends?\s*(?:on)?|blocked\s*(?:by)?|requires?)\s*#?\d+/gi,
    blocks: /(?:blocks?|prevents?|stops?)\s*#?\d+/gi,
    related: /(?:related\s*(?:to)?|see\s*also|refer\s*(?:to)?|compare)\s*#?\d+/gi,
    duplicates: /(?:duplicates?|duplicate\s*of|same\s*as)\s*#?\d+/gi,
  };

  const foundLinks = {};
  for (const [type, pattern] of Object.entries(linkPatterns)) {
    const matches = body.match(pattern) || [];
    if (matches.length > 0) {
      foundLinks[type] = matches;
    }
  }

  if (Object.keys(foundLinks).length === 0) {
    return { passed: true, evidence: "No explicit story links found (optional)" };
  }

  const summary = Object.entries(foundLinks)
    .map(([type, links]) => `${type}: ${links.join(", ")}`)
    .join("; ");

  return { passed: true, evidence: `Story links found: ${summary}` };
}

// =============================================================================
// TASK-SPECIFIC CHECKS
// =============================================================================

/**
 * checkTechnicalScope(body) – Prüft, ob der technische Umfang klar definiert ist.
 */
export function checkTechnicalScope(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const scopePatterns = [
    /##?\s*(what|scope|technical\s*scope)/i,
    /-\s*(upgrade|migrate|implement|create|update|configure|refactor)/i,
  ];

  const hasScopeSection = scopePatterns.some(pattern => pattern.test(body));

  if (!hasScopeSection) {
    return { passed: false, reason: "No clear technical scope section found. Add a \'What\' or \'Scope\' section with specific work items." };
  }

  const actionVerbs = [
    "upgrade", "migrate", "implement", "create", "update", "configure",
    "refactor", "deploy", "setup", "install", "remove", "add"
  ];

  const lines = body.split('\n');
  const actionLines = lines.filter(line => {
    const lowerLine = line.toLowerCase();
    return actionVerbs.some(verb => lowerLine.includes(verb)) &&
      (line.trim().startsWith('-') || line.trim().startsWith('*'));
  });

  if (actionLines.length < 2) {
    return { passed: false, reason: `Only ${actionLines.length} action item found. Expected at least 2 specific work items.` };
  }

  return { passed: true, evidence: `${actionLines.length} technical work items identified (e.g., "${actionLines[0].trim()}")` };
}

/**
 * checkJustification(body) – Prüft, ob die Begründung (Warum) dokumentiert ist.
 */
export function checkJustification(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const justificationPatterns = [
    /##?\s*(why|reason|justification|background|motivation)/i,
    /\b(eol|end-of-life|security|compliance|performance|debt|deprecated)\b/i,
  ];

  const hasJustification = justificationPatterns.some(pattern => pattern.test(body));

  if (!hasJustification) {
    return { passed: false, reason: "No justification section found. Add a \'Why\' section explaining the driver (e.g., EOL date, security requirement, performance need)." };
  }

  const hasEOL = /\b(eol|end-of-life|Q\d|202\d)\b/i.test(body);
  const hasSecurity = /\bsecurity\b/i.test(body);
  const hasPerformance = /\bperformance\b/i.test(body);
  const hasCompliance = /\bcompliance\b/i.test(body);

  const drivers = [];
  if (hasEOL) drivers.push("EOL/deprecation");
  if (hasSecurity) drivers.push("security");
  if (hasPerformance) drivers.push("performance");
  if (hasCompliance) drivers.push("compliance");

  if (drivers.length === 0) {
    return { passed: false, reason: "Justification section exists but lacks concrete driver (EOL date, security requirement, performance need, compliance)." };
  }

  return { passed: true, evidence: `Justification includes: ${drivers.join(", ")}` };
}

/**
 * checkImpactAnalysis(body) – Prüft, ob Impact-Analyse vorhanden ist.
 */
export function checkImpactAnalysis(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const impactPatterns = [
    /##?\s*(impact|affected|downtime|risks)/i,
    /\b(affected\s*systems|downtime|maintenance\s*window|rollback)\b/i,
  ];

  const hasImpact = impactPatterns.some(pattern => pattern.test(body));

  if (!hasImpact) {
    return { passed: false, reason: "No impact analysis section found. Add an \'Impact\' section listing affected systems, planned downtime, and risks." };
  }

  const hasAffectedSystems = /\b(affected\s*systems|databases|services)\b/i.test(body);
  const hasDowntime = /\b(downtime|window|maintenance)\b/i.test(body);
  const hasRisks = /\b(risks|risk)\b/i.test(body);

  const elements = [];
  if (hasAffectedSystems) elements.push("affected systems");
  if (hasDowntime) elements.push("downtime/window");
  if (hasRisks) elements.push("risks");

  if (elements.length < 2) {
    return { passed: false, reason: `Impact section exists but incomplete. Found: ${elements.join(", ")}. Missing: ${elements.length === 1 ? "affected systems + downtime/risks" : "additional elements"}.` };
  }

  return { passed: true, evidence: `Impact analysis includes: ${elements.join(", ")}` };
}

/**
 * checkRollbackPlan(body) – Prüft, ob ein Rollback-Plan dokumentiert ist.
 */
export function checkRollbackPlan(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const hasRollbackSection = /##?\s*rollback/i.test(body);

  if (!hasRollbackSection) {
    return { passed: false, reason: "No rollback plan section found. For production-impacting tasks, a tested rollback procedure is mandatory." };
  }

  const hasProcedure = /\b(procedure|steps|restore|backup)\b/i.test(body);
  const hasTested = /\b(tested|test)\b/i.test(body);
  const hasTimeEstimate = /\b(\d+\s*(minutes?|hours?)|within\s+\d+)\b/i.test(body);
  const hasLocation = /\b(runbook|documented\s*in|location)\b/i.test(body);

  const details = [];
  if (hasProcedure) details.push("procedure");
  if (hasTested) details.push("tested");
  if (hasTimeEstimate) details.push("time estimate");
  if (hasLocation) details.push("location (runbook)");

  if (details.length < 2) {
    return { passed: false, reason: `Rollback section exists but incomplete. Found: ${details.join(", ")}. Add: procedure details, testing status, time estimate, and runbook location.` };
  }

  return { passed: true, evidence: `Rollback plan includes: ${details.join(", ")}` };
}

// =============================================================================
// BUG-SPECIFIC CHECKS
// =============================================================================

/**
 * checkReproductionSteps(body) – Prüft, ob Reproduktionsschritte dokumentiert sind.
 */
export function checkReproductionSteps(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const reproductionPatterns = [
    /##?\s*(steps?\s*(to\s*)?reproduce|reproduction|how\s*to\s*reproduce)/i,
    /^\d+\.\s+/m,
    /step\s*\d*:?\s*/i,
  ];

  const hasReproduction = reproductionPatterns.some(pattern => pattern.test(body));

  if (!hasReproduction) {
    return { passed: false, reason: "No reproduction steps found. Add numbered steps to reproduce the bug (e.g., \'1. Go to..., 2. Click..., 3. Observe error\')." };
  }

  const numberedSteps = body.match(/^\d+\.\s+/gm) || [];
  const stepXSteps = body.match(/step\s*\d*:?\s*/gi) || [];
  const totalSteps = Math.max(numberedSteps.length, stepXSteps.length);

  if (totalSteps < 2) {
    return { passed: false, reason: `Only ${totalSteps} reproduction step found. Expected at least 2-3 steps for proper reproduction.` };
  }

  return { passed: true, evidence: `${totalSteps} reproduction steps documented` };
}

/**
 * checkExpectedVsActual(body) – Prüft, ob Expected vs. Actual Behavior beschrieben ist.
 */
export function checkExpectedVsActual(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const expectedPatterns = [
    /##?\s*(expected|actual|behavior|result)/i,
    /\bexpected\s*(behavior|result|outcome)/i,
    /\bactual\s*(behavior|result|outcome)/i,
    /\binstead\s*(of|got)/i,
  ];

  const hasExpectedVsActual = expectedPatterns.some(pattern => pattern.test(body));

  if (!hasExpectedVsActual) {
    return { passed: false, reason: "No \'Expected vs. Actual\' section found. Add clear description of expected behavior and actual behavior (e.g., \'Expected: PDF downloads. Actual: Error 500\')." };
  }

  const hasExpected = /\bexpected\b/i.test(body);
  const hasActual = /\b(actual|instead|but got)\b/i.test(body);

  if (!hasExpected || !hasActual) {
    return { passed: false, reason: "Expected vs. Actual section exists but incomplete. Ensure both expected behavior AND actual behavior are described." };
  }

  return { passed: true, evidence: "Expected and actual behavior documented" };
}

/**
 * checkEnvironmentInfo(body) – Prüft, ob Umgebungsinformationen vorhanden sind.
 */
export function checkEnvironmentInfo(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const environmentPatterns = [
    /##?\s*(environment|system\s*info|configuration)/i,
    /\b(browser|os|version|device|platform|ios|android|windows|mac|safari|chrome|firefox)\b/i,
  ];

  const hasEnvironment = environmentPatterns.some(pattern => pattern.test(body));

  if (!hasEnvironment) {
    return { passed: false, reason: "No environment information found. Add details about browser, OS, device, and version where the bug occurs." };
  }

  const details = [];
  if (/\bbrowser\b/i.test(body)) details.push("browser");
  if (/\b(os|operating\s*system)\b/i.test(body)) details.push("OS");
  if (/\bversion\b/i.test(body)) details.push("version");
  if (/\b(device|mobile|ios|android)\b/i.test(body)) details.push("device/platform");

  if (details.length < 2) {
    return { passed: false, reason: `Environment section exists but incomplete. Found: ${details.join(", ")}. Add at least 2-3 details (browser, OS, version, device).` };
  }

  return { passed: true, evidence: `Environment info includes: ${details.join(", ")}` };
}

// =============================================================================
// EPIC-SPECIFIC CHECKS
// =============================================================================

/**
 * checkGoalStatement(body) – Prüft, ob ein SMART-Epic-Goal formuliert ist.
 */
export function checkGoalStatement(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const goalPatterns = [
    /##?\s*(goal|objective|aim|purpose)/i,
    /\bgoal\s*is\s*to\b/i,
    /\bobjective\s*is\s*to\b/i,
  ];

  const hasGoal = goalPatterns.some(pattern => pattern.test(body));

  if (!hasGoal) {
    return { passed: false, reason: "No goal statement found. Add a \'Goal\' section with a SMART objective (Specific, Measurable, Achievable, Relevant, Time-bound)." };
  }

  const hasSpecific = /\b(specific|clear|defined)\b/i.test(body);
  const hasMeasurable = /\b(\d+\s*%|reduce|increase|within|by\s*Q\d|deadline)\b/i.test(body);
  const hasTimebound = /\b(by\s*\d{4}|Q\d|deadline|target\s*date)\b/i.test(body);

  const smartElements = [];
  if (hasSpecific) smartElements.push("specific");
  if (hasMeasurable) smartElements.push("measurable");
  if (hasTimebound) smartElements.push("time-bound");

  if (smartElements.length < 2) {
    return { passed: false, reason: `Goal statement exists but lacks SMART criteria. Found: ${smartElements.join(", ")}. Add measurable target and/or deadline.` };
  }

  return { passed: true, evidence: `SMART goal includes: ${smartElements.join(", ")}` };
}

/**
 * checkBenefitStatement(body) – Prüft, ob der Epic-Benefit quantifiziert ist.
 */
export function checkBenefitStatement(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const benefitPatterns = [
    /##?\s*(benefit|value|impact|outcome)/i,
    /\bbenefit\s*(is|will\s*be)\b/i,
    /\bvalue\s*(is|will\s*be)\b/i,
  ];

  const hasBenefit = benefitPatterns.some(pattern => pattern.test(body));

  if (!hasBenefit) {
    return { passed: false, reason: "No benefit statement found. Add a \'Benefit\' section quantifying who gains what (e.g., \'Customers save 10 minutes/month\')." };
  }

  const hasQuantified = /\b(\d+\s*(%|minutes?|hours?|tickets?|dollars?|€)|reduce|increase|save)\b/i.test(body);
  const hasStakeholder = /\b(customer|user|support|team|business|revenue)\b/i.test(body);

  if (!hasQuantified) {
    return { passed: false, reason: "Benefit statement exists but lacks quantification. Add specific numbers (e.g., \'reduce support tickets by 30%\')." };
  }

  const details = [];
  if (hasQuantified) details.push("quantified");
  if (hasStakeholder) details.push("stakeholder identified");

  return { passed: true, evidence: `Benefit statement is ${details.join(" + ")}` };
}

/**
 * checkStoryList(body) – Prüft, ob Child-Stories verlinkt sind.
 */
export function checkStoryList(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const storyListPatterns = [
    /##?\s*(stories|child\s*stories|related\s*stories|scope)/i,
    /#\d+/g,
  ];

  const hasStoryList = storyListPatterns.some(pattern => pattern.test(body));

  if (!hasStoryList) {
    return { passed: false, reason: "No story list found. Add a \'Stories\' section listing child stories (e.g., \'#2, #7, #11\')." };
  }

  const issueRefs = body.match(/#\d+/g) || [];

  if (issueRefs.length === 0) {
    return { passed: false, reason: "Story list section exists but no issue references found. Add links to child stories (e.g., \'#2 Download invoice\')." };
  }

  return { passed: true, evidence: `${issueRefs.length} child story/stories referenced: ${issueRefs.slice(0, 5).join(", ")}${issueRefs.length > 5 ? "..." : ""}` };
}
