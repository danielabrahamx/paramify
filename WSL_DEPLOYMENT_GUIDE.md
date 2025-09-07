# Paramify ICP Deployment Guide (WSL)

## 🚀 Complete ICP Transformation Deployment

This guide provides step-by-step instructions for deploying the fully transformed Paramify ICP flood insurance system in WSL.

## Prerequisites

- WSL Ubuntu installed and running
- Project cloned to WSL filesystem (`~/Paramify-5`)
- Never develop in Windows filesystem (`/mnt/c/`)

## Step 1: WSL Environment Setup

Open WSL Ubuntu terminal and run:

```bash
# Navigate to WSL home directory
cd ~

# Copy project from Windows (if not already done)
cp -r /mnt/c/Users/danie/Paramify-5 ~/

# Navigate to project
cd ~/Paramify-5

# Run setup script
chmod +x setup-wsl-icp.sh
./setup-wsl-icp.sh

# Source updated environment
source ~/.bashrc
```

## Step 2: Verify Installations

```bash
# Check DFX
dfx --version
# Expected: dfx 0.15.x or higher

# Check Rust
rustc --version
cargo --version
# Expected: rustc 1.75.x or higher

# Check Node.js
node --version
npm --version
# Expected: node v18.x or higher
```

## Step 3: Start ICP Local Network

```bash
# Stop any existing DFX processes
dfx stop

# Start clean ICP network
dfx start --clean --background

# Verify network is running
dfx ping
```

## Step 4: Build and Deploy Canisters

```bash
# Build the Rust canister
cargo build --manifest-path=canister/Cargo.toml --release --target wasm32-unknown-unknown

# Deploy all canisters
dfx deploy --network local

# Get canister IDs
echo "Insurance Canister ID:"
dfx canister id paramify_insurance --network local

echo "Frontend Canister ID:"
dfx canister id frontend --network local
```

## Step 5: Fund the Insurance Canister

```bash
# Get your principal ID
PRINCIPAL=$(dfx identity get-principal)
echo "Your Principal: $PRINCIPAL"

# Fund the contract (simulated - in production would use ICP ledger)
dfx canister call paramify_insurance fund_contract "(1000000000)" --network local
```

## Step 6: Start Oracle Service

Open a new WSL terminal:

```bash
cd ~/Paramify-5/backend

# Install dependencies
npm install

# Set environment variables
export CANISTER_ID_PARAMIFY_INSURANCE=$(dfx canister id paramify_insurance --network local)
export ICP_HOST=http://localhost:8000

# Start oracle service
npm start
```

You should see:
```
✅ ICP Oracle initialized
📍 Canister ID: [your-canister-id]
🌐 Host: http://localhost:8000
🚰 USGS Station: 01646500
📅 Scheduled updates enabled (every 5 minutes)
🚀 ICP Oracle Server running on port 3001
```

## Step 7: Build and Start Frontend

Open another WSL terminal:

```bash
cd ~/Paramify-5/frontend

# Install dependencies
npm install

# Set canister ID environment variable
export CANISTER_ID_PARAMIFY_INSURANCE=$(dfx canister id paramify_insurance --network local)

# Start development server
npm run dev
```

Access frontend at: `http://localhost:5173`

## Step 8: Test the System

### 1. Login with Internet Identity

- Open browser to `http://localhost:5173`
- Click "Login with Internet Identity"
- Create new identity or use existing
- Your ICP Principal will be displayed

### 2. Create Insurance Policy

```bash
# Via CLI
dfx canister call paramify_insurance create_policy '(record {coverage_amount = 100000000})' --network local

# Via Frontend
# - Enter coverage amount (in ICP)
# - Premium automatically calculated (10%)
# - Click "Buy Insurance"
```

### 3. Check Flood Data

```bash
# Via CLI
dfx canister call paramify_insurance get_flood_data --network local

# Via API
curl http://localhost:3001/flood-data

# Via Frontend
# - Live flood level displayed on dashboard
```

### 4. Trigger Manual Oracle Update

```bash
# Via API
curl -X POST http://localhost:3001/update

# Check system status
dfx canister call paramify_insurance get_system_status --network local
```

### 5. Test Payout (Admin Only)

```bash
# Set flood level above threshold (admin only)
dfx canister call paramify_insurance set_flood_level "(4.5, opt \"01646500\")" --network local

# Check if eligible for payout
dfx canister call paramify_insurance is_payout_eligible --network local

# Trigger payout
dfx canister call paramify_insurance trigger_payout --network local
```

## Step 9: Sync to Windows for Git

After making changes in WSL:

```bash
cd ~/Paramify-5

# Run sync script
./sync-to-windows.sh

# Now you can commit from Windows
```

## Troubleshooting

### DFX Network Issues

```bash
# If DFX won't start
dfx stop
killall dfx replica
dfx start --clean --background
```

### Canister Build Errors

```bash
# Clean and rebuild
cargo clean --manifest-path=canister/Cargo.toml
rm -rf .dfx
dfx start --clean --background
dfx deploy --network local
```

### Oracle Connection Issues

```bash
# Check canister is deployed
dfx canister status paramify_insurance --network local

# Check network connectivity
curl http://localhost:8000/_/dashboard

# Restart oracle with correct canister ID
export CANISTER_ID_PARAMIFY_INSURANCE=$(dfx canister id paramify_insurance --network local)
cd ~/Paramify-5/backend && npm start
```

### Frontend Issues

```bash
# Clear cache and rebuild
cd ~/Paramify-5/frontend
rm -rf node_modules dist
npm install
npm run dev
```

## Important WSL Notes

1. **ALWAYS** develop in WSL filesystem (`~/Paramify-5`)
2. **NEVER** run DFX commands from Windows filesystem (`/mnt/c/`)
3. Use `./sync-to-windows.sh` only when ready to commit
4. Keep all terminals in WSL Ubuntu
5. Access web interfaces from Windows browser

## Production Deployment

For mainnet deployment:

```bash
# Deploy to IC mainnet
dfx deploy --network ic

# Get mainnet canister IDs
dfx canister id paramify_insurance --network ic
dfx canister id frontend --network ic

# Update oracle to use mainnet
export ICP_HOST=https://ic0.app
export CANISTER_ID_PARAMIFY_INSURANCE=[mainnet-canister-id]
```

## Validation Checklist

- [ ] DFX network running in WSL
- [ ] Canisters deployed successfully
- [ ] Oracle service connected and updating
- [ ] Frontend accessible at localhost:5173
- [ ] Internet Identity login working
- [ ] Policy creation with ICP e-8s working
- [ ] USGS data updating every 5 minutes
- [ ] Payout triggers when flood > threshold
- [ ] No Ethereum/MetaMask references remain
- [ ] All development in WSL filesystem

## Support

For issues, check:
- DFX logs: `dfx logs --network local`
- Canister status: `dfx canister status --all --network local`
- Oracle logs: Check terminal running `npm start` in backend
- Frontend console: Browser developer tools

Remember: **All development must happen in WSL!**
