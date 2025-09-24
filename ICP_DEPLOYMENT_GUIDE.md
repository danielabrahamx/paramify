# 🚀 Complete ICP Deployment Guide - Paramify Insurance Platform

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setu**Step 2: Deploy to Testnet**
```bash
# Set testnet as target
export NETWORK=testnet

# Deploy canister
dfx deploy --network $NETWORK paramify_insurance --with-cycles 1000000000000

# Get testnet canister ID
export TESTNET_CANISTER_ID=$(dfx canister --network $NETWORK id paramify_insurance)
echo "Testnet Canister ID: $TESTNET_CANISTER_ID"
```

**DEPLOYMENT NOTE:** The actual deployment creates dynamic canister IDs that differ from documentation examples. Always use `dfx canister id <canister_name>` to get the correct IDs for your deployment.et Deployment](#testnet-deployment)
4. [Mainnet Deployment](#mainnet-deployment)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
```bash
# Install DFX (ICP SDK)
sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
dfx --version  # Should be 0.29.0 or higher

# Install Rust with WASM support
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install additional tools
npm install -g npm@latest
cargo install ic-cdk-optimizer --version 0.3.4
```

### Create Project Structure
```bash
# Clone repository
git clone -b icp-secure https://github.com/danielabrahamx/Paramify.git
cd Paramify

# Install dependencies
npm install
cd frontend-icp && npm install && cd ..
cd backend && npm install && cd ..
```

---

## Local Development Setup

### Step 1: Start Local ICP Replica
```bash
# Start clean local replica
dfx start --clean --background

# Verify it's running
dfx ping
```

### Step 2: Create Local Identities
```bash
# Create admin identity
dfx identity new admin
dfx identity use admin
export ADMIN_PRINCIPAL=$(dfx identity get-principal)

# Create oracle identity
dfx identity new oracle
dfx identity use oracle
export ORACLE_PRINCIPAL=$(dfx identity get-principal)

# Switch back to admin
dfx identity use admin
```

### Step 3: Deploy Canister Locally
```bash
# Deploy with initialization arguments
dfx deploy paramify_insurance --argument "(opt principal \"$ADMIN_PRINCIPAL\")"

# Get actual canister ID (will be dynamically generated)
export CANISTER_ID=$(dfx canister id paramify_insurance)
echo "Canister ID: $CANISTER_ID"

# IMPORTANT: If deployment fails with "no Wasm module", reinstall:
dfx canister install paramify_insurance --mode reinstall
```

### Step 4: Configure Oracle
```bash
# Add oracle as updater
dfx canister call paramify_insurance add_oracle_updater "(principal \"$ORACLE_PRINCIPAL\")"

# Create .env file
cat > .env << EOF
CANISTER_ID_PARAMIFY_INSURANCE=$CANISTER_ID
ICP_HOST=http://localhost:8000
USGS_STATION_ID=01646500
USGS_SECONDARY_STATION=01647000
NODE_ENV=development
EOF
```

### Step 5: Start USGS Data Server (CRITICAL!)
```bash
# This provides real-time flood data to the frontend
cd backend
npm install
node usgs-server.js &

# Verify it's running
curl http://localhost:3001/flood-data
# Should return: {"level": X.XX, "timestamp": "...", "stationName": "..."}
```

**⚠️ CRITICAL:** This USGS server is essential for the frontend to work:
- Provides flood data to admin and customer dashboards
- Without it, dashboards show "USGS Data Status: Disconnected"
- Required for insurance transactions to function properly
- **Must run separately from the oracle service**

### Step 6: Start Oracle Service (Optional for Local Testing)
```bash
# This updates the ICP canister with flood data (runs separately from USGS server)
cd backend
npm start
# Oracle will update flood levels in the canister every 5 minutes
```

**Note:** The Oracle and USGS server are different:
- **USGS Server** (usgs-server.js): Provides data to frontend UI
- **Oracle Service** (icp-oracle.js): Updates the blockchain canister

### Step 7: Deploy Frontend
```bash
# Note: Frontend deployment often hangs due to build complexity
# Alternative approach - run frontend development server directly:

cd frontend
npm install
npm run dev

# This starts frontend at http://localhost:5173 (typical Vite port)
# Update frontend/src/lib/icp.ts with correct canister ID if needed:
# const CANISTER_ID = "your-actual-canister-id"

# If you need dfx frontend deployment:
# dfx deploy frontend (may hang - Ctrl+C if needed)
```

**Note:** Frontend deployment via dfx can hang due to build complexity. Running `npm run dev` directly is more reliable for local testing.

### Step 8: Test Local Deployment
```bash
# Check health
dfx canister call paramify_insurance health_check

# Create test policy (as user)
dfx identity use default
dfx canister call paramify_insurance create_policy '(1000000, 10000000)'

# Check policy
dfx canister call paramify_insurance get_policy_by_holder "(principal \"$(dfx identity get-principal)\")"

# Simulate flood (as oracle)
dfx identity use oracle
dfx canister call paramify_insurance set_flood_level '(1300000000000)'  # 13 feet

# Trigger payout (as user)
dfx identity use default
dfx canister call paramify_insurance trigger_payout
```

## Common Deployment Issues & Solutions

### Internet Identity 404 Error
**Problem:** Clicking "Connect with Internet Identity" shows 404 error.
**Solution:** 
```bash
# Deploy Internet Identity canister
dfx deps deploy internet_identity
# OR
dfx deploy internet_identity
```

### Frontend Shows Wrong Canister ID
**Problem:** Authentication fails with "Canister not found" error.
**Solution:** Update frontend configuration with correct canister ID:
```bash
# Get correct canister ID
dfx canister id paramify_insurance

# Update frontend/src/lib/icp.ts:
# const CANISTER_ID = "your-actual-canister-id"
```

### Oracle Authorization Issues
**Problem:** "Unauthorized: Oracle updater access required"
**Solution:**
```bash
# Switch to admin and re-authorize oracle
dfx identity use admin
dfx canister call paramify_insurance add_oracle_updater "(principal \"oracle-principal-id\")"
```

### Frontend Build Hangs
**Problem:** `dfx deploy frontend` hangs indefinitely.
**Solution:** Use development server instead:
```bash
cd frontend
npm run dev  # Much more reliable
```

### Step 1: Get Testnet Cycles
```bash
# Get free testnet cycles from faucet
dfx wallet --network testnet quickstart

# Check balance
dfx wallet --network testnet balance
```

### Step 2: Deploy to Testnet
```bash
# Set testnet as target
export NETWORK=testnet

# Deploy canister
dfx deploy --network $NETWORK paramify_insurance --with-cycles 1000000000000

# Get testnet canister ID
export TESTNET_CANISTER_ID=$(dfx canister --network $NETWORK id paramify_insurance)
echo "Testnet Canister ID: $TESTNET_CANISTER_ID"
```

### Step 3: Configure for Testnet
```bash
# Update .env for testnet
cat > .env.testnet << EOF
CANISTER_ID_PARAMIFY_INSURANCE=$TESTNET_CANISTER_ID
ICP_HOST=https://testnet.dfinity.network
USGS_STATION_ID=01646500
NODE_ENV=testnet
EOF

# Configure oracle for testnet
dfx identity use oracle
dfx canister --network $NETWORK call paramify_insurance add_oracle_updater "(principal \"$ORACLE_PRINCIPAL\")"
```

### Step 4: Run Integration Tests
```bash
# Run test suite
npm run test:testnet

# Monitor canister
dfx canister --network $NETWORK status paramify_insurance
dfx canister --network $NETWORK logs paramify_insurance
```

---

## Mainnet Deployment

### ⚠️ Pre-Deployment Checklist
- [ ] Security audit completed
- [ ] Testnet testing successful
- [ ] Cycles wallet funded (minimum 5T cycles)
- [ ] Admin keys secured (hardware wallet recommended)
- [ ] Oracle identity backed up
- [ ] Monitoring setup ready

### Step 1: Prepare Production Configuration
```bash
# Create production identity with seed phrase
dfx identity new production --storage-mode=plaintext
dfx identity use production

# Export and secure seed phrase
dfx identity export production > production_identity.pem
# STORE THIS SECURELY - USE HARDWARE SECURITY MODULE IF POSSIBLE

# Get production principal
export PROD_ADMIN_PRINCIPAL=$(dfx identity get-principal)
```

### Step 2: Fund with Cycles
```bash
# Convert ICP to cycles (requires ICP tokens)
dfx ledger --network ic top-up $(dfx identity get-wallet) --amount 10

# Check cycles balance
dfx wallet --network ic balance
```

### Step 3: Deploy to Mainnet
```bash
# Deploy with production configuration
dfx deploy --network ic paramify_insurance \
  --with-cycles 2000000000000 \
  --argument "(opt principal \"$PROD_ADMIN_PRINCIPAL\")"

# Get mainnet canister ID
export MAINNET_CANISTER_ID=$(dfx canister --network ic id paramify_insurance)
echo "Mainnet Canister ID: $MAINNET_CANISTER_ID"

# Verify deployment
dfx canister --network ic status paramify_insurance
```

### Step 4: Configure Production Oracle
```bash
# Generate secure oracle identity
openssl rand -hex 32 > oracle_seed.txt
export ORACLE_SEED_PHRASE=$(cat oracle_seed.txt)

# Create production oracle identity
dfx identity import oracle_prod oracle_seed.txt
dfx identity use oracle_prod
export PROD_ORACLE_PRINCIPAL=$(dfx identity get-principal)

# Authorize oracle
dfx identity use production
dfx canister --network ic call paramify_insurance add_oracle_updater "(principal \"$PROD_ORACLE_PRINCIPAL\")"
```

### Step 5: Deploy Production Oracle Service
```bash
# Create production environment file
cat > .env.production << EOF
CANISTER_ID_PARAMIFY_INSURANCE=$MAINNET_CANISTER_ID
ICP_HOST=https://ic0.app
USGS_STATION_ID=01646500
USGS_SECONDARY_STATION=01647000
ORACLE_SEED_PHRASE=$ORACLE_SEED_PHRASE
NODE_ENV=production
ALERT_WEBHOOK_URL=https://your-monitoring.com/webhook
EOF

# Deploy oracle to production server (e.g., AWS, GCP)
# Use PM2 for process management
npm install -g pm2
pm2 start backend/icp-oracle.js --name paramify-oracle
pm2 save
pm2 startup
```

### Step 6: Deploy Frontend to IC
```bash
# Build production frontend
cd frontend-icp
npm run build

# Deploy frontend canister
dfx deploy --network ic frontend --with-cycles 1000000000000

# Get frontend URL
echo "Frontend URL: https://$(dfx canister --network ic id frontend).ic0.app"
```

---

## Post-Deployment Configuration

### Set Production Parameters
```bash
# Set flood threshold (12 feet default)
dfx canister --network ic call paramify_insurance set_flood_threshold '(1200000000000)'

# Configure monitoring
dfx canister --network ic call paramify_insurance health_check
```

### Setup Monitoring
```bash
# Create monitoring script
cat > monitor.sh << 'EOF'
#!/bin/bash
while true; do
  # Check canister health
  HEALTH=$(dfx canister --network ic call paramify_insurance health_check)
  
  # Check cycles
  CYCLES=$(dfx canister --network ic call paramify_insurance get_cycles_balance)
  
  # Alert if cycles low
  if [ $CYCLES -lt 1000000000000 ]; then
    curl -X POST $ALERT_WEBHOOK_URL -d "Low cycles: $CYCLES"
  fi
  
  sleep 300  # Check every 5 minutes
done
EOF

chmod +x monitor.sh
pm2 start monitor.sh --name paramify-monitor
```

### Backup Configuration
```bash
# Backup canister state
dfx canister --network ic status paramify_insurance > backup_status.txt

# Export canister wasm
dfx canister --network ic dump paramify_insurance > canister_backup.wasm

# Schedule regular backups
crontab -e
# Add: 0 0 * * * /path/to/backup_script.sh
```

---

## Monitoring & Maintenance

### Regular Tasks
```bash
# Daily health check
dfx canister --network ic call paramify_insurance health_check

# Check oracle status
pm2 status paramify-oracle
pm2 logs paramify-oracle --lines 100

# Monitor cycles
dfx canister --network ic call paramify_insurance get_cycles_balance

# Clean up expired policies (monthly)
dfx canister --network ic call paramify_insurance cleanup_expired_policies
```

### Top-up Cycles
```bash
# When cycles run low
dfx wallet --network ic send $MAINNET_CANISTER_ID 1000000000000
```

### Upgrade Canister
```bash
# Prepare upgrade
dfx build --network ic paramify_insurance

# Perform upgrade with authorization
dfx canister --network ic install paramify_insurance --mode upgrade \
  --argument "(opt record { 
    authorized_by = principal \"$PROD_ADMIN_PRINCIPAL\"; 
    upgrade_time = $(date +%s); 
    version = \"1.1.0\" 
  })"
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Insufficient cycles"
```bash
# Top up canister
dfx wallet --network ic send $CANISTER_ID 2000000000000
```

#### Issue: "Rate limit exceeded"
```bash
# Check last update time
dfx canister --network ic call paramify_insurance get_oracle_history '(opt 10)'
# Wait 60 seconds between updates
```

#### Issue: "Cannot connect to replica"
```bash
# Restart local replica
dfx stop
dfx start --clean
```

#### Issue: "Oracle not updating"
```bash
# Check oracle logs
pm2 logs paramify-oracle --lines 200

# Restart oracle
pm2 restart paramify-oracle

# Verify oracle authorization
dfx canister --network ic call paramify_insurance get_oracle_updaters
```

#### Issue: "Frontend not loading"
```bash
# Clear browser cache
# Check console for errors
# Verify canister ID in frontend config
# Rebuild and redeploy frontend
```

### Debug Commands
```bash
# Get detailed canister info
dfx canister --network ic info paramify_insurance

# View recent events
dfx canister --network ic call paramify_insurance get_events '(null, opt 50)'

# Check memory usage
dfx canister --network ic call paramify_insurance get_memory_stats
```

---

## Security Reminders

1. **Always use hardware wallets for production admin keys**
2. **Enable multi-signature for admin operations**
3. **Regular security audits (quarterly)**
4. **Monitor for anomalous activity**
5. **Keep oracle keys secure and rotated**
6. **Implement rate limiting on all public endpoints**
7. **Regular backups of canister state**
8. **Test upgrades on testnet first**

---

## Support Resources

- **ICP Forum:** https://forum.dfinity.org
- **Discord:** https://discord.gg/dfinity
- **Documentation:** https://internetcomputer.org/docs
- **Status Page:** https://status.internetcomputer.org

---

**Last Updated:** September 2024
**Version:** 1.0.0-secure