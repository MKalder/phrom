# Phrom Regelwerk

**Version:** 0.3.0 (Entwurf)
**Stand:** 2026-10-06
**Geltungsbereich:** Vorprüfung von GitHub Issues vor dem Backlog Refinement

Dieses Dokument beschreibt, was Phrom prüft, wie der Score entsteht und wann ein Issue als „Ready“ gilt. Es ist **keine Definition of Done** und entscheidet nicht über Sprint-Reife. Die Kriterien selbst stehen maschinenlesbar in `criteria/*.json`, die Punktgewichte und Pflichtmarkierungen werden von dort gelesen.

---

## Inhaltsverzeichnis

- [Überblick](#überblick)
- [Typ-Erkennung](#typ-erkennung)
- [Score und Ready Gate](#score-und-ready-gate)
- [Kriterien pro Typ](#kriterien-pro-typ)
- [Deterministische Prüfregeln](#deterministische-prüfregeln)
- [KI-Prüfungen](#ki-prüfungen)
- [Schnellstatus](#schnellstatus-phrom-status)
- [Beispiele](#beispiele)
- [Grenzen der Prüfung](#grenzen-der-prüfung)
- [Geplante Kriterien](#geplante-kriterien)

---

## Überblick

Phrom bewertet jedes Issue in zwei Ebenen:

1. **Score (0–100):** Anteil der erreichten Punkte an den erreichbaren Punkten.
2. **Ready Gate:** Alle als **Pflicht** markierten Kriterien müssen bestehen.

| Status        | Bedingung                                      |
| ------------- | ---------------------------------------------- |
| 🟢 Ready      | Ready Gate bestanden **und** Score ≥ 80        |
| 🟡 Needs work | Ready Gate bestanden **und** Score 50–79       |
| 🔴 Not ready  | Ready Gate nicht bestanden **oder** Score < 50 |

**Das Ready Gate überstimmt den Score.** Fällt ein Pflichtkriterium durch, ist das Issue 🔴, unabhängig von der Punktzahl. Der Score zeigt den Fortschritt, das Gate entscheidet.

Es gibt zwei Arten von Kriterien:

- **Deterministisch (`code`):** Regelbasiert in Code geprüft, in Millisekunden, reproduzierbar.
- **KI (`model`):** Ein lokales Modell liefert eine begründete Einschätzung. Das ist eine Einschätzung, keine Tatsache.

„Bereit für das Refinement“ ist nicht dasselbe wie „bereit für das Sprint Planning“. Phrom priorisiert nicht, schätzt nicht und bestätigt keine technische Machbarkeit.

---

## Typ-Erkennung

Der Typ bestimmt, welche Kriterien gelten.

1. **Label:** `type:epic`, `type:story`, `type:task` oder `type:bug`.
2. **Fallback bei fehlendem Label:** Das Modell ordnet das Issue genau einem der vier Typen zu (mit Angabe der Sicherheit `high`, `medium` oder `low` und Begründung). Dieser Fallback greift in `run`, `select` und `improve`.
3. `phrom filter <type>` berücksichtigt nur Issues mit Label. `phrom status` wendet bei fehlendem Label die Story-Prüfungen an.

---

## Score und Ready Gate

**Score** = `round(erreichte Punkte ÷ erreichbare Punkte × 100)`

- Ein Kriterium vergibt seine Punkte vollständig oder gar nicht.
- Erreichbar sind nur Kriterien, die implementiert sind (`implemented` ist nicht `false`) und Punkte tragen.
- Die Summe der Punkte pro Typ steht in `scoring.totalPoints` der jeweiligen JSON-Datei. Story und Task summieren auf 100, Epic auf 90 und Bug auf 105; der Score wird deshalb auf 100 normiert.

**Ready Gate:** Für jedes Pflichtkriterium muss ein Ergebnis vorliegen **und** bestanden sein. Fehlt ein Ergebnis (z. B. weil Ollama nicht erreichbar war), gilt das Kriterium als nicht bestanden. Das Issue wird dann als 🔴 geführt.

```javascript
function calculateStatus(score, gateFailed) {
  if (gateFailed) return { status: "not-ready", emoji: "🔴" };
  if (score >= 80) return { status: "ready", emoji: "🟢" };
  if (score >= 50) return { status: "needs-work", emoji: "🟡" };
  return { status: "not-ready", emoji: "🔴" };
}
```

**Warum unterschiedliche Punktsummen?** Jeder Typ hat eigene Kriterien mit eigenen Gewichten. Die Summe steht in `scoring.totalPoints`: Story und Task 100, Epic 90, Bug 105. Weil der Score auf 100 normiert wird, sind die Werte typübergreifend vergleichbar.

**Wann ist 🟡 erreichbar?** Ein Issue mit bestandenem Gate hat mindestens den Pflicht-Anteil als Score. 🟡 (Score 50–79) ist deshalb nur möglich, wenn die Pflichtkriterien weniger als 80 % der Punkte ausmachen:

| Typ   | Pflicht-Punkte | Gesamtpunkte | Pflicht-Anteil | 🟡 möglich |
| ----- | -------------: | -----------: | -------------: | :--------: |
| Story |             47 |          100 |           47 % |     ✅     |
| Task  |             90 |          100 |           90 % |     –      |
| Epic  |             90 |           90 |          100 % |     –      |
| Bug   |             85 |          105 |           81 % |     –      |

Bei Task, Epic und Bug ist der Status in der aktuellen Konfiguration faktisch 🟢 oder 🔴. Das ist eine Folge der Gewichtung, keine eigene Regel. Ändern sich Punkte oder Pflichtmarkierungen in `criteria/*.json`, ändert sich auch, ob 🟡 erreichbar ist.

---

## Kriterien pro Typ

Punkte, Art und Pflicht pro Kriterium. ✅ = Pflicht (Ready Gate), „–“ = optional (zählt nur im Score).

### Story (100 Punkte)

| Kriterium        | Art   | Punkte | Pflicht |
| ---------------- | ----- | -----: | :-----: |
| `story-format`   | Regel |     10 |   ✅    |
| `story-context`  | Regel |     10 |   ✅    |
| `epic-link`      | Regel |     10 |    –    |
| `ac-presence`    | Regel |     10 |   ✅    |
| `story-links`    | Regel |     10 |    –    |
| `ac-testability` | KI    |     17 |   ✅    |
| `size-risk`      | KI    |     17 |    –    |
| `business-value` | KI    |     16 |    –    |

Stories können auch ohne Epic existieren (Bugfixes, Spikes, kleine Features). Der Epic-Link ist deshalb eine Empfehlung für Nachvollziehbarkeit, keine Pflicht. `size-risk` ist ein Risikosignal, keine Schätzung und keine Zusage des Teams.

### Task (100 Punkte)

| Kriterium               | Art   | Punkte | Pflicht |
| ----------------------- | ----- | -----: | :-----: |
| `technical-scope`       | Regel |     15 |   ✅    |
| `justification`         | Regel |     10 |   ✅    |
| `impact-analysis`       | Regel |     10 |   ✅    |
| `rollback-plan`         | Regel |     10 |   ✅    |
| `ac-presence`           | Regel |      5 |    –    |
| `ac-testability`        | KI    |     20 |   ✅    |
| `size-risk`             | KI    |     15 |   ✅    |
| `technical-feasibility` | KI    |     10 |   ✅    |
| `rollback-risk`         | KI    |      5 |    –    |

### Bug (105 Punkte, normiert auf 100)

| Kriterium            | Art   | Punkte | Pflicht |
| -------------------- | ----- | -----: | :-----: |
| `reproduction-steps` | Regel |     15 |   ✅    |
| `expected-vs-actual` | Regel |     15 |   ✅    |
| `environment-info`   | Regel |     10 |   ✅    |
| `ac-presence`        | Regel |     10 |    –    |
| `ac-testability`     | KI    |     20 |   ✅    |
| `size-risk`          | KI    |     15 |   ✅    |
| `severity`           | KI    |     10 |   ✅    |
| `reproducibility`    | KI    |     10 |    –    |

### Epic (90 Punkte, normiert auf 100)

| Kriterium           | Art   | Punkte | Pflicht |
| ------------------- | ----- | -----: | :-----: |
| `goal-statement`    | Regel |     15 |   ✅    |
| `benefit-statement` | Regel |     15 |   ✅    |
| `story-list`        | Regel |     10 |   ✅    |
| `ac-testability`    | KI    |     17 |   ✅    |
| `size-risk`         | KI    |     17 |   ✅    |
| `epic-goal`         | KI    |      8 |   ✅    |
| `epic-benefit`      | KI    |      8 |   ✅    |

---

## Deterministische Prüfregeln

Alle deterministischen Prüfungen arbeiten auf dem Issue-Body (Groß-/Kleinschreibung egal). Ein leerer Body lässt jede deterministische Prüfung durchfallen.

### Story

**`story-format`** besteht, wenn der Text einem bekannten Muster folgt oder alle drei Bestandteile enthält:

- Deutsch: „Als … möchte ich … damit …“, „… um … zu …“, „… will ich … damit …“
- Englisch: „As a … I want … so that …“, „… in order to …“, „As a … I need … so that …“, „… I should be able to … so that …“
- Fallback: Rolle („als“ / „as a“), Wunsch (möchte, will, want, need, should be able to) und Begründung (damit, um … zu, so that, in order to) kommen irgendwo im Text vor, auch ohne Standardformulierung.

**`story-context`** besteht, wenn mindestens ein Schlüsselwort aus den Listen Produkt (z. B. product, feature, system, portal, app, platform, service), Zielgruppe (z. B. user, customer, client, admin, kunde, benutzer) oder Business (z. B. value, benefit, goal, need, problem) vorkommt, oder eines der Kontextmuster („as a user“, „for the customer“, „in the app“ …). Die Suche arbeitet mit Teilstrings (siehe [Grenzen](#grenzen-der-prüfung)).

**`epic-link`** besteht, wenn eine Issue-Referenz (`#12` oder `owner/repo#12`) vorhanden ist und

- genau eine Referenz existiert (gilt als wahrscheinliches Parent-Epic), oder
- mehrere Referenzen existieren und ein Epic-Kontextwort vorkommt (epic, parent, part of, belongs to, under, related to, tracking, initiative).

Ob das referenzierte Epic in GitHub existiert, wird nicht geprüft.

**`ac-presence`** zählt Akzeptanzkriterien auf drei Wegen und nimmt das Maximum: Checklistenpunkte (`- [ ] …`), Gherkin-Szenarien (Zeilen mit Given/When/Then/And/But, drei Zeilen ≙ ein Szenario) und Vorkommen von „must“, „should“, „verify that“, „it is required that“. Bestanden bei **mindestens zwei**. Fehlen ein Happy Path (successfully, happy path, normal case, standard flow) oder ein Fehlerfall (error, fail, invalid, exception, edge case, boundary), erscheint ein Hinweis, das Kriterium besteht trotzdem.

**`story-links`** besteht bei jedem nicht leeren Body. Erkannte Muster (depends on, blocked by, requires, blocks, related to, see also, duplicate of) werden als Hinweis ausgegeben. Es gibt keinen Abzug für fehlende Links; die 10 Punkte werden dadurch faktisch immer vergeben.

<!-- ENTSCHEIDUNG D6: story-links vergibt aktuell immer Punkte. Alternativen: Kriterium aus dem Score nehmen (Story-Summe 90, normiert) oder nur bei tatsächlich vorhandenen Links bepunkten. -->

### Task

**`technical-scope`** besteht, wenn ein Abschnitt „What / Scope / Technical Scope“ oder eine Aufzählung mit Aktionsverb vorhanden ist und mindestens **zwei** Aufzählungszeilen (`-` oder `*`) ein Aktionsverb enthalten (upgrade, migrate, implement, create, update, configure, refactor, deploy, setup, install, remove, add).

**`justification`** besteht, wenn ein Begründungsabschnitt (Why, Reason, Justification, Background, Motivation) oder ein Schlüsselwort vorkommt **und** ein konkreter Auslöser genannt wird: EOL/Jahreszahl/Quartal (eol, end-of-life, `Q1`–`Q4`, `202x`), security, performance oder compliance. „debt“ oder „deprecated“ allein genügen nicht.

**`impact-analysis`** besteht, wenn ein Impact-Abschnitt (Impact, Affected, Downtime, Risks) oder ein Schlüsselwort vorkommt **und** mindestens **zwei von drei** Elementen genannt sind: betroffene Systeme (affected systems, databases, services), Downtime (downtime, window, maintenance), Risiken (risk, risks).

**`rollback-plan`** besteht, wenn ein Abschnitt „Rollback“ existiert **und** mindestens **zwei von vier** Details genannt sind: Verfahren (procedure, steps, restore, backup), Test (tested, test), Zeitangabe (z. B. „15 minutes“, „within 30“) und Fundstelle (runbook, documented in, location).

**`ac-presence`:** wie bei der Story.

### Bug

**`reproduction-steps`** besteht, wenn ein Reproduktionsabschnitt, eine nummerierte Liste oder „Step n“ vorkommt und mindestens **zwei** nummerierte Schritte bzw. „Step“-Marker vorhanden sind.

**`expected-vs-actual`** besteht, wenn „expected“ vorkommt und zusätzlich „actual“, „instead“ oder „but got“.

**`environment-info`** besteht, wenn ein Umgebungsabschnitt oder ein Schlüsselwort (browser, os, version, device, platform, ios, android, windows, mac, safari, chrome, firefox) vorkommt und mindestens **zwei** Details erkannt werden (Browser, OS, Version, Gerät/Plattform).

**`ac-presence`:** wie bei der Story.

### Epic

**`goal-statement`** besteht, wenn ein Zielabschnitt (Goal, Objective, Aim, Purpose) oder „goal is to“ / „objective is to“ vorkommt und mindestens **zwei von drei** SMART-Hinweisen erkannt werden: spezifisch (specific, clear, defined), messbar (Prozentzahl, reduce, increase, within, „by Q“, deadline), terminiert („by 2026“, Q-Angabe, deadline, target date).

**`benefit-statement`** besteht, wenn ein Nutzenabschnitt (Benefit, Value, Impact, Outcome) oder „benefit is/will be“ vorkommt und der Nutzen quantifiziert ist (Zahl mit Einheit wie %, minutes, hours, tickets, € oder die Wörter reduce, increase, save).

**`story-list`** besteht, wenn mindestens **eine** Issue-Referenz (`#n`) im Body steht.

---

## KI-Prüfungen

Die KI-Prüfungen laufen lokal über Ollama (Standardmodell `qwen3:30b-instruct`, änderbar über `MODEL_NAME`).

**Technische Eckdaten:**

- Antwort als JSON nach festem Schema (Structured Output), kein Freitext-Parsing.
- `temperature: 0`, `top_k: 1`, `seed: 42` für möglichst gleichbleibende Ergebnisse auf demselben Setup. Eine bitgenaue Garantie über Hardware oder Modellversionen hinweg gibt es nicht.
- Bis zu zwei Wiederholungen bei Fehlern (Wartezeit 2 s bzw. 4 s).
- Jede Prüfung liefert eine kurze Begründung in der Sprache des Issues.
- Fällt Ollama aus, fehlen die KI-Ergebnisse. Pflichtkriterien gelten dann als nicht bestanden (fail-closed).

| Kriterium               | Typen | Besteht, wenn …                                                                                                                                            |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ac-testability`        | alle  | alle Akzeptanzkriterien klar, messbar, eindeutig und prüfbar sind. Vage Formulierungen („works well“, „user-friendly“) und fehlende Kriterien fallen durch |
| `size-risk`             | alle  | die geschätzte Größe **S** oder **M** ist (S: < 1 Tag, geringes Risiko; M: 1–3 Tage, offene Fragen; L: 3–10 Tage; XL: > 10 Tage). L und XL fallen durch    |
| `business-value`        | Story | Nutzer oder Rolle, konkreter Bedarf und verständlicher Nutzen erkennbar sind. „Improve X“ ohne Nutzen fällt durch                                          |
| `epic-goal`             | Epic  | das Ziel ein Ergebnis für Business oder Nutzer beschreibt und nicht nur ein Thema                                                                          |
| `epic-benefit`          | Epic  | der Nutzen nachvollziehbar ist: wer gewinnt was, idealerweise messbar                                                                                      |
| `technical-feasibility` | Task  | der technische Ansatz machbar und verstanden ist; erhebliche technische Unsicherheit fällt durch                                                           |
| `rollback-risk`         | Task  | der Rollback für die Produktionsauswirkung angemessen ist; ein ungetesteter Rollback fällt durch                                                           |
| `severity`              | Bug   | der Schweregrad (Critical, Major, Minor) klar begründet ist                                                                                                |
| `reproducibility`       | Bug   | die Reproduzierbarkeit (Always, Sometimes, Rarely) klar angegeben ist                                                                                      |

KI-Ergebnisse sind in Reports und Entwürfen als `(ai)` gekennzeichnet, deterministische als `(deterministic)`.

---

## Schnellstatus (`phrom status`)

`phrom status` führt **nur die deterministischen Prüfungen** aus. Es kennt weder KI-Kriterien noch Punktgewichte noch das Ready Gate.

- Wert = `round(bestandene Checks ÷ Anzahl Checks × 50)`
- 🟢 ab 40, 🟡 ab 25, sonst 🔴 (jeweils von 50)

🟢 bedeutet hier „mindestens rund 80 % der formalen Checks bestanden“, **nicht** „bereit für das Refinement“. Ein Issue kann im Schnellstatus 🟢 sein und in der vollständigen Analyse 🔴, etwa weil seine Akzeptanzkriterien nicht testbar sind. Verbindlich ist erst die Analyse mit KI (`run`, `select`, `filter`, `improve`).

---

## Beispiele

### Issue #3 „Improve login“ (Story): 27/100, 🔴 Not ready

| Kriterium                       | Ergebnis | Punkte |
| ------------------------------- | :------: | -----: |
| `story-format`                  |    ✖     |      0 |
| `story-context`                 |    ✖     |      0 |
| `epic-link`                     |    ✖     |      0 |
| `ac-presence` (nur 1 Kriterium) |    ✖     |      0 |
| `story-links`                   |    ✔     |     10 |
| `ac-testability`                |    ✖     |      0 |
| `size-risk`                     |    ✔     |     17 |
| `business-value`                |    ✖     |      0 |
| **Summe**                       |          | **27** |

Das Ready Gate scheitert an vier Pflichtkriterien.

### Issue #5 „Manage account settings“ (Story): 73/100, 🔴 Not ready

Nur `epic-link` (Regel) und `ac-testability` (KI) fallen durch. Der Score liegt mit 73 im Bereich 🟡, aber `ac-testability` ist Pflicht und das Gate scheitert. Das Beispiel zeigt, dass das Ready Gate den Score überstimmt: Die Akzeptanzkriterien („All options“, „change is applied“) sind nicht prüfbar, also ist das Issue nicht bereit, obwohl es formal weitgehend vollständig ist.

<!-- HINWEIS: Der Wert 73 gilt nach dem Fix der Score-Berechnung (Schlüssel business-value, siehe Anleitung). Bis dahin zeigt Phrom 57. -->

---

## Grenzen der Prüfung

- **Heuristiken:** Deterministische Prüfungen erkennen Schlüsselwörter und Muster, keine Bedeutung. Ein Text kann bestehen, ohne gut zu sein, und umgekehrt.
- **Teilstring-Suche:** Bei `story-context` genügt ein Treffer als Teilstring (z. B. „app“ in „happy“). Das Kriterium ist dadurch großzügig und prüft nicht, dass sowohl Produkt als auch Zielgruppe genannt sind.
- **Sprachen:** Formate und Schlüsselwörter sind auf Deutsch und Englisch ausgelegt.
- **Epic-Link:** Die Existenz und die Rückverlinkung des Epics in GitHub werden nicht verifiziert.
- **KI-Einschätzungen** sind begründete Meinungen. Sie können irren, und ihre Qualität hängt vom Modell ab. Die Messung gegen ein manuell bewertetes Testset ist geplant.
- **Keine Ausfall-Status:** Fällt das Modell aus, wird das Issue fail-closed als 🔴 geführt. Ein eigener Status „incomplete“ ist geplant.
- **Zusammenfassung im Report:** Sie nennt die wichtigsten Lücken, ist aber keine vollständige Liste. Maßgeblich ist die Kriterienliste im Report.

---

## Geplante Kriterien

Diese Kriterien sind in `criteria/*.json` mit `implemented: false` beschrieben, aber noch nicht umgesetzt. Sie tragen keine Punkte und wirken nicht auf das Ready Gate.

| Typ   | Kriterien                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Story | `independence` (Überschneidung mit anderen Stories per Ähnlichkeitssuche)                                                                                                                                                                               |
| Task  | `task-context`, `task-dependencies`                                                                                                                                                                                                                     |
| Bug   | `bug-impact`                                                                                                                                                                                                                                            |
| Epic  | `epic-context`, `epic-boundary`, `epic-success-measure`, `epic-slicing`, `epic-oversize-risk`, `epic-owner`, `epic-stakeholders`, `epic-company-goal`, `epic-milestones`, `epic-timeline`, `epic-risks`, `epic-dependencies`, `epic-child-story-status` |

Weitere geplante Regeln aus den JSON-Dateien:

- **Dreiwertiges Ergebnis** (`pass`, `flag`, `not-assessable`) statt `bestanden / nicht bestanden`.
- **Belegpflicht** (`requireEvidence`): Die KI zitiert die Stelle, auf die sich ihre Einschätzung stützt.
- **Status `incomplete`**, wenn Ollama nicht erreichbar ist oder KI-Prüfungen fehlschlagen; ein solcher Lauf muss wiederholt werden.
