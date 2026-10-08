# ADR-004: Seed- und Reset-Skripte für das Demo-Backlog

- **Status:** Angenommen (ergänzt 2026-10-07: Seed läuft über die GitHub CLI ohne das Analyse-Token; Einschränkung der Issue-Nummerierung)
- **Datum:** 2026-10-07
- **Entscheider:** Marius Kalder (Product Owner / Autor von Phrom)
- **Geltungsbereich:** Reproduzierbares Befüllen und Zurücksetzen des Demo-Backlogs (`phrom-backlog-demo`)

## Kontext

Das Demo-Backlog in `phrom-backlog-demo` dient dazu, Phrom ohne Schreibzugriff auf produktive Repositories zu demonstrieren und zu testen. Issues müssen daher reproduzierbar angelegt und bei Bedarf zurückgesetzt werden. Daraus ergeben sich folgende Fragen:

- Wie werden Demo-Issues angelegt: manuell, per Skript oder über die GitHub CLI?
- Wie wird das Backlog zurückgesetzt: durch Löschen und Neuanlegen der Issues oder durch Neuanlegen des gesamten Repositorys?
- Wo sollen die Seed-Daten liegen: im Code-Repository oder im Demo-Repository?
- Welche Berechtigungen benötigen Seeding und Reset?

ADR-002 trennt Code und Demo-Backlog in zwei Repositories. Dieses ADR beschreibt, wie das Demo-Repository befüllt und zurückgesetzt wird.

## Entscheidungstreiber

- **Reproduzierbarkeit:** Jeder Lauf soll mit denselben Issues beginnen, um Modellvergleiche und Tests zu unterstützen.
- **Sicherheit:** Seed und Reset sind Schreiboperationen. Sie dürfen nicht mit dem Analyse-Token kombiniert werden.
- **Einfachheit:** Kein zusätzlicher Build-Schritt, keine Datenbank und keine externe Infrastruktur.
- **Versionierung:** Seed-Daten sollen im Code-Repository versioniert werden, damit Änderungen nachvollziehbar bleiben.
- **Schutz vor Datenverlust:** Reset ist destruktiv. Er erfordert eine explizite Bestätigung (`--confirm`), um versehentliches Löschen zu verhindern.
- **Issue-Nummerierung:** GitHub erlaubt nicht, den Issue-Zähler zurückzusetzen. Das ist eine bekannte Einschränkung, die dokumentiert werden muss.

## Betrachtete Optionen

**Option A: Manuelles Anlegen über die GitHub-UI.** Vorteile: kein Code und keine Abhängigkeiten. Nachteile: nicht reproduzierbar, fehleranfällig, zeitaufwendig bei 12 oder mehr Issues und keine Möglichkeit zum Zurücksetzen.

**Option B: Ein Skript, das Issues löscht und neu anlegt.** Vorteile: ein Befehl und einfache Bedienung. Nachteile: Seed und Reset sind kombiniert, das Token benötigt sowohl Schreib- als auch Löschrechte, und eine versehentliche Ausführung löscht das Backlog.

**Option C: Zwei getrennte Skripte (Seed und Reset).** Seed legt Issues mit Schreibrechten an. Reset löscht alle Issues über die GraphQL API mit Admin-Rechten. Vorteile: Trennung der Berechtigungen, explizite Bestätigung des Resets und im Code-Repository versionierte Seed-Daten. Nachteile: zwei Skripte, die gepflegt werden müssen, und die Issue-Nummerierung läuft nach einem Reset weiter.

**Option D: Repository löschen und neu anlegen.** Vorteile: Der Issue-Zähler beginnt bei 1, und der Zustand ist sauber. Nachteile: Die Repository-ID ändert sich, Links brechen, die Demo-URL muss aktualisiert werden, und zum Neuanlegen ist die GitHub CLI oder API erforderlich.

## Entscheidung

Ich wähle **Option C: Zwei getrennte Skripte (Seed und Reset).**

- **Seed:** `seed/seed.js` für Issues und `seed/labels.js` für Labels. Beide rufen die GitHub CLI (`gh issue create`, `gh label create`) mit Schreibrechten (`Issues: Read & Write`) auf. Sie entfernen `GITHUB_TOKEN` und `GH_TOKEN` aus der Umgebung der CLI und verwenden entweder das Konto aus `gh auth login` oder `SEED_GITHUB_TOKEN`. So wird das Analyse-Token mit reinem Lesezugriff nie für Schreibvorgänge verwendet. Seed-Daten liegen als JSON im Code-Repository. Titel müssen eindeutig sein, weil bestehende Issues am Titel erkannt und übersprungen werden.
- **Reset:** `reset_backlog/reset-demo-backlog.js`. Nutzt die GitHub GraphQL API mit der Mutation `deleteIssue`, weil die REST API das Löschen von Issues nicht unterstützt. Erfordert Admin-Rechte für das Demo-Repository. Läuft nur mit dem expliziten Flag `--confirm`.

Begründung:

- **Trennung der Berechtigungen:** Seed benötigt nur Schreibrechte für Issues, Reset dagegen Admin-Rechte zum Löschen. Getrennte Skripte ermöglichen getrennte Zugangsdaten, und keines der beiden nutzt das Analyse-Token.
- **Sicherheit:** Reset ist destruktiv. Das Flag `--confirm` und die Sicherheitsprüfung, die nur `phrom-backlog-demo` zulässt, verhindern versehentliches Löschen.
- **Reproduzierbarkeit:** Seed-Daten sind im Code-Repository versioniert. Jeder Lauf beginnt mit denselben Issue-Inhalten.
- **Dokumentierte Einschränkung:** Die Issue-Nummerierung läuft nach einem Reset weiter. Das ist bekannt und dokumentiert. Derzeit verwenden Reports und CLI-Befehle GitHub-Issue-Nummern, und die Seed-Daten enthalten eine `seedId` (Position im Testset), die keine GitHub-Nummer ist. Die Offline-Evaluierung (`scripts/eval-seed.js`) arbeitet auf der Seed-Datei und ist daher unabhängig von der GitHub-Nummerierung.

## Konsequenzen

### Positiv

- Seed und Reset können unabhängig voneinander laufen.
- Seed-Daten sind im Code-Repository versioniert und nachvollziehbar.
- Reset ist durch das Flag `--confirm` und die Prüfung des Repository-Namens geschützt.
- Das Analyse-Token benötigt nur Lesezugriff; Seed und Reset verwenden getrennte Zugangsdaten.

### Negativ / Risiken

- **Issue-Nummerierung:** Nach einem Reset beginnen neue Issues nicht bei 1, sondern beim nächsten Zählerwert. Das kann Tests und Dokumentation erschweren.
- **Zwei Skripte:** Seed und Reset müssen getrennt gepflegt und dokumentiert werden.
- **GraphQL-Abhängigkeit:** Reset hängt von der GraphQL API ab. Ändert GitHub sie, muss das Skript angepasst werden.
- **Admin-Rechte für Reset:** Das Reset-Token benötigt Admin-Zugriff auf das Demo-Repository. Das birgt ein höheres Risiko als reine Schreibrechte.

## Validierung

Die Entscheidung gilt als validiert, wenn:

- `npm run seed` das Demo-Repository zuverlässig mit allen definierten Issues befüllt (Titel in `issues.json` sind eindeutig; doppelte Titel in der Seed-Datei führen zum Abbruch, Issues, deren Titel im Repository schon existiert, werden übersprungen),
- `npm run reset:demo:confirm` alle Issues löscht und das Repository in seinen inhaltlichen Ausgangszustand zurückversetzt,
- Seed-Daten im Code-Repository versioniert und Änderungen nachvollziehbar sind,
- die Dokumentation die Einschränkung der Issue-Nummerierung klar benennt.

## Offene Fragen

- **Issue-Nummerierung:** Offen ist, ob sich ein Wechsel zu stabilen Kennungen, zum Beispiel einem Label `seed-id`, für Tests und Reports lohnt.
- **Automatisierung:** Ob Seed und Reset in CI/CD integriert werden sollen, zum Beispiel über einen nächtlichen Reset, wird später entschieden.
- **Soft Reset:** Eine Option, Issues zu schließen statt zu löschen, wäre sicherer. Sie würde aber den Zähler nicht zurücksetzen und das Backlog unübersichtlich zurücklassen.
- **GitHub-Write-back:** Falls Phrom später Kommentare schreiben darf, muss das Seed-Skript möglicherweise auch Metadaten wie `seed-run-id` in Issues speichern. Das wäre eine separate Entscheidung.
