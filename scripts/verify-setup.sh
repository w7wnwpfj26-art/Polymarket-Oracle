#!/bin/bash
# ============================================
# AEGIS Setup Verification Script
# Checks prerequisites before running the system
# ============================================

echo "🔍 AEGIS Setup Verification"
echo "===================================="
echo ""

ERRORS=0
WARNINGS=0

# Check Node.js version
echo "📦 Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(node --version | cut -d'.' -f1 | sed 's/v//')
    echo "   ✅ Node.js: $NODE_VERSION"
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo "   ⚠️  Warning: Node.js 22+ recommended, you have v$NODE_MAJOR"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "   ❌ Node.js not found! Please install from https://nodejs.org/"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check npm
echo "📦 Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "   ✅ npm: v$NPM_VERSION"
else
    echo "   ❌ npm not found!"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check optional: Bun
echo "📦 Checking Bun (optional)..."
if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    echo "   ✅ Bun: v$BUN_VERSION (faster alternative to npm)"
else
    echo "   ⚠️  Bun not found (optional, but faster)"
    echo "      Install: curl -fsSL https://bun.sh/install | bash"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check port availability
echo "🔌 Checking port availability..."
check_port() {
    PORT=$1
    NAME=$2
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   ❌ Port $PORT ($NAME) is already in use!"
        echo "      Kill process: lsof -ti:$PORT | xargs kill -9"
        ERRORS=$((ERRORS + 1))
    else
        echo "   ✅ Port $PORT ($NAME) available"
    fi
}

check_port 7700 "Backend API"
check_port 7701 "WebSocket"
check_port 5173 "Frontend Dev"
check_port 6379 "Redis (optional)"
echo ""

# Check .env file
echo "🔐 Checking configuration..."
if [ -f "new/.env" ]; then
    echo "   ✅ .env file exists"
else
    echo "   ⚠️  .env file not found"
    echo "      Create: cp new/.env.example new/.env"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "new/backend/data/config.json" ]; then
    echo "   ✅ config.json exists"
else
    echo "   ⚠️  config.json not found"
    echo "      Create: cp new/backend/data/config.json.example new/backend/data/config.json"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check database directory
echo "💾 Checking database directory..."
if [ -d "new/backend/data" ]; then
    echo "   ✅ Data directory exists"
    if [ -f "new/backend/data/aegis.db" ]; then
        DB_SIZE=$(du -h "new/backend/data/aegis.db" | cut -f1)
        echo "   ℹ️  Database size: $DB_SIZE"
    else
        echo "   ℹ️  No database yet (will be created on first run)"
    fi
else
    echo "   ⚠️  Data directory missing, will be created"
    mkdir -p new/backend/data
fi
echo ""

# Check dependencies
echo "📚 Checking dependencies..."
if [ -d "new/backend/node_modules" ]; then
    echo "   ✅ Backend dependencies installed"
else
    echo "   ⚠️  Backend dependencies not installed"
    echo "      Run: cd new/backend && npm install"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -d "new/frontend/node_modules" ]; then
    echo "   ✅ Frontend dependencies installed"
else
    echo "   ⚠️  Frontend dependencies not installed"
    echo "      Run: cd new/frontend && npm install"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check Git (optional)
echo "🔧 Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo "   ✅ Git: v$GIT_VERSION"
    
    # Check if .env is gitignored
    if [ -f ".gitignore" ] && grep -q ".env" .gitignore; then
        echo "   ✅ .env is gitignored"
    else
        echo "   ⚠️  Ensure .env is in .gitignore!"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "   ⚠️  Git not found (needed for version control)"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "===================================="
echo "📊 Verification Summary"
echo "===================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed! You're ready to run AEGIS."
    echo ""
    echo "Quick start:"
    echo "  ./new/start.sh"
    echo ""
    echo "Or manually:"
    echo "  cd new/backend && npm run dev"
    echo "  cd new/frontend && npm run dev"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS warning(s) found (non-critical)"
    echo "   You can proceed, but address warnings for best experience."
    exit 0
else
    echo "❌ $ERRORS error(s) and $WARNINGS warning(s) found"
    echo "   Please fix the errors above before running AEGIS."
    exit 1
fi
