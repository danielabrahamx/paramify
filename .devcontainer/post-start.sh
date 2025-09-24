#!/bin/bash

# Post-start script for devcontainer
# This runs every time the container starts

set -e

echo "🔄 Running post-start setup..."

# Ensure DFX is in PATH
export PATH="/root/bin:$HOME/bin:$PATH"

# Check if replica is running
if dfx ping 2>/dev/null; then
    echo "✅ DFX replica is already running"
else
    echo "🚀 Starting DFX replica in background..."
    dfx start --clean --background
    sleep 5
fi

# Display helpful information
echo ""
echo "========================================="
echo "  Paramify ICP Development Environment"
echo "========================================="
echo ""
echo "📍 Your Principal ID: $(dfx identity get-principal)"
echo "🌐 Network: $(dfx info network)"
echo ""
echo "Quick Commands:"
echo "  • Deploy:  npm run deploy:local"
echo "  • Test:    npm run test"
echo "  • Build:   npm run build"
echo "  • Verify:  npm run verify"
echo ""
echo "Ready for development! 🚀"
echo ""