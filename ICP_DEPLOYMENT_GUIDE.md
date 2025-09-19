# 🚀 Complete ICP Deployment Guide - Paramify Insurance Platform

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Testnet Deployment](#testnet-deployment)
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
# First, update the canister code to use lib_fixed.rs
cp icp-canister/src/lib_fixed.rs icp-canister/src/lib.rs

# Deploy with initialization arguments
dfx deploy paramify_insurance --argument "(opt principal \"$ADMIN_PRINCIPAL\")"

# Get canister ID
export CANISTER_ID=$(dfx canister id paramify_insurance)
echo "Canister ID: $CANISTER_ID"
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

### Step 5: Start Oracle Service
```bash
# Use the fixed oracle version
cp backend/icp-oracle-fixed.js backend/icp-oracle.js

# Start oracle
cd backend
npm start
# Oracle will update flood levels every 5 minutes
```

### Step 6: Deploy Frontend
```bash
# Update frontend to use fixed authentication
cp frontend-icp/src/lib/icp_fixed.ts frontend-icp/src/lib/icp.ts

# Build and deploy frontend
cd frontend-icp
npm run build
dfx deploy frontend

# Get frontend URL
echo "Frontend URL: http://$(dfx canister id frontend).localhost:8000"
```

### Step 7: Test Local Deployment
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

---

## Testnet Deployment

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
- [ ] All security fixes applied (use `*_fixed` files)
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
pm2 start backend/icp-oracle-fixed.js --name paramify-oracle
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