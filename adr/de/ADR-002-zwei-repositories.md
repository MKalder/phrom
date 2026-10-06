# ADR-002: Zwei Repositories für Code und Demo-Backlog

- **Status:** Akzeptiert
- **Datum:** 2026-10-02
- **Entscheider:** Marius Kalder (Product Owner / Autor von Phrom)
- **Betrifft:** Aufteilung in `phrom` (Code) und `phrom-backlog-demo` (Demo-Daten)

## Kontext

Phrom besteht aus zwei Teilen: dem Code (Node.js, Regeln, Tests) und dem Demo-Backlog (GitHub Issues, die Phrom prüft). Die Frage ist, ob beides in einem Repository lebt oder in zwei getrennten.

Ein Repository wäre einfacher zu verwalten. Zwei Repositories trennen Code und Daten klar, erlauben unterschiedliche Sichtbarkeiten und vermeiden, dass echte Entwicklungs-Issues mit Demo-Daten vermischt werden.

## Entscheidungstreiber

- **Sauberer Scope:** Der KI Assistenz soll zur Demonstration zunächst nur Demo-Issues prüfen, keine echten Entwicklungs-Issues.
- **Wiederverwendbarkeit:** Das Demo-Backlog soll jederzeit zurücksetzbar sein, ohne den Code zu berühren.
- **Sicherheit:** Ein separates Demo-Repo erlaubt ein Token, das nur dieses Repo berührt.
- **Portfolio-Clarity:** Interessenten sollen Code und Demo getrennt betrachten können.
- **Messbarkeit:** Ein festes Set von Demo-Issues ermöglicht reproduzierbare Modellvergleiche und Tests.

## Betrachtete Optionen

**Option A: Ein Repository.** Code und Issues leben im selben Repo. Vorteile: weniger Verwaltung, alles an einem Ort. Nachteile: Demo-Issues und echte Issues mischen sich, Reset ist riskant, Token hat Zugriff auf alles.

**Option B: Zwei Repositories.** `phrom` enthält Code, Regeln und Tests. `phrom-backlog-demo` enthält ausschließlich Demo-Issues. Vorteile: klare Trennung, sicheres Token, sauberes Reset. Nachteile: zwei Repos zu pflegen, Phrom muss Repo-Name konfigurieren.

**Option C: Ein Repo mit striktem Label-Filter.** Alle Issues im selben Repo, aber der Agent filtert nach `demo-seed`. Vorteile: ein Repo. Nachteile: Filter ist fehleranfällig, echte Issues bleiben im Scope des Tokens und es könnte Unübersichtlicher werden.

## Entscheidung

Ich wähle **Option B: Zwei Repositories**.

Begründung:

- **Sicherheit:** Das Fine-grained Token kann auf `phrom-backlog-demo` beschränkt werden. Selbst bei einem Fehler im Agenten sind nur Demo-Daten betroffen.
- **Reproduzierbarkeit:** Das Demo-Repo kann jederzeit zurückgesetzt werden (Issues löschen, Seed-Skript laufen lassen), ohne den Code zu berühren.
- **Klarer Scope:** Der Agent prüft nur Demo-Issues. Echte Entwicklungs-Issues im Code-Repo sind außerhalb des Scope.
- **Portfolio:** Interessenten sehen im Code-Repo die Architektur, im Demo-Repo die Wirkung von Phrom.

## Konsequenzen

**Positiv**

- Das Token hat nur Zugriff auf das Demo-Repo.
- Demo-Issues können ohne Risiko zurückgesetzt werden.
- Der Agent hat einen klaren Scope: nur `phrom-backlog-demo`.

**Negativ / Risiken**

- **Mehr Verwaltung:** Zwei Repos bedeuten zwei README, zwei Issue-Tracker, zwei Konfigurationen.
- **Konfigurationsaufwand:** Phrom muss das Demo-Repo als Umgebungsvariable oder Config-Parameter kennen.
- **Dokumentation:** Die Beziehung zwischen den Repos muss im README erklärt werden.

## Validierung

Die Entscheidung gilt als bestätigt, wenn:

- Phrom mit einem Token, das nur `phrom-backlog-demo` lesen darf, erfolgreich arbeitet,
- ein seed Skript das Backlog automatisch befüllen kann,
- ein Reset-Skript das Demo-Repo in den Ausgangszustand versetzt, ohne den Code zu berühren,
- Interessenten können Code und Demo getrennt betrachten.

## Offene Punkte

- Ob ein Seed-Skript im Code-Repo die Issues im Demo-Repo anlegt, ist eine Implementierungsfrage das gilt auch für das Reset-Skript.
