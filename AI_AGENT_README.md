# 🤖 AI Agent Complete Guide - Paramify ICP Decentralized Insurance

## Quick Context for AI Agents

**What is this?** A decentralized flood insurance platform on Internet Computer Protocol (ICP) that automatically pays out when flood levels exceed thresholds.

**Tech Stack:**
- **Backend:** Rust-based ICP canister (smart contract)
- **Frontend:** React + TypeScript with ICP integration
- **Oracle:** Node.js service fetching USGS flood data
- **Authentication:** Internet Identity (ICP's decentralized auth)

**Current Branch:** `icp-secure` - Contains security-hardened implementation

## 🎯 Project Structure Overview

```
paramify/
├── icp-canister/           # Main ICP smart contract (Rust)
│   ├── src/
│   │   ├── lib.rs         # Original canister code (HAS VULNERABILITIES)
│   │   └── lib_fixed.rs   # SECURE VERSION - Use this for production
│   └── Cargo.toml         # Rust dependencies
│
├── frontend-icp/           # ICP-specific frontend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── icp.ts    # Original auth (MOCK - DO NOT USE)
│   │   │   └── icp_fixed.ts # SECURE auth implementation
│   │   └── components/    # React components
│   └── package.json       # Frontend dependencies
│
├── backend/               # Oracle service
│   ├── icp-oracle.js     # Original oracle (LACKS VALIDATION)
│   └── icp-oracle-fixed.js # SECURE oracle with validation
│
├── dfx.json              # ICP deployment configuration
├── .env.example          # Environment variables template
│
└── Documentation/
    ├── AI_AGENT_README.md           # THIS FILE - AI agent guide
    ├── SECURITY_ASSESSMENT_REPORT.md # Critical security findings
    ├── ICP_DEPLOYMENT_GUIDE.md      # Step-by-step deployment
    └── AI_CODEBASE_MAP.md           # Complete code mapping

```

## 🚨 CRITICAL SECURITY NOTICE

**⚠️ The original code has 5 CRITICAL and 8 MAJOR vulnerabilities!**

Always use the `*_fixed` versions:
- `icp-canister/src/lib_fixed.rs` instead of `lib.rs`
- `frontend-icp/src/lib/icp_fixed.ts` instead of `icp.ts`
- `backend/icp-oracle-fixed.js` instead of `icp-oracle.js`

See `SECURITY_ASSESSMENT_REPORT.md` for complete vulnerability details.

## 🔑 Key Concepts for AI Understanding

### 1. **ICP Canister (Smart Contract)**
- Written in Rust, compiles to WebAssembly
- Stores insurance policies in stable memory (persists across upgrades)
- Uses Principal IDs (ICP's identity system) instead of Ethereum addresses
- Cycles = ICP's computation fuel (like Ethereum gas)

### 2. **Core Functions**
```rust
// User Functions
create_policy(premium, coverage) -> PolicyId
trigger_payout() -> Coverage amount
get_policy_by_holder(principal) -> Policy

// Oracle Functions (Protected)
set_flood_level(level) -> Updates flood data

// Admin Functions (Protected)
set_flood_threshold(threshold) -> Set trigger level
add_oracle_updater(principal) -> Authorize oracle
```

### 3. **Security Features (in _fixed versions)**
- Re-entrancy guards on all state changes
- Rate limiting on oracle updates (60s minimum)
- Two-phase admin transfer with 24h timelock
- Integer overflow protection
- Comprehensive event logging
- Cycle depletion protection

### 4. **Data Flow**
```
USGS API → Node.js Oracle → ICP Canister → Frontend UI
   ↓           ↓                ↓              ↓
Real flood  Validates &    Stores level   Shows data &
  data      updates chain   Checks threshold  payouts
```

## 📋 Environment Setup Requirements

### Prerequisites
- **dfx** (ICP SDK): Version 0.29.0+
- **Rust**: Latest stable with wasm32 target
- **Node.js**: v18+ for oracle and frontend
- **Internet Identity**: For production authentication

### Required Environment Variables
```bash
# .env file
CANISTER_ID_PARAMIFY_INSURANCE=<deployed_canister_id>
ICP_HOST=http://localhost:8000  # or https://ic0.app for mainnet
USGS_STATION_ID=01646500        # Potomac River station
ORACLE_SEED_PHRASE=<hex_seed>   # For oracle identity (production only)
```

## 🚀 Quick Deployment Commands

### Local Development
```bash
# 1. Start local ICP replica
dfx start --clean --background

# 2. Create identities
dfx identity new admin && dfx identity use admin
dfx identity new oracle

# 3. Deploy canister with admin
dfx deploy paramify_insurance --argument "(opt principal \"$(dfx identity get-principal)\")"

# 4. Deploy Internet Identity (ESSENTIAL!)
dfx deps deploy internet_identity

# 5. Start USGS data server (CRITICAL FOR FRONTEND!)
cd backend
npm install
node usgs-server.js &

# 6. Configure oracle
dfx canister call paramify_insurance add_oracle_updater "(principal \"$(dfx identity use oracle && dfx identity get-principal)\")"

# 7. Start frontend (RECOMMENDED METHOD)
cd frontend
npm install
npm run dev  # More reliable than dfx deploy frontend
```

**⚠️ CRITICAL NOTES:**
- Internet Identity deployment is required: `dfx deps deploy internet_identity`
- Frontend canister deployment often hangs - use `npm run dev` instead
- USGS server must run separately from oracle service
- Always check canister IDs with `dfx canister id <name>` - they're dynamically generated

### Production Deployment
```bash
# 1. Deploy to IC mainnet
dfx deploy --network ic paramify_insurance

# 2. Set up oracle with proper identity
export ORACLE_SEED_PHRASE=<your_secure_seed>
node backend/icp-oracle-fixed.js

# 3. Deploy frontend to IC
dfx deploy --network ic frontend
```

## 🔍 Key Files to Understand

### 1. Main Canister Logic
**File:** `icp-canister/src/lib_fixed.rs`
- Policy creation and management
- Payout logic with threshold checking
- Oracle update mechanism
- Admin functions

### 2. Frontend Integration
**File:** `frontend-icp/src/lib/icp_fixed.ts`
- Internet Identity authentication
- Canister communication
- Policy management UI calls

### 3. Oracle Service
**File:** `backend/icp-oracle-fixed.js`
- USGS data fetching
- Data validation and anomaly detection
- Automatic canister updates
- Failover mechanisms

## 📊 System State & Data Structures

### Policy Structure
```rust
struct Policy {
    policy_id: u64,
    policyholder: Principal,
    premium: Nat,
    coverage: Nat,
    purchase_time: u64,
    active: bool,
    paid_out: bool,
    expiration_time: u64,
}
```

### Current System Parameters
- **Default Flood Threshold:** 12 feet (1200000000000 scaled units)
- **Premium Rate:** ~10% of coverage
- **Update Rate:** Oracle updates every 5 minutes
- **Rate Limit:** 60 seconds between oracle updates
- **Policy Duration:** 1 year from purchase

## 🧪 Testing Instructions

### Unit Tests
```bash
# Run canister tests
cd icp-canister
cargo test

# Run frontend tests
cd frontend-icp
npm test
```

### Integration Testing
```bash
# Test policy creation
dfx canister call paramify_insurance create_policy '(1000000, 10000000)'

# Test flood level update
dfx canister call paramify_insurance set_flood_level '(1300000000000)'

# Test payout trigger
dfx canister call paramify_insurance trigger_payout
```

## 🔧 Common Tasks for AI Agents

### 1. Fix a Bug in Canister
1. Locate the issue in `lib_fixed.rs`
2. Make changes following Rust/ICP best practices
3. Test locally: `dfx deploy --local`
4. Run tests: `cargo test`

### 2. Add New Feature
1. Update canister interface in `lib_fixed.rs`
2. Add corresponding frontend function in `icp_fixed.ts`
3. Update Candid interface if needed
4. Test end-to-end flow

### 3. Update Oracle Logic
1. Modify `icp-oracle-fixed.js`
2. Ensure validation remains intact
3. Test with mock USGS data
4. Verify rate limiting works

### 4. Deploy to Production
1. Review `SECURITY_ASSESSMENT_REPORT.md`
2. Set production environment variables
3. Deploy with `dfx deploy --network ic`
4. Monitor with health checks

## 📚 Additional Resources

### Critical Documentation
- **Security:** `SECURITY_ASSESSMENT_REPORT.md` - MUST READ before any changes
- **Deployment:** `ICP_DEPLOYMENT_GUIDE.md` - Complete deployment steps
- **Code Map:** `AI_CODEBASE_MAP.md` - Detailed function-by-function guide

### ICP-Specific Resources
- **Candid Interface:** Defines canister API
- **Stable Memory:** Persists data across upgrades
- **Principal IDs:** User identity system
- **Cycles:** Computation payment mechanism

## ⚠️ Critical Warnings

1. **NEVER use original non-fixed files in production**
2. **Always maintain re-entrancy guards**
3. **Keep rate limiting on oracle updates**
4. **Test thoroughly before mainnet deployment**
5. **Monitor cycles to prevent depletion**

## 🆘 Troubleshooting Guide

### Common Issues
1. **"Insufficient cycles"** - Top up canister with cycles
2. **"Rate limit exceeded"** - Wait 60s between oracle updates
3. **"Policy already exists"** - User has active policy
4. **"Flood level below threshold"** - Normal, payout not triggered
5. **"Re-entrancy detected"** - Concurrent modification attempted
6. **"Internet Identity 404"** - Run `dfx deps deploy internet_identity`
7. **"Frontend deployment hangs"** - Use `npm run dev` instead of `dfx deploy frontend`
8. **"Wrong canister ID in frontend"** - Update `frontend/src/lib/icp.ts` with correct ID
9. **"Oracle unauthorized"** - Re-authorize with `add_oracle_updater` as admin
10. **"No policy found"** - Create policy first or check user identity matches

### Debug Commands
```bash
# Check canister status
dfx canister status paramify_insurance

# View canister logs
dfx canister logs paramify_insurance

# Check cycle balance
dfx canister call paramify_insurance get_cycles_balance

# Health check
dfx canister call paramify_insurance health_check
```

## 📈 Performance Optimization Tips

1. **Batch Operations:** Process multiple policies together
2. **Cache Flood Data:** Reduce USGS API calls
3. **Optimize Stable Memory:** Clean up expired policies
4. **Monitor Cycles:** Set up alerts for low balance
5. **Use Circuit Breaker:** Prevent cascade failures

---

**For AI Agents:** This document provides complete context to understand, modify, deploy, and maintain the Paramify ICP insurance platform. Always prioritize security, use the fixed versions of files, and test thoroughly before any production deployment.