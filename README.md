# Film Budget Kalkulator

Eine moderne, minimalistische Webapp zur Budgetkalkulation für Filmprojekte.

![Film Budget Kalkulator](https://img.shields.io/badge/React-18-blue) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![SQLite](https://img.shields.io/badge/Database-SQLite-lightgrey)

## Features

- **Projektverwaltung**: Projekte erstellen, laden, archivieren und löschen
- **Projekteinstellungen**: Drehtage, Hotelkosten pro Nacht, Verpflegungspauschale
- **Positionstypen**:
  - **Crew** - Vollständige Kalkulation mit Tagesgage, Pauschale, Hotelnächte, Fahrtkosten
  - **Darsteller** - Wie Crew, separat ausgewiesen
  - **Leihe** - Pauschale Kosten für Equipment
  - **Location** - Pauschale Kosten für Drehorte
  - **Sonstiges** - Weitere pauschale Kosten
- **Farbcodierung**: Positionen können farblich markiert werden
- **Drag & Drop**: Positionen per Drag & Drop sortieren
- **Aktivieren/Deaktivieren**: Positionen können temporär aus der Berechnung ausgeschlossen werden
- **Auswertung**: Detaillierte Kostenaufschlüsselung nach Kategorien
- **Realkosten-Vergleich**: Tatsächliche Kosten mit Kalkulation vergleichen
- **Auto-Save**: Änderungen werden automatisch gespeichert

## Schnellstart

### Option 1: Mit Start-Script (empfohlen)

```bash
# Repository klonen
git clone https://github.com/DomenicHanner/Budget-Calculator.git
cd Budget-Calculator

# App starten (installiert automatisch alle Abhängigkeiten)
./start.sh
```

Die App öffnet sich automatisch im Browser unter `http://localhost:5173`

### Option 2: Manuell starten

```bash
# Repository klonen
git clone https://github.com/DomenicHanner/Budget-Calculator.git
cd Budget-Calculator

# Backend starten (Terminal 1)
cd backend
npm install
npm start

# Frontend starten (Terminal 2)
cd frontend
npm install
npm run dev
```

- Backend läuft auf `http://localhost:3001`
- Frontend läuft auf `http://localhost:5173`

## Projektstruktur

```
├── backend/
│   ├── server.js        # Express Server mit API-Endpunkten
│   ├── package.json
│   └── budget.db        # SQLite Datenbank (wird automatisch erstellt)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx      # Hauptkomponente
│   │   ├── App.css      # Styles
│   │   ├── index.css    # Globale Styles
│   │   └── main.jsx     # Entry Point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

## API-Endpunkte

### Projekte

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/api/projects` | Alle aktiven Projekte |
| GET | `/api/projects?archived=true` | Alle archivierten Projekte |
| GET | `/api/projects/:id` | Einzelnes Projekt mit Positionen |
| POST | `/api/projects` | Neues Projekt erstellen |
| PUT | `/api/projects/:id` | Projekt aktualisieren |
| DELETE | `/api/projects/:id` | Projekt löschen |

### Positionen

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| POST | `/api/projects/:id/positions` | Position hinzufügen |
| PUT | `/api/positions/:id` | Position aktualisieren |
| DELETE | `/api/positions/:id` | Position löschen |
| PUT | `/api/projects/:id/reorder` | Positionen neu sortieren |

## Konfiguration

### Backend Port ändern

Über Umgebungsvariable:
```bash
PORT=3001 node server.js
```

Oder in `backend/server.js`:
```javascript
const PORT = process.env.PORT || 3001; // Standard: 3001
```

### Frontend API-URL ändern

Über Umgebungsvariable (`.env` Datei im frontend Ordner):
```
VITE_API_URL=http://localhost:3001/api
```

### Frontend Port ändern

In `frontend/vite.config.js`:
```javascript
server: {
  port: 5173, // Standard: 5173
}
```

## Technologien

- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express
- **Datenbank**: SQLite (better-sqlite3)
- **Styling**: Vanilla CSS (minimalistisches Design)

## Lizenz

MIT
