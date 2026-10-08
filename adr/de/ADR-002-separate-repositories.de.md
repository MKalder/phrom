# ADR-002: Getrennte Repositories für Code und Demo-Backlog

- **Status:** Angenommen
- **Datum:** 2026-10-02
- **Entscheider:** Marius Kalder (Product Owner / Autor von Phrom)
- **Geltungsbereich:** Aufteilung in `phrom` (Code) und `phrom-backlog-demo` (Demo-Daten)

## Kontext

Phrom besteht aus zwei Teilen: dem Code (Node.js, Regeln, Skripte und Seed-Daten) und dem Demo-Backlog (GitHub Issues, die Phrom bewertet). Die Frage ist, ob beide in einem einzigen Repository oder in zwei getrennten Repositories liegen sollen.

Ein einzelnes Repository wäre einfacher zu verwalten. Zwei Repositories trennen Code und Daten klar, erlauben unterschiedliche Sichtbarkeitseinstellungen und verhindern, dass echte Entwicklungs-Issues mit Demo-Daten vermischt werden.

## Entscheidungstreiber

- **Klarer Geltungsbereich:** Zu Demonstrationszwecken soll Phrom zunächst nur Demo-Issues bewerten, keine echten Entwicklungs-Issues.
- **Wiederverwendbarkeit:** Das Demo-Backlog soll jederzeit zurücksetzbar sein, ohne den Code zu beeinflussen.
- **Sicherheit:** Ein separates Demo-Repository erlaubt es, einen Token auf dieses Repository zu beschränken.
- **Portfolio-Klarheit:** Interessierte sollen Code und Demo getrennt erkunden können.
- **Messbarkeit:** Ein fester Satz an Demo-Issues ermöglicht reproduzierbare Modellvergleiche und Tests.

## Betrachtete Optionen

**Option A: Ein Repository.** Code und Issues liegen im selben Repository. Vorteile: weniger Verwaltungsaufwand und alles an einem Ort. Nachteile: Demo-Issues und echte Entwicklungs-Issues sind vermischt, das Zurücksetzen des Backlogs ist riskant, und der Token hat Zugriff auf beides.

**Option B: Zwei Repositories.** `phrom` enthält Code, Regeln und Seed-Daten. `phrom-backlog-demo` enthält nur Demo-Issues. Vorteile: klare Trennung, eingeschränkter Token-Zugriff und ein isolierter Reset-Prozess. Nachteile: zwei Repositories zu pflegen, und Phrom benötigt eine Repository-Konfiguration.

**Option C: Ein Repository mit strikter Label-Filterung.** Alle Issues liegen im selben Repository, aber Phrom filtert nach `demo-seed`. Vorteile: nur ein Repository. Nachteile: Die Filterung ist fehleranfällig, echte Entwicklungs-Issues bleiben im Geltungsbereich des Tokens, und das Repository wird unter Umständen unübersichtlicher.

## Entscheidung

Ich wähle **Option B: Zwei Repositories**.

Begründung:

- **Sicherheit:** Der Fine-grained Token lässt sich auf `phrom-backlog-demo` beschränken. Im Geltungsbereich des Tokens liegen nur Demo-Daten.
- **Reproduzierbarkeit:** Das Demo-Repository lässt sich jederzeit zurücksetzen, indem Issues gelöscht werden und das Seed-Skript läuft. Der Code bleibt davon unberührt.
- **Klarer Geltungsbereich:** Phrom bewertet nur Demo-Issues. Echte Entwicklungs-Issues im Code-Repository liegen außerhalb seines Geltungsbereichs.
- **Portfolio:** Interessierte können die Architektur im Code-Repository erkunden und die Ergebnisse von Phrom im Demo-Repository sehen.

## Konsequenzen

### Positiv

- Der Token hat nur Zugriff auf das Demo-Repository.
- Demo-Issues lassen sich zurücksetzen, ohne den Code oder echte Entwicklungs-Issues zu gefährden.
- Phrom hat einen klaren Geltungsbereich: nur `phrom-backlog-demo`.

### Negativ / Risiken

- **Zusätzlicher Verwaltungsaufwand:** Zwei Repositories bedeuten zwei READMEs, zwei Issue-Tracker und zwei Konfigurationen.
- **Konfigurationsaufwand:** Phrom muss das Demo-Repository über Umgebungsvariablen oder Konfigurationsparameter angegeben bekommen.
- **Dokumentation:** Die Beziehung zwischen den Repositories muss im README erklärt werden.

## Validierung

Die Entscheidung gilt als validiert, wenn:

- Phrom erfolgreich mit einem Token arbeitet, der nur Lesezugriff auf `phrom-backlog-demo` hat.
- Ein Seed-Skript das Backlog automatisch befüllen kann.
- Ein Reset-Skript das Demo-Repository in seinen Ausgangszustand zurückversetzt, ohne den Code zu beeinflussen.
- Interessierte Code und Demo getrennt erkunden können.

## Offene Fragen

- Ob ein Seed-Skript im Code-Repository Issues im Demo-Repository anlegt, ist eine Implementierungsentscheidung. Dasselbe gilt für das Reset-Skript.
