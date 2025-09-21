#!/bin/bash

echo "🚀 Deploying Internet Identity canister..."

# Deploy Internet Identity
dfx deploy internet_identity

echo "✅ Internet Identity deployed successfully!"
echo "🔗 You can now use Internet Identity for authentication in your dApp"

# Show the canister ID
echo "📋 Internet Identity Canister ID: $(dfx canister id internet_identity)"