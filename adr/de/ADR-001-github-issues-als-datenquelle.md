# ADR-001: GitHub Issues als Datenquelle für das Backlog

- **Status:** Akzeptiert
- **Datum:** 2026-10-01
- **Entscheider:** Marius Kalder (Product Owner / Autor von Phrom)
- **Betrifft:** Wahl der Datenquelle für das Demo-Backlog und die Agenten-Integration

## Kontext

Phrom soll ausgewählte Backlog-Items analysieren und Verbesserungsvorschläge liefern. Dafür benötigt der Agent eine Datenquelle, die:

- Issues mit Titel, Beschreibung, Labels und Kommentaren enthält,
- über eine stabile API les- und schreibbar ist,
- im Demo-Szenario öffentlich einsehbar ist,
- mit einem feingranularen Zugriffstoken auf ein einzelnes Repository beschränkt werden kann,
- und für den Product Owner im Alltag vertraut ist.

Zur Auswahl standen GitHub Issues, Trello und ein selbstgehostetes Kanbanboard.

## Entscheidungstreiber

- **Portfolio-Kohärenz:** Code, Demo und Ergebnisse sollen an einem Ort für Recruiter sichtbar sein.
- **Sicherheit:** Der Agent soll mit minimalen Rechten nur ein Demo-Repository berühren.
- **Demo-Wert:** Ein Agent, der auf einem echten, vertrauten Tool arbeitet, ist für nicht-technische Stakeholder leichter verständlich.
- **Technische Einfachheit:** Die REST-API soll gut dokumentiert sein und ohne OAuth-Flow auskommen.
- **Betrieb:** Keine zusätzliche Infrastruktur neben dem VPS für Ollama.

## Betrachtete Optionen

**Option A: GitHub Issues.** Ein dediziertes Repository enthält die Demo-Issues. Der Agent nutzt die GitHub REST API mit einem Fine-grained Personal Access Token, das nur Lese- und Schreibrechte auf Issues dieses einen Repositories hat.

**Option B: Trello.** Ein Board mit Cards als Items. Die Trello-API erlaubt ebenfalls Token-basierten Zugriff, erfordert aber einen Account-weiten Token und hat eine weniger granulare Rechtevergabe. Außerdem ist diese kostenpflichtig.

**Option C: Selbstgehostetes Kanban (Wekan "Trello-Klon").** Volle Datenkontrolle auf dem eigenen VPS, aber zusätzlicher Wartungsaufwand und Ressourcenverbrauch neben Ollama.

## Entscheidung

Ich wähle **Option A: GitHub Issues**.

Begründung:

- **Sicherheit:** Ein Fine-grained Personal Access Token kann auf genau ein Repository beschränkt werden. Selbst wenn das Token kompromittiert wird oder der Agent Fehler macht, ist der Schaden auf dieses Demo-Repository begrenzt. Bei Trello gilt ein Token für das gesamte Konto.
- **Portfolio-Kohärenz:** Der Agenten-Code, die Demo-Issues und später die Case Study liegen im selben GitHub-Profil. Ein Interessent sieht den Code und seine Wirkung an einem Ort.
- **API-Reife:** Die GitHub REST API ist umfassend dokumentiert, bietet Endpunkte für Issues, Kommentare und Labels und erlaubt authentifizierte Requests mit 5.000 Requests pro Stunde – mehr als genug für das MVP.
- **Keine zusätzliche Infrastruktur:** Im Gegensatz zu selbstgehosteten Boards entsteht kein weiterer Dienst auf dem VPS.
- **Vertrautheit:** GitHub Issues sind für technische Stakeholder ein bekanntes Format. Das senkt die Einstiegshürde für die Demo.

## Konsequenzen

**Positiv**

- Der Agent kann Issues lesen, Kommentare posten (Phase 2) und Labels setzen, ohne andere Repositories zu berühren.
- Die Demo ist für jeden mit einem Browser nachvollziehbar (öffentliches Repo), ohne zusätzliche Accounts.
- Die REST-API ist stabil und gut dokumentiert; Beispiele und Clients für Node.js existieren.

**Negativ / Risiken**

- **Externe Abhängigkeit:** Der Agent braucht Erreichbarkeit der GitHub-API und gültige Credentials. Ein Ausfall von GitHub oder ein abgelaufenes Token blockiert die Demo.
- **Freitextlastigkeit:** GitHub-Issues haben keine strukturierten Felder für „User Story" oder „Acceptance Criteria". Der Agent muss tolerant parsen und mit Konventionen arbeiten.
- **Kein natives Kanban:** GitHub Projects (das Board) hat keine REST-API, nur GraphQL. Für das MVP arbeiten wir ausschließlich mit Issues; das Board ist eine optionale Ansicht.

## Validierung

Die Entscheidung gilt als bestätigt, wenn:

- der Agent mit dem Fine-grained Token erfolgreich Issues lesen und Kommentare posten kann,
- die Rate Limits der GitHub-API im MVP-Betrieb nie erreicht werden,
- die Demo für einen externen Betrachter ohne zusätzliche Einrichtung nachvollziehbar ist.

## Offene Punkte

- Ob später ein GitHub Project als Board öffentlich geschaltet wird, ist offen und ändert nichts an der Datenquelle.
- Ob zusätzlich zu den Issues eine lokale JSON-Datei als Seed für reproduzierbare Demos geführt wird, ist eine Implementierungsfrage und kein Widerspruch zu dieser Entscheidung.
