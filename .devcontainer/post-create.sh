#!/bin/bash

# Post-create script for devcontainer
# This runs once when the container is first created

set -e

echo "🚀 Running post-create setup for Paramify ICP development environment..."

# Install project dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Set up Rust for WASM development
echo "🦀 Setting up Rust for WASM..."
rustup target add wasm32-unknown-unknown
rustup component add rustfmt clippy

# Install Cargo dependencies
echo "📦 Building Rust dependencies..."
cargo build --manifest-path=src/canisters/oracle/Cargo.toml || true

# Create necessary directories
echo "📁 Creating project directories..."
mkdir -p .dfx/local
mkdir -p src/canisters/{insurance,oracle,payments}
mkdir -p src/declarations
mkdir -p frontend/dist
mkdir -p tests/{unit,integration,e2e}
mkdir -p scripts

# Set up git configuration
echo "🔧 Configuring Git..."
git config --global --add safe.directory /workspace

# Copy environment template if not exists
if [ ! -f .env ]; then
    echo "🔧 Creating .env file from template..."
    cp .env.example .env
fi

# Create vessel configuration if not exists
if [ ! -f vessel.dhall ]; then
    echo "📦 Creating vessel configuration..."
    cat > vessel.dhall << 'EOF'
{
  dependencies = [
    "base",
    "matchers",
    "encoding",
    "sha256"
  ],
  compiler = None Text
}
EOF
fi

# Create package-set.dhall if not exists
if [ ! -f package-set.dhall ]; then
    echo "📦 Creating package-set configuration..."
    vessel init
fi

# Set up DFX identity
echo "🔑 Setting up DFX identity..."
dfx identity new devcontainer --storage-mode=plaintext || true
dfx identity use devcontainer

# Display principal
echo "📍 Your Principal ID:"
dfx identity get-principal

# Create a helpful README for the container
cat > /workspace/.devcontainer/README.md << 'EOF'
# Paramify ICP Development Container

## Quick Start

1. Start the local replica:
   ```bash
   dfx start --clean
   ```

2. Deploy canisters:
   ```bash
   npm run deploy:local
   ```

3. Start frontend:
   ```bash
   npm run dev:frontend
   ```

## Useful Commands

- `npm run verify` - Verify environment setup
- `npm run test` - Run all tests
- `npm run build` - Build all canisters
- `dfx identity get-principal` - Get your principal ID
- `dfx canister status --all` - Check all canister status

## Ports

- 4943: DFX Local Replica
- 3000: Frontend Dev Server
- 3001: Backend API
- 8080: Candid UI
- 8000: Documentation Server

## Documentation

See `/workspace/docs/setup.md` for detailed setup instructions.
EOF

echo "✅ Post-create setup complete!"
echo ""
echo "📚 See .devcontainer/README.md for quick start instructions"
echo "🎯 Run 'npm run verify' to check your environment"