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

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Installing..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc
fi

echo "✅ Bun version: $(bun --version)"

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
bun install

# Install frontend dependencies  
echo ""
echo "📦 Installing frontend dependencies..."
cd ../frontend
bun install

echo ""
echo "🚀 Starting services..."
echo ""

# Start backend in background
cd ../backend
bun run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend
cd ../frontend
bun run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Services started!"
echo ""
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:7700"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
