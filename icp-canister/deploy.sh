#!/bin/bash

# Paramify ICP Canister Deployment Script

echo "🚀 Starting Paramify ICP Canister deployment..."

# Check if dfx is installed
if ! command -v dfx &> /dev/null
then
    echo "❌ dfx could not be found. Please install the DFINITY Canister SDK."
    echo "Visit: https://internetcomputer.org/docs/current/developer-docs/setup/install/"
    exit 1
fi

# Start local replica if not running
echo "🔄 Starting local Internet Computer replica..."
dfx start --clean --background

# Wait for replica to start
echo "⏳ Waiting for replica to initialize..."
sleep 5

# Deploy the canister
echo "📦 Building and deploying the canister..."
dfx deploy

# Get canister ID
CANISTER_ID=$(dfx canister id paramify_insurance)
echo "✅ Canister deployed successfully!"
echo "📍 Canister ID: $CANISTER_ID"

# Get current principal (admin)
PRINCIPAL=$(dfx identity get-principal)
echo "👤 Admin Principal: $PRINCIPAL"

echo ""
echo "🎉 Deployment complete! You can now interact with the canister."
echo ""
echo "Example commands:"
echo "  dfx canister call paramify_insurance get_policy_stats"
echo "  dfx canister call paramify_insurance get_flood_threshold"
echo ""

