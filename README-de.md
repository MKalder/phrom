# Phrom (พร้อม)

**Ein KI-Agent zur Vorbereitung von GitHub-Issues für das Backlog Refinement.**

> Projektstatus: Konzept / geplantes MVP. Die unten beschriebenen Abläufe sind Zielverhalten, keine bereits implementierten Funktionen.

## Inhaltsverzeichnis

- [Problem und Ziel](#problem-und-ziel)
- [Product Vision](#product-vision)
- [Was dieses Projekt demonstriert](#was-dieses-projekt-demonstriert)
- [Zielgruppe](#zielgruppe)
- [Geplanter MVP](#geplanter-mvp)
- [Geplante Architektur](#geplante-architektur)
- [Regelwerk und Sicherheitsgrenzen](#regelwerk-und-sicherheitsgrenzen)
- [Fehlertoleranz und Review](#fehlertoleranz-und-review)
- [Geplante Erfolgskriterien](#geplante-erfolgskriterien)
- [Noch offen](#noch-offen)

## Problem und Ziel

Unklare Stories, fehlende oder nicht prüfbare Akzeptanzkriterien und mögliche Doppelungen verbrauchen Zeit im Refinement. Phrom soll ausgewählte Issues vorab analysieren und belegte Verbesserungsvorschläge liefern. **„Bereit zur Diskussion im Refinement“ ist nicht dasselbe wie „bereit für Sprint Planning“.** Ob ein Item hinreichend verstanden, sinnvoll geschnitten und umsetzbar ist, entscheiden Product Owner und Team gemeinsam.

Der Hintergrund ist: Die größten Verschschwendungen im Refinement lassen sich in vier Gruppen einteilen: schlecht vorbereitete Items, falsche Detailtiefe zur falschen Zeit, ein überfülltes Backlog und ein schlecht geführter Termin. Wichtig für Phrom: Nur für die erste Gruppe wird Phrom als Agent verwendet.

## Product Vision

Backlog Refinement soll Zeit für das verwenden, was nur ein Team leisten kann: gemeinsam verstehen, schätzen und über den technischen Lösungsweg entscheiden. Heute geht ein Teil dieser Zeit für Arbeit verloren, die auch vorher erledigt werden könnte: Z.b.: unklare Formulierungen, fehlende Akzeptanzkriterien, zu große Items und doppelte Einträge.

**Phrom** (พร้อม, Thai für „bereit“) ist ein KI-Agent, der Product Ownern diese Vorarbeit abnimmt. Er prüft ausgewählte GitHub-Issues anhand eines transparenten Regelwerks und liefert belegte Verbesserungsvorschläge. Der Product Owner behält jede Entscheidung: Nichts wird ohne seine ausdrückliche Übernahme in GitHub geändert.

Die Vision hinter dem Projekt ist ein Agent, der Handwerk automatisiert, aber kein Urteil ersetzt. Phrom priorisiert nicht, schätzt nicht und bewertet keine technische Machbarkeit. Er sorgt dafür, dass Items in einem besseren Zustand ins Refinement kommen, und das Team startet dort, wo die Diskussion beginnt, die wirklich Teamzeit braucht.

Phrom ist zugleich ein Demonstrationsprojekt: Es zeigt, wie sich ein Agent mit klaren Werkzeugen, nachvollziehbarer Schleife, dauerhaft gespeicherten Ergebnissen und menschlicher Freigabe bauen lässt – ohne Framework und ohne Cloud-Abhängigkeit für die Modellausführung.

## Was dieses Projekt demonstriert

Phrom zeigt, wie ein Product Owner ein reales Prozessproblem – vermeidbare
Vorarbeit im Backlog Refinement – in einen kontrollierbaren KI-Agenten
übersetzt. Das Projekt belegt:

- **Produktarbeit:** von der Problemanalyse über Zielgruppe, Scope und MVP
  bis zu messbaren Erfolgskriterien.
- **Agenten-Architektur:** ein Agent-Loop mit begrenzten Werkzeugen,
  gespeicherten Zwischenergebnissen und Wiederaufnahme nach Fehlern.
- **Menschliche Kontrolle:** Das Modell schlägt vor; jede Änderung an
  einem Issue braucht die ausdrückliche Freigabe des Product Owners.
- **Begründete Entscheidungen:** Architekturentscheidungen sind als ADRs
  dokumentiert, Modellqualität wird gegen ein Testset gemessen.

Phrom zeigt nicht, dass KI Product Owner ersetzt. Priorisierung, Schätzung
und Machbarkeit bleiben beim Team. Es ist auch nicht erstrebenswert den Denkprozess des Teams auszulagern.

## Zielgruppe

### Primär: Product Owner

Phrom richtet sich an Product Owner, die:

- ein Backlog in GitHub Issues pflegen oder pflegen könnten,
- vor jedem Refinement viele Items nachschärfen müssen, ohne dafür ein dediziertes Tooling-Budget zu haben,
- Wert auf Datenkontrolle legen und Backlog-Inhalte nicht an einen Cloud-Dienst übergeben wollen,
- Vorschläge prüfen und freigeben wollen, statt Änderungen automatisch zu erhalten.

Typischer Kontext: ein Scrum-Team, ein Backlog mit einigen Dutzend offenen Items und ein Refinement, das regelmäßig mit Formulierungsfragen statt mit inhaltlichen Fragen und Entscheidungen beginnt.

### Sekundär: Fachliche und technische Beobachter

Als öffentliches Demonstrationsprojekt spricht Phrom außerdem an:

- **Tech Leads und Engineering Manager**, die beurteilen möchten, wie ein Agent mit Werkzeugzugriff, Fehlerbehandlung und Freigabeschritt aufgebaut sein kann,
- **Recruiter und Hiring Manager**, die Produkt- und Architekturkompetenz an einem durchgängigen Beispiel nachvollziehen wollen, von der Vision über Entscheidungen bis zur Umsetzung.

### Nicht die Zielgruppe

Phrom ist nicht gedacht für:

- Teams, die Priorisierung, Schätzung oder Sprint-Planung automatisieren wollen,
- Organisationen mit einem großen Backlog aus Hunderten Items und mehreren Teams,
- Anwender, die Änderungen ohne menschliche Prüfung wünschen.

### Nutzungsannahmen

Diese Annahmen gelten für das MVP und werden im Projekt überprüft:

- Das Backlog liegt in GitHub Issues, nicht in einem anderen Tool.
- Items tragen ein eindeutiges Typ-Label (Epic, Story, Task oder Bug).
- Das Team akzeptiert ein gemeinsames Regelwerk für die Vorprüfung.
- Ein lokal betriebenes Modell reicht für die Aufgabe qualitativ aus. Das ist eine Hypothese, kein Ergebnis, und wird mit einem Testset gemessen.

## Geplanter MVP

- Ein PO startet eine Prüfung für bestimmte Issue-Nummern oder für alle noch nicht als `refinement-ready` markierten, unterstützten Issues im Demo-Repository.
- Phrom liest die ausgewählten Issues über die GitHub-API, ermittelt ihren Typ anhand genau eines `type:*`-Labels und prüft sie gegen ein versioniertes, projektspezifisches Regelwerk. Fehlt ein Typ oder ist er mehrdeutig, wird das Item mit Diagnose nicht stillschweigend verarbeitet.
- Der Schwerpunkt liegt auf User Stories: Klarheit von Rolle, Ziel und Nutzen; vorhandene und beobachtbar prüfbare Akzeptanzkriterien; unklare Formulierungen; mögliche Übergröße und inhaltliche Überschneidungen. Bei Epics werden Ziel und möglicher Zuschnitt als Diskussionsgrundlage beurteilt. Tasks und Bugs werden im ersten MVP nicht inhaltlich bewertet, sondern transparent als außerhalb des Prüfumfangs ausgewiesen.
- Ein Node.js-Orchestrator bearbeitet Items einzeln und speichert Snapshot, Befunde, Vorschlag und Status **nach jedem Item** dauerhaft in PostgreSQL. Ergebnisse werden dem PO gesammelt zur Review angezeigt, wenn alle ausgewählten Items abgeschlossen sind oder einen ausgewiesenen Fehlerzustand haben.
- Der PO kann einen Vorschlag übernehmen, ablehnen oder mit einem Hinweis neu prüfen lassen. Die Anwendung darf GitHub erst nach einer ausdrücklichen Übernahme ändern; das Modell erhält kein Tool zum eigenmächtigen Überschreiben von Issues.

Ein Lauf ist auch dann abgeschlossen, wenn einzelne Items nach begrenzten Wiederholungen gescheitert sind: Der PO sieht eine vollständige Übersicht mit erfolgreichen, übersprungenen und fehlgeschlagenen Items, nicht den Anschein einer vollständig gelungenen Prüfung.

## Geplante Architektur

```text
PO → Node.js-CLI / Orchestrator → GitHub REST API → Issues in phrom-backlog-demo
                   │
                   ├─ Ollama auf CPU-VPS (Modell noch auszuwählen)
                   ├─ versioniertes Prüfraster + deterministische Checks
                   └─ PostgreSQL: Läufe, Issue-Snapshots, Befunde, Vorschläge,
                                  Fehlerzustände und PO-Entscheidungen

PO-Review → explizite Übernahme → Node.js-Anwendung → GitHub-Issue aktualisieren
```

- `phrom` enthält künftig Agenten-Code, Regeln, Tests und Architekturentscheidungen.
- `phrom-backlog-demo` enthält echte GitHub-Issues als Demo-Backlog; ein öffentliches GitHub Project kann sie als Board darstellen. Project-Drafts sind **keine** über die geplante Issues-REST-Integration abrufbaren Repository-Issues.
- GitHub ist Quelle der Wahrheit für Backlog-Inhalte; PostgreSQL hält Prüf- und Review-Zustände. Es gibt keine zweite manuell zu pflegende Kopie des Backlogs.
- Der Agent-Loop wählt innerhalb definierter Grenzen Lese-/Prüfschritte, beobachtet Tool-Ergebnisse und erzeugt einen Vorschlag. Die Frage, ob Modell-Tool-Calling oder stärker deterministische Orchestrierung für den ersten Schnitt zuverlässiger ist, wird im Prototyp geprüft.

## Regelwerk und Sicherheitsgrenzen

Das konkrete Prüfraster wird **vor** der Implementierung mit Beispielen und erwarteten Befunden festgelegt. Formale Kriterien können in Code geprüft werden; semantische Fragen liefert das Modell als begründete Einschätzung, nicht als Tatsache. Ein vermeintlich „zu großes“ Item lässt sich aus Text allein nicht zuverlässig auf Sprint-Größe festlegen.

Phrom priorisiert nicht nach Geschäftswert, schätzt nicht für das Team, bestätigt keine technische Machbarkeit und erklärt ein Item nicht eigenständig für sprint-ready. Insbesondere darf ein bloßes Label `refinement-ready` nicht als automatische Folge einer Modellantwort gelten: dessen Vergabe ist eine gesonderte, noch festzulegende PO-Entscheidung.

Für GitHub wird ein Fine-grained Personal Access Token mit Zugriff nur auf das Demo-Repository angestrebt. Geheime Werte bleiben außerhalb des Repositories. Analyse und GitHub-Schreibzugriff werden getrennt. Vor einer Übernahme wird der gespeicherte Issue-Snapshot gegen den aktuellen Issue-Stand geprüft, damit zwischenzeitliche Änderungen nicht überschrieben werden. Wiederholte Aufrufe dürfen keine doppelten Änderungen erzeugen.

## Fehlertoleranz und Review

Jeder gestartete Lauf hält die ausgewählten Issue-Nummern und pro Item einen Zustand wie `pending`, `running`, `done`, `skipped` oder `failed` fest. Nach einem Absturz soll die Anwendung fertige Items nicht neu berechnen und hängende Items gezielt wieder aufnehmen. Fehler und Wiederholungen werden begrenzt und protokolliert. Die genaue Statusmaschine und Transaktionsgrenzen sind noch zu spezifizieren.

Beim Review sieht der PO pro Item: ursprünglichen Inhalt, Befund mit Beleg, vorgeschlagene Änderung und Unsicherheiten. „Neu prüfen“ erzeugt einen nachvollziehbaren neuen Versuch und ersetzt nicht still die bisherige Entscheidung.

## Geplante Erfolgskriterien

- Befunde stimmen mit einem vorher definierten Demo-Testset überein; Fehlalarme an guten Kontroll-Issues bleiben sichtbar.
- Kein Datenverlust bei einem Abbruch spät im Lauf; Wiederaufnahme verarbeitet nur offene Items.
- Keine GitHub-Änderung ohne ausdrückliche PO-Übernahme.
- Dauer pro Item und Lauf, Fehlerrate und Annahme-/Ablehnungsquote sind messbar.

## Noch offen

Modell und Thinking-Modus, konkrete Prüfkriterien je Typ, Gestaltung der CLI-Review, Datenbankschema, Retry-Strategie, Umgang mit Mehrfach-Labels und Umfang des Epic-Checks werden erst nach einem kleinen Testset entschieden. Dieses README beschreibt das Zielbild; ein Quick Start folgt, sobald die Implementierung tatsächlich ausführbar ist.
