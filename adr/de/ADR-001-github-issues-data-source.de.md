# ADR-001: GitHub Issues als Datenquelle für das Backlog

- **Status:** Angenommen. Berechtigungen und Schreibzugriff am 2026-10-07 ergänzt: Die Analyse erfolgt nur lesend (ADR-003); Schreibzugriff besteht nur für das Seeding (ADR-004).
- **Datum:** 2026-10-01
- **Entscheider:** Marius Kalder (Product Owner / Autor von Phrom)
- **Geltungsbereich:** Wahl der Datenquelle für das Demo-Backlog und die GitHub-Integration von Phrom

## Kontext

Phrom soll ausgewählte Backlog-Items analysieren und Verbesserungsvorschläge liefern. Dafür braucht Phrom eine Datenquelle, die:

- Issues mit Titeln, Beschreibungen, Labels und Kommentaren enthält.
- Lesezugriff über eine stabile API unterstützt (Schreibzugriff für das Seeding des Demo-Backlogs).
- Im Demo-Szenario öffentlich zugänglich ist.
- Den Zugriff über einen Fine-grained Access Token auf ein einzelnes Repository beschränken lässt.
- Dem Product Owner aus dem Arbeitsalltag vertraut ist.

Betrachtet wurden GitHub Issues, Trello und ein selbst gehostetes Kanban-Board.

## Entscheidungstreiber

- **Portfolio-Kohärenz:** Code, Demo und Ergebnisse sollen für Recruiter an einem Ort sichtbar sein.
- **Sicherheit:** Phrom soll nur auf ein Demo-Repository mit minimalen Berechtigungen zugreifen.
- **Demo-Wert:** Ein Tool, das mit einem echten, vertrauten System arbeitet, ist für nicht-technische Stakeholder leichter zu verstehen.
- **Technische Einfachheit:** Die REST API soll gut dokumentiert sein und ohne OAuth-Flow funktionieren.
- **Betrieb:** Keine zusätzliche Infrastruktur über die Maschine hinaus, auf der Ollama läuft.

## Betrachtete Optionen

**Option A: GitHub Issues.** Ein eigenes Repository enthält die Demo-Issues. Phrom nutzt die GitHub REST API mit einem Fine-grained Personal Access Token, der auf genau dieses Repository beschränkt ist. Für die Analyse genügt _Issues: Read-only_.

**Option B: Trello.** Ein Board mit Karten als Backlog-Items. Auch die Trello-API unterstützt tokenbasierten Zugriff, erfordert aber einen accountweiten Token und bietet weniger granulare Berechtigungen. Außerdem ist es eine kostenpflichtige Option.

**Option C: Selbst gehostetes Kanban (Wekan, ein „Trello-Klon“).** Volle Kontrolle über die Daten auf einem eigenen VPS, aber mit zusätzlichem Wartungsaufwand und Ressourcenverbrauch neben Ollama.

## Entscheidung

Ich entscheide mich für **Option A: GitHub Issues**.

Begründung:

- **Sicherheit:** Ein Fine-grained Personal Access Token lässt sich auf genau ein Repository beschränken. Selbst wenn der Token kompromittiert wird, bleiben die Auswirkungen auf dieses Repository begrenzt, und ein schreibgeschützter Analyse-Token kann nichts ändern. Bei Trello gilt ein Token für den gesamten Account.
- **Portfolio-Kohärenz:** Code, Demo-Issues und die spätere Fallstudie liegen unter demselben GitHub-Profil. Interessierte sehen den Code und seine Wirkung an einem Ort.
- **API-Reife:** Die GitHub REST API ist umfassend dokumentiert, bietet Endpunkte für Issues, Kommentare und Labels und erlaubt 5.000 authentifizierte Requests pro Stunde – mehr als genug für das MVP.
- **Keine zusätzliche Infrastruktur:** Anders als selbst gehostete Boards erfordert diese Option keinen weiteren Dienst.
- **Vertrautheit:** GitHub Issues ist für technische Stakeholder ein vertrautes Format. Das senkt die Hürde, die Demo zu verstehen.

## Konsequenzen

### Positiv

- Phrom kann Issues lesen, ohne Zugriff auf andere Repositories zu haben. Das Schreiben von Kommentaren oder Labels ist nicht Teil des MVP (siehe Offene Fragen).
- Jeder mit einem Browser kann die Demo im öffentlichen Repository ohne zusätzliche Accounts erkunden.
- Die REST API ist stabil und gut dokumentiert; Beispiele und Clients für Node.js sind verfügbar.

### Negativ / Risiken

- **Externe Abhängigkeit:** Phrom braucht Zugriff auf die GitHub API (und einen gültigen Token, falls einer verwendet wird). Ein GitHub-Ausfall oder ein abgelaufener Token blockiert die Demo.
- **Abhängigkeit von Freitext:** GitHub Issues hat keine strukturierten Felder für „User Story“ oder „Akzeptanzkriterien“. Phrom muss Inhalte flexibel parsen und sich auf Konventionen stützen.
- **Keine Board-Integration:** GitHub Projects (das Board) wird im MVP nicht genutzt. Als dieses ADR erstmals geschrieben wurde, war Projects nur über GraphQL verfügbar; im September 2025 hat GitHub eine REST API für Projects ergänzt. Phrom arbeitet ausschließlich mit Issues; das Board ist eine optionale Ansicht.

## Validierung

Die Entscheidung gilt als validiert, wenn:

- Phrom alle offenen Issues des Demo-Repositorys mit einem schreibgeschützten Fine-grained Token lesen kann.
- Die Rate Limits der GitHub API im MVP-Betrieb nie erreicht werden.
- Ein externer Betrachter die Demo ohne zusätzliches Setup verstehen kann.

## Offene Fragen

- Ob später ein GitHub Project als Board öffentlich gemacht wird, bleibt offen und ändert nichts an der Wahl der Datenquelle.
- Das Zurückschreiben von Kommentaren oder Labels nach GitHub würde die Leitplanken von ADR-003 verändern und erfordert ein eigenes ADR.
- Ob zusätzlich eine lokale JSON-Datei als Seed-Daten für reproduzierbare Demos gepflegt wird, ist eine Implementierungsentscheidung und widerspricht dieser Entscheidung nicht.
