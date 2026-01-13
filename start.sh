#!/bin/bash

echo "🎬 Film Budget Kalkulator wird gestartet..."
echo ""

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Prüfen ob Node.js installiert ist
if ! command -v node &> /dev/null; then
    echo "❌ Node.js ist nicht installiert. Bitte installiere Node.js (v18+) von https://nodejs.org"
    exit 1
fi

# Prüfen ob npm installiert ist
if ! command -v npm &> /dev/null; then
    echo "❌ npm ist nicht installiert. Bitte installiere Node.js (v18+) von https://nodejs.org"
    exit 1
fi

echo "📦 Installiere Backend-Abhängigkeiten..."
cd backend
npm install --silent

echo "📦 Installiere Frontend-Abhängigkeiten..."
cd ../frontend
npm install --silent

echo ""
echo -e "${GREEN}✅ Installation abgeschlossen!${NC}"
echo ""

# Backend starten
echo -e "${BLUE}🚀 Starte Backend-Server...${NC}"
cd ../backend
node server.js &
BACKEND_PID=$!

# Warten bis Backend bereit ist
sleep 2

# Frontend starten
echo -e "${BLUE}🚀 Starte Frontend...${NC}"
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🎬 Film Budget Kalkulator läuft!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend: ${BLUE}http://localhost:5173${NC}"
echo -e "  Backend:  ${BLUE}http://localhost:3001${NC}"
echo ""
echo "  Drücke Ctrl+C zum Beenden"
echo ""

# Cleanup bei Beenden
cleanup() {
    echo ""
    echo "🛑 Beende Server..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Warten
wait
