/**
 * checks.js – Deterministische Prüfungen für Phrom.
 *
 * Diese Funktionen prüfen Issues ohne Modell, rein regelbasiert.
 * Rückgabe: { passed: boolean, evidence?: string, reason?: string }
 */

/**
 * checkStoryFormat(body) – Prüft das Story-Format.
 * Deutsch: "Als … möchte ich … damit …"
 * Englisch: "As a … I want … so that …"
 */
export function checkStoryFormat(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const germanPattern = /als\s+.*\s+möchte\s+ich\s+.*\s+damit\s+.*/i;
  const englishPattern = /as\s+a\s+.*\s+i\s+want\s+.*\s+so\s+that\s+.*/i;

  if (germanPattern.test(body) || englishPattern.test(body)) {
    return { passed: true, evidence: "Story format found" };
  }

  return { passed: false, reason: "No story format ('As a… I want… so that…' or 'Als… möchte ich… damit…') found" };
}

/**
 * checkContext(body) – Prüft, ob Kontext (Produkt, Zielgruppe) benannt ist.
 */
export function checkContext(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const contextKeywords = ["context", "product", "target group", "targetgroup", "zielgruppe", "kunde", "customer"];
  const found = contextKeywords.filter((kw) => body.toLowerCase().includes(kw));

  if (found.length > 0) {
    return { passed: true, evidence: `Context keywords found: ${found.join(", ")}` };
  }

  return { passed: false, reason: "No context (product, target group) found" };
}

/**
 * checkEpicLink(body) – Prüft, ob ein Epic-Link (z. B. "#1") vorhanden ist.
 */
export function checkEpicLink(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const epicPattern = /#\d+/;
  const match = body.match(epicPattern);

  if (match) {
    return { passed: true, evidence: `Epic link found: ${match[0]}` };
  }

  return { passed: false, reason: "No epic link (e.g., '#1') found" };
}

/**
 * checkACPresence(body) – Prüft, ob Acceptance Criteria vorhanden sind.
 * Zählt Checklisten-Punkte unter "Acceptance Criteria".
 * Erwartet: mindestens 1 Happy Path + 1 Error Case.
 */
export function checkACPresence(body) {
  if (!body) {
    return { passed: false, reason: "Body is empty" };
  }

  const acSectionPattern = /acceptance\s+criteria[\s\S]*?(-\s*\[\s*\]\s+.*)+/gi;
  const match = body.match(acSectionPattern);

  if (!match) {
    return { passed: false, reason: "No acceptance criteria section found" };
  }

  const checklistPattern = /-\s*\[\s*\]\s+.*/gi;
  const allChecklistItems = body.match(checklistPattern) || [];

  if (allChecklistItems.length < 2) {
    return { passed: false, reason: `Only ${allChecklistItems.length} acceptance criterion found; expected at least 2 (happy path + error case)` };
  }

  return { passed: true, evidence: `${allChecklistItems.length} acceptance criteria found` };
}
