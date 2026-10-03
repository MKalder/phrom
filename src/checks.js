/**
 * checks.js – Deterministische Prüfungen für Phrom (verbesserte Version).
 *
 * Diese Funktionen prüfen Issues ohne Modell, rein regelbasiert.
 * Rückgabe: { passed: boolean, evidence?: string, reason?: string }
 */

/**
 * checkStoryFormat(body) – Prüft das Story-Format.
 * Erkennt deutsche und englische Varianten sowie alternative Formate.
 */
export function checkStoryFormat(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  // Deutsch: "Als... möchte ich... damit..." ODER "Als... möchte ich... um... zu..."
  const germanPatterns = [
    /als\s+\w+.*\s+möchte\s+ich\s+.*\s+damit\s+.*/i,
    /als\s+\w+.*\s+möchte\s+ich\s+.*\s+um\s+.*\s+zu\s+.*/i,
    /als\s+\w+.*\s+will\s+ich\s+.*\s+damit\s+.*/i,
  ];

  // Englisch: "As a... I want/need... so that/in order to..."
  const englishPatterns = [
    /as\s+a\s+\w+.*\s+i\s+want\s+.*\s+so\s+that\s+.*/i,
    /as\s+a\s+\w+.*\s+i\s+want\s+.*\s+in\s+order\s+to\s+.*/i,
    /as\s+a\s+\w+.*\s+i\s+need\s+.*\s+so\s+that\s+.*/i,
    /as\s+a\s+\w+.*\s+i\s+should\s+be\s+able\s+to\s+.*\s+so\s+that\s+.*/i,
  ];

  // Alternative Formate (ohne explizite "so that"-Klausel)
  const alternativePatterns = [
    /in\s+order\s+to\s+.*,\s*as\s+a\s+\w+.*\s+i\s+want\s+.*/i,
    /um\s+.*\s+zu\s+.*,\s*als\s+\w+.*\s+möchte\s+ich\s+.*/i,
  ];

  const allPatterns = [...germanPatterns, ...englishPatterns, ...alternativePatterns];
  const matchedPattern = allPatterns.find(pattern => pattern.test(body));

  if (matchedPattern) {
    return { 
      passed: true, 
      evidence: "Story format found (recognized pattern)" 
    };
  }

  // Fallback: Prüfen, ob zumindest die Kern-Elemente vorhanden sind
  const hasRole = /(als|as)\s+(a\s+)?\w+/i.test(body);
  const hasWant = /(möchte|will|want|need|should be able to)/i.test(body);
  const hasWhy = /(damit|um.*zu|so that|in order to)/i.test(body);

  if (hasRole && hasWant && hasWhy) {
    return { 
      passed: true, 
      evidence: "Story elements found (role, want, why), but not in standard format" 
    };
  }

  return { 
    passed: false, 
    reason: "No story format found. Expected: \'As a [role], I want [goal] so that [benefit]\' or \'Als [Rolle], möchte ich [Ziel] damit [Nutzen]\'" 
  };
}

/**
 * checkContext(body) – Prüft, ob Kontext (Produkt, Zielgruppe) benannt ist.
 */
export function checkContext(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  // Erweiterte Keyword-Listen
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

  // Pattern für explizite Kontext-Nennung
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

  return { 
    passed: true, 
    evidence: `Context keywords found: ${evidence.join("; ")}` 
  };
}

/**
 * checkEpicLink(body) – Prüft, ob ein Epic-Link (z. B. "#1") vorhanden ist.
 * Kontextsensitiv: Unterscheidet zwischen Epic-Link und allgemeinen Referenzen.
 */
export function checkEpicLink(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  // Issue-Referenzen finden (auch cross-repo: owner/repo#123)
  const issueRegex = /(?:[\w-]+\/[\w-]+)?#\d+/g;
  const matches = body.match(issueRegex) || [];

  if (matches.length === 0) {
    return { passed: false, reason: "No epic link (e.g., \'#1\' or \'owner/repo#1\') found" };
  }

  // Prüfen, ob die Referenz im Kontext eines Epics steht
  const epicContextKeywords = [
    "epic", "parent", "part of", "belongs to", "under",
    "related to", "tracking", "initiative"
  ];

  const hasEpicContext = epicContextKeywords.some(keyword => 
    body.toLowerCase().includes(keyword)
  );

  // Wenn keine Epic-Keywords, aber nur EINE Referenz → wahrscheinlich Epic-Link
  if (matches.length === 1 && !hasEpicContext) {
    return { 
      passed: true, 
      evidence: `Epic link found: ${matches[0]} (single reference, likely parent epic)` 
    };
  }

  // Wenn Epic-Keywords vorhanden → wahrscheinlich intentional
  if (hasEpicContext) {
    return { 
      passed: true, 
      evidence: `Epic link(s) found: ${matches.join(", ")} (with epic context)` 
    };
  }

  // Mehrere Referenzen ohne Kontext → unklar, welche die Epic-Referenz ist
  return { 
    passed: false, 
    reason: `Multiple issue references found (${matches.join(", ")}), but no epic context. Please specify which is the parent epic.` 
  };
}

/**
 * checkACPresence(body) – Prüft, ob Acceptance Criteria vorhanden sind.
 * Erkennt Checklisten, Gherkin-Szenarien und freitextliche AC.
 */
export function checkACPresence(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  // 1. Checklisten-Items zählen (Markdown: - [ ] oder * [ ])
  const checklistPattern = /^[\s]*[-*]\s*\[\s*\]\s+.*/gim;
  const checklistItems = body.match(checklistPattern) || [];

  // 2. Gherkin-Szenarien zählen (Given/When/Then)
  const gherkinPattern = /^(Given|When|Then|And|But)\s+/gim;
  const gherkinLines = body.match(gherkinPattern) || [];
  const gherkinScenarios = Math.ceil(gherkinLines.length / 3);  // Pro Scenario ~3 Zeilen

  // 3. AC-Section erkennen (überschriftenbasiert)
  const acSectionPattern = /(?:^|\n)\s*#+\s*(acceptance\s*(criteria)?|test\s*cases?|validation)\s*(?:\n|$)/i;
  const hasAcSection = acSectionPattern.test(body);

  // 4. Alternative Formate: "Must", "Should", "Verify that"
  const mustShouldPattern = /\b(must|should|verify that|it is required that)\b/gi;
  const mustShouldMatches = body.match(mustShouldPattern) || [];

  // Gesamtzahl der erkannten AC
  const totalAC = Math.max(
    checklistItems.length,
    gherkinScenarios,
    mustShouldMatches.length > 0 ? mustShouldMatches.length : 0
  );

  // Bewertung
  if (totalAC === 0 && !hasAcSection) {
    return { passed: false, reason: "No acceptance criteria section found" };
  }

  if (totalAC < 2) {
    return { 
      passed: false, 
      reason: `Only ${totalAC} acceptance criterion found; expected at least 2 (happy path + error case)` 
    };
  }

  // Prüfen, ob sowohl Happy Path als auch Error Case abgedeckt sind
  const hasHappyPath = /(successfully|happy path|normal case|standard flow)/i.test(body);
  const hasErrorCase = /(error|fail|invalid|exception|edge case|boundary)/i.test(body);

  if (!hasHappyPath || !hasErrorCase) {
    return { 
      passed: true, 
      evidence: `${totalAC} acceptance criteria found, but consider adding ${!hasHappyPath ? "a happy path" : ""}${!hasHappyPath && !hasErrorCase ? " and " : ""}${!hasErrorCase ? "an error case" : ""}` 
    };
  }

  return { 
    passed: true, 
    evidence: `${totalAC} acceptance criteria found (happy path + error case covered)` 
  };
}

/**
 * checkStoryLinks(body) – Prüft, ob Referenzen zu anderen Stories/Issues existieren.
 * Erkennt: "Depends on #123", "Blocks #456", "Related to #789"
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
    return { 
      passed: true, 
      evidence: "No explicit story links found (optional)" 
    };
  }

  const summary = Object.entries(foundLinks)
    .map(([type, links]) => `${type}: ${links.join(", ")}`)
    .join("; ");

  return { 
    passed: true, 
    evidence: `Story links found: ${summary}` 
  };
}
