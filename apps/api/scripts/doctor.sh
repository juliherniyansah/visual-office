#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf "${GREEN}✓${NC} %s\n" "$label"
  else
    printf "${RED}✗${NC} %s\n" "$label"
    ERRORS=$((ERRORS + 1))
  fi
}

warn() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf "${GREEN}✓${NC} %s\n" "$label"
  else
    printf "${YELLOW}⚠${NC} %s\n" "$label"
  fi
}

echo "RedHunter API Doctor"
echo "===================="
echo

# 1. .env file
if [ -f apps/api/.env ]; then
  printf "${GREEN}✓${NC} apps/api/.env exists\n"
else
  printf "${RED}✗${NC} apps/api/.env missing — run: cp apps/api/.env.example apps/api/.env\n"
  ERRORS=$((ERRORS + 1))
fi

# 2. JWT_SECRET validation
if [ -f apps/api/.env ]; then
  JWT_SECRET=$(grep '^JWT_SECRET=' apps/api/.env 2>/dev/null | cut -d= -f2- || echo "")
  if [ -z "$JWT_SECRET" ]; then
    printf "${RED}✗${NC} JWT_SECRET not set\n"
    ERRORS=$((ERRORS + 1))
  elif [ "$JWT_SECRET" = "change-me" ] || [ "$JWT_SECRET" = "change-me-to-a-long-random-string" ]; then
    printf "${YELLOW}⚠${NC} JWT_SECRET still placeholder — change to random 32+ char string\n"
  elif [ ${#JWT_SECRET} -lt 32 ]; then
    printf "${RED}✗${NC} JWT_SECRET too short (${#JWT_SECRET} chars) — must be at least 32 characters\n"
    ERRORS=$((ERRORS + 1))
  else
    printf "${GREEN}✓${NC} JWT_SECRET valid (${#JWT_SECRET} chars)\n"
  fi
  
  # 3. OWNER_PASSWORD validation
  OWNER_PASSWORD=$(grep '^OWNER_PASSWORD=' apps/api/.env 2>/dev/null | cut -d= -f2- || echo "")
  if [ -z "$OWNER_PASSWORD" ]; then
    printf "${RED}✗${NC} OWNER_PASSWORD not set\n"
    ERRORS=$((ERRORS + 1))
  elif [ ${#OWNER_PASSWORD} -lt 12 ]; then
    printf "${RED}✗${NC} OWNER_PASSWORD too short (${#OWNER_PASSWORD} chars) — must be at least 12 characters\n"
    ERRORS=$((ERRORS + 1))
  else
    printf "${GREEN}✓${NC} OWNER_PASSWORD valid (${#OWNER_PASSWORD} chars)\n"
  fi
fi

# 4. MongoDB reachable
if command -v mongosh >/dev/null 2>&1; then
  MONGO_URL=$(grep '^MONGO_URL=' apps/api/.env 2>/dev/null | cut -d= -f2- || echo "mongodb://127.0.0.1:27017/redhunter")
  if mongosh "$MONGO_URL" --eval "db.runCommand({ping:1})" --quiet 2>/dev/null | grep -q "1"; then
    printf "${GREEN}✓${NC} MongoDB reachable at $MONGO_URL\n"
  else
    printf "${RED}✗${NC} MongoDB not reachable — run: docker compose up -d\n"
    ERRORS=$((ERRORS + 1))
  fi
elif command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q mongo; then
    printf "${GREEN}✓${NC} MongoDB container running\n"
  else
    printf "${YELLOW}⚠${NC} MongoDB container not running — run: docker compose up -d\n"
  fi
else
  printf "${YELLOW}⚠${NC} Cannot check MongoDB (mongosh/docker not installed)\n"
fi

# 5. Port available
PORT=$(grep '^PORT=' apps/api/.env 2>/dev/null | cut -d= -f2- || echo "4000")
if ! lsof -i :$PORT >/dev/null 2>&1; then
  printf "${GREEN}✓${NC} Port $PORT available\n"
else
  printf "${RED}✗${NC} Port $PORT already in use\n"
  ERRORS=$((ERRORS + 1))
fi

# 6. Dependencies installed
if [ -d node_modules ] && [ -d apps/api/node_modules ]; then
  printf "${GREEN}✓${NC} Dependencies installed\n"
else
  printf "${RED}✗${NC} Dependencies missing — run: bun install\n"
  ERRORS=$((ERRORS + 1))
fi

# 7. Bun version
if command -v bun >/dev/null 2>&1; then
  BUN_VER=$(bun --version)
  printf "${GREEN}✓${NC} Bun $BUN_VER installed\n"
else
  printf "${RED}✗${NC} Bun not installed — install from https://bun.sh\n"
  ERRORS=$((ERRORS + 1))
fi

echo
if [ $ERRORS -eq 0 ]; then
  printf "${GREEN}All checks passed. Ready to start.${NC}\n"
  exit 0
else
  printf "${RED}$ERRORS error(s) found. Fix above issues before starting.${NC}\n"
  exit 1
fi
