# Paramify ICP Troubleshooting Guide

## Table of Contents
1. [Common Issues](#common-issues)
2. [Deployment Problems](#deployment-problems)
3. [Canister Errors](#canister-errors)
4. [Frontend Issues](#frontend-issues)
5. [Authentication Problems](#authentication-problems)
6. [Payment/Token Issues](#paymenttoken-issues)
7. [Oracle/Data Issues](#oracledata-issues)
8. [Performance Problems](#performance-problems)
9. [Development Environment](#development-environment)
10. [Emergency Procedures](#emergency-procedures)

## Common Issues

### Issue: "Cannot find module '@dfinity/agent'"

**Symptoms:**
- Frontend fails to compile
- Import errors in TypeScript/JavaScript

**Solution:**
```bash
# Install missing dependencies
cd frontend
npm install @dfinity/agent @dfinity/principal @dfinity/candid @dfinity/auth-client
```

**Prevention:**
- Always run `npm install` after pulling changes
- Check package.json for required dependencies

---

### Issue: "Failed to fetch root key"

**Symptoms:**
- Agent initialization fails
- Cannot connect to local replica

**Solution:**
```javascript
// Only fetch root key in development
if (process.env.NODE_ENV === 'development') {
  try {
    await agent.fetchRootKey();
  } catch (error) {
    console.warn('Root key fetch failed (expected in production)');
  }
}
```

---

### Issue: "Principal is not defined"

**Symptoms:**
- Runtime error when using Principal
- TypeScript compilation errors

**Solution:**
```typescript
import { Principal } from '@dfinity/principal';

// Use Principal correctly
const principal = Principal.fromText('rrkah-fqaaa-aaaaa-aaaaq-cai');
```

## Deployment Problems

### Issue: "dfx: command not found"

**Solution:**
```bash
# Install DFX
sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"

# Add to PATH
export PATH=$HOME/bin:$PATH
echo 'export PATH=$HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

---

### Issue: "Failed to deploy canister: insufficient cycles"

**Symptoms:**
- Deployment fails with cycles error
- Canister creation rejected

**Solution:**
```bash
# Check wallet balance
dfx wallet balance

# Top up wallet (testnet)
dfx wallet send <amount> <canister-id>

# For mainnet, purchase cycles
dfx ledger top-up <wallet-id> --amount 10
```

---

### Issue: "WASM module too large"

**Symptoms:**
- Canister deployment fails
- "Wasm module size exceeds limit" error

**Solution:**
```bash
# Optimize WASM for Rust canisters
cargo install ic-wasm
ic-wasm target/wasm32-unknown-unknown/release/oracle.wasm \
        -o target/wasm32-unknown-unknown/release/oracle_optimized.wasm shrink

# For Motoko, use optimization flags
dfx build --with-cycles 100000000000 --optimize-cycles
```

## Canister Errors

### Issue: "Canister trapped: assertion failed"

**Symptoms:**
- Canister call fails
- Trap error in response

**Common Causes & Solutions:**

1. **Unauthorized Access:**
```motoko
// Check authorization
if (not isAuthorized(msg.caller)) {
    return #err("Unauthorized");
};
```

2. **Invalid Input:**
```motoko
// Validate input
if (amount <= 0) {
    return #err("Amount must be positive");
};
```

3. **State Inconsistency:**
```bash
# Check canister state
dfx canister call <canister> get_system_status

# Reinstall if corrupted (CAUTION: may lose state)
dfx canister install <canister> --mode reinstall
```

---

### Issue: "Out of cycles"

**Symptoms:**
- Canister stops responding
- "out of cycles" in error message

**Solution:**
```bash
# Check cycles balance
dfx canister status <canister-name>

# Top up cycles
dfx canister deposit-cycles 1000000000000 <canister-id>

# Monitor cycles consumption
dfx canister call <canister> get_cycles_balance
```

---

### Issue: "Canister upgrade failed"

**Symptoms:**
- Upgrade command fails
- State migration errors

**Solution:**
```motoko
// Ensure proper upgrade hooks
system func preupgrade() {
    // Save state to stable storage
    stableData := Iter.toArray(data.entries());
};

system func postupgrade() {
    // Restore state from stable storage
    data := HashMap.fromIter(stableData.vals(), stableData.size(), Text.equal, Text.hash);
    stableData := [];
};
```

## Frontend Issues

### Issue: "Cannot connect to canister"

**Symptoms:**
- Frontend shows connection errors
- Actor creation fails

**Diagnosis:**
```javascript
// Check canister ID
console.log('Canister ID:', process.env.REACT_APP_INSURANCE_CANISTER_ID);

// Check agent configuration
console.log('Host:', agent.host);
console.log('Is local:', process.env.NODE_ENV === 'development');
```

**Solution:**
```javascript
// Correct actor creation
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from './insurance.did.js';

const agent = new HttpAgent({
  host: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:4943' 
    : 'https://ic0.app'
});

const actor = Actor.createActor(idlFactory, {
  agent,
  canisterId: 'your-canister-id'
});
```

---

### Issue: "BigInt serialization error"

**Symptoms:**
- JSON.stringify fails with BigInt
- Console errors about BigInt

**Solution:**
```javascript
// Custom JSON serialization
JSON.stringify(data, (key, value) =>
  typeof value === 'bigint' ? value.toString() : value
);

// Or use a library
import JSONbig from 'json-bigint';
const serialized = JSONbig.stringify(data);
```

## Authentication Problems

### Issue: "Internet Identity login fails"

**Symptoms:**
- Login button doesn't work
- Redirect fails
- No principal returned

**Solution:**
```javascript
// Correct Internet Identity integration
import { AuthClient } from '@dfinity/auth-client';

const authClient = await AuthClient.create();

authClient.login({
  identityProvider: process.env.NODE_ENV === 'development'
    ? `http://localhost:4943?canisterId=${II_CANISTER_ID}`
    : 'https://identity.ic0.app',
  onSuccess: () => {
    const identity = authClient.getIdentity();
    const principal = identity.getPrincipal();
    console.log('Logged in as:', principal.toString());
  },
  onError: (error) => {
    console.error('Login failed:', error);
  }
});
```

---

### Issue: "Principal mismatch"

**Symptoms:**
- User appears logged out
- Different principal than expected

**Solution:**
```javascript
// Ensure consistent identity
const identity = await authClient.getIdentity();
const agent = new HttpAgent({ identity });

// Verify principal
const principal = identity.getPrincipal();
console.log('Current principal:', principal.toString());
```

## Payment/Token Issues

### Issue: "Insufficient funds for transfer"

**Symptoms:**
- Token transfer fails
- Payment processing errors

**Diagnosis:**
```bash
# Check balance
dfx canister call icrc1_ledger icrc1_balance_of '(record {
  owner = principal "<your-principal>";
  subaccount = null;
})'
```

**Solution:**
```bash
# Mint tokens (testnet only)
dfx canister call icrc1_ledger mint '(record {
  to = record {
    owner = principal "<recipient>";
    subaccount = null;
  };
  amount = 1000000000;
})'
```

---

### Issue: "Transfer fee mismatch"

**Symptoms:**
- Transfer rejected
- "BadFee" error

**Solution:**
```motoko
// Use correct fee
let fee = 10_000; // 0.0001 tokens
let transferArg = {
  to = recipient;
  amount = amount;
  fee = ?fee; // Include fee
  memo = null;
  created_at_time = null;
};
```

## Oracle/Data Issues

### Issue: "HTTPS outcall failed"

**Symptoms:**
- Oracle data not updating
- Outcall timeout errors

**Diagnosis:**
```bash
# Check oracle status
dfx canister call oracle get_status

# View logs
dfx canister logs oracle
```

**Solution:**
```rust
// Implement retry logic
async fn fetch_with_retry(url: &str, max_retries: u32) -> Result<String, String> {
    for attempt in 0..max_retries {
        match make_https_outcall(url).await {
            Ok(response) => return Ok(response),
            Err(e) if attempt < max_retries - 1 => {
                ic_cdk::println!("Attempt {} failed: {}, retrying...", attempt, e);
                continue;
            }
            Err(e) => return Err(e),
        }
    }
    Err("Max retries exceeded".to_string())
}
```

---

### Issue: "Invalid flood data"

**Symptoms:**
- Flood level shows as 0 or null
- Parsing errors in logs

**Solution:**
```rust
// Add validation
fn validate_flood_data(value: f64) -> Result<i32, String> {
    if value < 0.0 || value > 100.0 {
        return Err("Flood level out of range".to_string());
    }
    Ok((value * 100.0) as i32)
}
```

## Performance Problems

### Issue: "Slow canister responses"

**Diagnosis:**
```bash
# Check canister status
dfx canister status <canister-name>

# Monitor instruction consumption
dfx canister call <canister> get_instruction_count
```

**Solutions:**

1. **Optimize Queries:**
```motoko
// Use query calls when possible
public query func get_data() : async Result<Data, Text> {
    // Query is faster, no consensus needed
}
```

2. **Implement Caching:**
```motoko
private var cache: HashMap<Text, CachedData> = HashMap.HashMap(10, Text.equal, Text.hash);

public func get_cached_data(key: Text) : async Result<Data, Text> {
    switch (cache.get(key)) {
        case (?cached) {
            if (Time.now() - cached.timestamp < CACHE_TTL) {
                return #ok(cached.data);
            };
        };
        case null {};
    };
    // Fetch and cache new data
}
```

3. **Batch Operations:**
```motoko
// Process multiple items at once
public func batch_process(items: [Item]) : async [Result<Output, Text>] {
    Array.map(items, process_item)
}
```

## Development Environment

### Issue: "Vessel command not found"

**Solution:**
```bash
# Install vessel
npm install -g vessel

# Or use local installation
npm install --save-dev vessel
npx vessel install
```

---

### Issue: "Port 4943 already in use"

**Solution:**
```bash
# Find process using port
lsof -i :4943

# Kill the process
kill -9 <PID>

# Or use different port
dfx start --port 8000
```

---

### Issue: "Cannot import Motoko base library"

**Solution:**
```bash
# Install vessel packages
vessel install

# Verify vessel.dhall
cat vessel.dhall

# Should contain:
{
  dependencies = [
    "base",
    "matchers"
  ],
  compiler = None Text
}
```

## Emergency Procedures

### Critical Issue: System Down

**Immediate Actions:**
1. Check canister status
2. Verify cycles balance
3. Check recent deployments
4. Review error logs

```bash
# Emergency diagnostics
dfx canister status --all
dfx wallet balance
dfx canister logs insurance --lines 100
```

### Data Recovery

**If data is corrupted:**
```motoko
// Implement backup mechanism
public func export_data() : async Blob {
    to_candid(stable_data)
};

public func import_data(data: Blob) : async Result<Text, Text> {
    switch (from_candid(data)) {
        case (?imported) {
            stable_data := imported;
            #ok("Data imported successfully")
        };
        case null {
            #err("Failed to parse data")
        };
    }
};
```

### Emergency Pause

**Implement circuit breaker:**
```motoko
private var emergency_paused: Bool = false;

public shared(msg) func emergency_pause() : async Result<Text, Text> {
    if (not isAdmin(msg.caller)) {
        return #err("Unauthorized");
    };
    emergency_paused := true;
    #ok("System paused")
};

// Check in all public functions
if (emergency_paused) {
    return #err("System is paused for maintenance");
};
```

## Getting Help

### Resources
- [ICP Developer Forum](https://forum.dfinity.org/)
- [Discord Community](https://discord.gg/jnjVVQaE2C)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/internet-computer)
- [GitHub Issues](https://github.com/danielabrahamx/Paramify/issues)

### Debug Commands
```bash
# Useful debug commands
dfx canister status <canister>
dfx canister logs <canister>
dfx wallet balance
dfx identity get-principal
dfx ping
```

### Contact Support
- **Technical Issues**: dev-support@paramify.io
- **Security Issues**: security@paramify.io
- **General Inquiries**: hello@paramify.io

---

*Last Updated: 2025-09-02*
*Version: 1.0.0*