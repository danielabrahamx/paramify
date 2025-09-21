# 🚀 AI Agent Quick Reference Card - Paramify ICP

## 🔴 CRITICAL: Security First!
```bash
# ALWAYS use fixed versions for production!
cp icp-canister/src/lib_fixed.rs icp-canister/src/lib.rs
cp frontend-icp/src/lib/icp_fixed.ts frontend-icp/src/lib/icp.ts  
cp backend/icp-oracle-fixed.js backend/icp-oracle.js
```

## 📍 Essential Files for AI Agents

| Purpose | File | Description |
|---------|------|-------------|
| **Understand Project** | `AI_AGENT_README.md` | Complete context |
| **Find Functions** | `AI_CODEBASE_MAP.md` | All functions mapped |
| **Deploy App** | `ICP_DEPLOYMENT_GUIDE.md` | Step-by-step |
| **Security Info** | `SECURITY_ASSESSMENT_REPORT.md` | All vulnerabilities |

## ⚡ Quick Deploy (Local)
```bash
# 1. Start ICP
dfx start --clean --background

# 2. Deploy contract with admin
dfx identity use admin  # Create with: dfx identity new admin
dfx deploy paramify_insurance --argument "(opt principal \"$(dfx identity get-principal)\")"

# 3. Deploy Internet Identity (CRITICAL!)
dfx deps deploy internet_identity

# 4. Start USGS server (CRITICAL!)
cd backend && node usgs-server.js &

# 5. Start frontend (recommended method)
cd frontend && npm run dev

# 6. Update frontend config with correct canister ID if needed
# Edit frontend/src/lib/icp.ts: CANISTER_ID = "$(dfx canister id paramify_insurance)"
```

**⚠️ USGS Server is REQUIRED:**
- Without it: "USGS Data Status: Disconnected"
- Provides flood data to admin/customer dashboards
- Essential for insurance transactions

## 🎯 Core Functions

### Create Policy
```rust
create_policy(premium: Nat, coverage: Nat) -> Result<PolicyId, String>
// User buys insurance
```

### Update Flood Level
```rust
set_flood_level(level: i64) -> Result<(), String>
// Oracle updates (rate limited 60s)
```

### Trigger Payout
```rust
trigger_payout() -> Result<Nat, String>
// User claims when flood > threshold
```

## 🔑 Key Security Features

| Feature | Implementation |
|---------|---------------|
| **Re-entrancy** | Guards on all updates |
| **Rate Limiting** | 60s between oracle updates |
| **Access Control** | Principal-based roles |
| **Admin Transfer** | 24-hour timelock |
| **Input Validation** | All parameters checked |
| **Cycle Protection** | Minimum balance required |

## 📊 System Constants

```rust
MIN_CYCLES = 1_000_000_000          // 1B cycles minimum
MAX_POLICIES = 100_000              // Storage limit
ORACLE_RATE_LIMIT = 60              // Seconds
ADMIN_TIMELOCK = 86400              // 24 hours
DEFAULT_THRESHOLD = 1200000000000   // 12 feet
POLICY_DURATION = 31536000000000000 // 1 year (nanoseconds)
```

## 🌊 Data Flow
```
USGS API (5 min) → Oracle Service → ICP Canister → Frontend UI
                     ↓                   ↓              ↓
                  Validates        Checks threshold  Shows status
```

## 🔧 Environment Variables
```bash
CANISTER_ID_PARAMIFY_INSURANCE=xxxxx-xxxxx-xxxxx-cai
ICP_HOST=http://localhost:8000  # or https://ic0.app
USGS_STATION_ID=01646500
NODE_ENV=development|production
```

## 🧪 Quick Tests
```bash
# Health check
dfx canister call paramify_insurance health_check

# Get flood level (in feet after conversion)
dfx canister call paramify_insurance get_flood_level

# Check cycles
dfx canister call paramify_insurance get_cycles_balance
```

## 🚨 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Insufficient cycles" | `dfx wallet send <canister> 2000000000000` |
| "Rate limit exceeded" | Wait 60 seconds |
| "Re-entrancy detected" | Sequential calls only |
| "Policy already exists" | User has active policy |
| "Flood below threshold" | Normal - no payout yet |
| "Internet Identity 404" | `dfx deps deploy internet_identity` |
| "Frontend hangs on deploy" | Use `npm run dev` instead of `dfx deploy frontend` |
| "Wrong canister ID error" | Update `frontend/src/lib/icp.ts` with correct ID |
| "Oracle unauthorized" | Re-run `add_oracle_updater` as admin |

## 📁 File Structure Pattern
```
*_fixed.rs/ts/js = SECURE (use these!)
*.rs/ts/js = ORIGINAL (has vulnerabilities)
```

## 🔍 Debug Commands
```bash
# View logs
dfx canister logs paramify_insurance

# Get events (admin only)
dfx canister call paramify_insurance get_events '(null, opt 50)'

# Check memory
dfx canister call paramify_insurance get_memory_stats
```

## 💡 AI Agent Tips

1. **Always check security first** - Use fixed versions
2. **Test locally before mainnet** - Use dfx local
3. **Monitor cycles constantly** - Prevent DoS
4. **Validate all inputs** - Follow existing patterns
5. **Log critical operations** - Use event system
6. **Handle errors gracefully** - Return Result types
7. **Document changes** - Update relevant .md files

## 🎯 Quick Decision Tree

```
Need to understand code? → AI_AGENT_README.md
Finding a function? → AI_CODEBASE_MAP.md  
Deploying the app? → ICP_DEPLOYMENT_GUIDE.md
Security concern? → SECURITY_ASSESSMENT_REPORT.md
Quick command? → This file (AI_QUICK_REFERENCE.md)
```

---

**Remember:** This is a production-ready, security-hardened ICP application. All critical vulnerabilities have been fixed in the `*_fixed` versions. Always prioritize security and test thoroughly!