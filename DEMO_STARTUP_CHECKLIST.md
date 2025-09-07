# 🚀 PARAMIFY DEMO STARTUP CHECKLIST

## Every Time You Load Up the Demo

### 1. 🔗 **Check Network Services**
```bash
# Verify Hardhat node is running
ps aux | grep "hardhat node"
netstat -tlnp | grep 8545

# If not running, start it:
cd /workspaces/Paramify
npx hardhat node --hostname 0.0.0.0 --port 8545 &
```

### 2. 📝 **Deploy Fresh Contracts**
> ⚠️ **CRITICAL**: Hardhat node resets blockchain state on restart

```bash
# Always redeploy contracts
cd /workspaces/Paramify
npx hardhat run scripts/deploy.js --network localhost

# Note the new addresses from output:
# MockV3Aggregator deployed to: 0x... 
# Paramify deployed to: 0x...
```

### 3. 🎯 **Update Contract Addresses in Frontend**
Edit `/workspaces/Paramify/frontend/src/lib/contract.ts`:
```typescript
export const PARAMIFY_ADDRESS = "0x..."; // ← UPDATE THIS
export const MOCK_ORACLE_ADDRESS = "0x..."; // ← UPDATE THIS
```

### 4. 💰 **Fund the Contract**
```bash
# Fund contract with initial ETH for payouts
cd /workspaces/Paramify
npx hardhat run scripts/fund-contract.js --network localhost
```

### 5. 🌐 **Start Frontend Server**
```bash
cd /workspaces/Paramify/frontend
npm run dev
# Usually runs on http://localhost:8080
```

### 6. ✅ **Verification Script**
Run this to verify everything is working:
```bash
cd /workspaces/Paramify
bash scripts/deployment-verification.sh
```

---

## 🔍 **Common Issues & Quick Fixes**

### Issue: "Contract not found" errors
**Fix**: Always redeploy contracts and update addresses

### Issue: "getContractBalance is not a function"  
**Fix**: Ensure ABI import uses `.abi` property:
```typescript
export const PARAMIFY_ABI = PARAMIFY_ABI_JSON.abi as any;
```

### Issue: Network connection problems
**Fix**: Check if using Codespaces - may need different RPC URL

### Issue: Frontend won't connect to MetaMask
**Fix**: Add Hardhat Local network to MetaMask:
- Network Name: Hardhat Local
- RPC URL: http://localhost:8545 (or Codespaces URL)
- Chain ID: 31337
- Currency: ETH

---

## 📋 **Pre-Demo Setup Commands**

Create this as a quick setup script:

```bash
#!/bin/bash
echo "🚀 Starting Paramify Demo Setup..."

# 1. Start Hardhat node
echo "Starting Hardhat node..."
cd /workspaces/Paramify
npx hardhat node --hostname 0.0.0.0 --port 8545 &
sleep 3

# 2. Deploy contracts
echo "Deploying contracts..."
DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy.js --network localhost)
echo "$DEPLOY_OUTPUT"

# 3. Extract addresses (you'll need to update contract.ts manually)
PARAMIFY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "Paramify deployed to:" | cut -d' ' -f4)
ORACLE_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "MockV3Aggregator deployed to:" | cut -d' ' -f4)

echo ""
echo "📝 UPDATE THESE ADDRESSES IN frontend/src/lib/contract.ts:"
echo "PARAMIFY_ADDRESS = \"$PARAMIFY_ADDR\""
echo "MOCK_ORACLE_ADDRESS = \"$ORACLE_ADDR\""

# 4. Fund contract
echo "Funding contract..."
npx hardhat run scripts/fund-contract.js --network localhost

# 5. Start frontend
echo "Starting frontend..."
cd frontend
npm run dev &

echo "✅ Demo setup complete!"
echo "Frontend: http://localhost:8080"
echo "Remember to update contract addresses in contract.ts!"
```

---

## 🎯 **Key Takeaway**

**The #1 thing that changes every demo session**: 
- **Contract addresses** - because Hardhat resets the blockchain
- Always redeploy and update the frontend contract addresses

Everything else (ABI, network config, frontend code) should remain stable.
