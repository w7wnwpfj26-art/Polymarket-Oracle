#!/bin/bash

echo "
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   █████╗ ███████╗ ██████╗ ██╗███████╗                    ║
║  ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝                    ║
║  ███████║█████╗  ██║  ███╗██║███████╗                    ║
║  ██╔══██║██╔══╝  ██║   ██║██║╚════██║                    ║
║  ██║  ██║███████╗╚██████╔╝██║███████║                    ║
║  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝                    ║
║                                                           ║
║   Arbitrage System v2.0                                   ║
║   2026 Tech Stack                                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"

# Detect package manager and use appropriate commands
USE_BUN=false

if command -v bun &> /dev/null; then
    echo "✅ Found Bun v$(bun --version)"
    USE_BUN=true
else
    echo "⚠️  Bun not found, using npm"
    if ! command -v npm &> /dev/null; then
        echo "❌ Error: Neither Bun nor npm found. Please install Node.js first."
        echo "   Visit: https://nodejs.org/"
        exit 1
    fi
    echo "✅ Using npm v$(npm --version)"
fi

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
if [ "$USE_BUN" = true ]; then
    bun install
else
    npm install
fi

# Install frontend dependencies  
echo ""
echo "📦 Installing frontend dependencies..."
cd ../frontend
if [ "$USE_BUN" = true ]; then
    bun install
else
    npm install
fi

echo ""
echo "🚀 Starting services..."
echo ""

# Start backend in background
cd ../backend
if [ "$USE_BUN" = true ]; then
    bun run dev:bun &
else
    npm run dev &
fi
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:7700/health > /dev/null 2>&1; then
        echo "✅ Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend failed to start within 30 seconds"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

# Start frontend
cd ../frontend
if [ "$USE_BUN" = true ]; then
    bun run dev &
else
    npm run dev &
fi
FRONTEND_PID=$!

echo ""
echo "✅ Services started successfully!"
echo ""
echo "   📱 Frontend: http://localhost:5173"
echo "   🔧 Backend API: http://localhost:7700"
echo "   📡 WebSocket: ws://localhost:7701"
echo "   📖 API Docs: http://localhost:7700/api/docs"
echo ""
echo "Press Ctrl+C to stop all services..."

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Wait for user interrupt
trap cleanup INT
wait
