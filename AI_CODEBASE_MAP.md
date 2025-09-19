# 🗺️ AI Agent Codebase Map - Complete Function Reference

## Quick Navigation
- [Canister Functions](#canister-functions)
- [Frontend Functions](#frontend-functions)
- [Oracle Functions](#oracle-functions)
- [Data Structures](#data-structures)
- [Security Features](#security-features)
- [Integration Points](#integration-points)

---

## Canister Functions

### File: `icp-canister/src/lib_fixed.rs`

#### 🔐 Initialization & Lifecycle

```rust
// Line 169-186
#[init]
fn init(admin_principal: Option<Principal>)
```
- **Purpose:** Initialize canister with admin
- **Security:** Validates admin is not anonymous
- **Usage:** Called once during deployment
- **Parameters:** Optional admin principal (defaults to caller)

```rust
// Line 189-199
#[pre_upgrade]
fn pre_upgrade()
```
- **Purpose:** Save state before canister upgrade
- **Security:** Automatic, preserves all data

```rust
// Line 202-239
#[post_upgrade]
fn post_upgrade(auth: Option<UpgradeAuth>)
```
- **Purpose:** Restore state after upgrade
- **Security:** Requires upgrade authorization
- **Parameters:** UpgradeAuth struct with admin, time, version

#### 💼 Policy Management

```rust
// Line 242-337
#[update]
fn create_policy(premium: Nat, coverage: Nat) -> Result<PolicyId, String>
```
- **Purpose:** Create new insurance policy
- **Security:** 
  - Checks cycles balance
  - Validates premium/coverage ratio (1-20%)
  - Prevents duplicate active policies
  - Re-entrancy protected
- **Validation:**
  - MIN_PREMIUM: 1,000,000
  - MAX_PREMIUM: 1,000,000,000,000
  - MIN_COVERAGE: 10,000,000
  - MAX_COVERAGE: 10,000,000,000,000
- **Returns:** Policy ID or error message

```rust
// Line 340-405
#[update]
fn update_policy_status(policy_id: PolicyId, active: bool, paid_out: bool) -> Result<(), String>
```
- **Purpose:** Update policy active/payout status
- **Security:** Admin or policyholder only, re-entrancy protected
- **Validation:** Checks state transitions are valid

```rust
// Line 546-609
#[update]
fn trigger_payout() -> Result<Nat, String>
```
- **Purpose:** Claim insurance payout
- **Security:** 
  - Caller must own policy
  - Flood level must exceed threshold
  - Policy must be active and not expired
  - Re-entrancy protected
- **Returns:** Coverage amount or error

#### 🌊 Oracle Functions

```rust
// Line 408-484
#[update]
fn set_flood_level(flood_level: i64) -> Result<(), String>
```
- **Purpose:** Update current flood level
- **Security:**
  - Oracle or admin only
  - Rate limited (60s minimum)
  - Range validation (0-100 feet)
  - Anomaly detection
  - Audit logging
- **Parameters:** Flood level in scaled units (×10^11)

```rust
// Line 919-941
#[update]
fn set_flood_threshold(threshold: u64) -> Result<(), String>
```
- **Purpose:** Set flood payout threshold
- **Security:** Admin only
- **Validation:** Must be positive and ≤ 100 feet

#### 👤 Admin Functions

```rust
// Line 612-646
#[update]
fn initiate_admin_transfer(new_admin: Principal) -> Result<(), String>
```
- **Purpose:** Start 2-phase admin transfer
- **Security:** Current admin only, 24h timelock
- **Parameters:** New admin principal

```rust
// Line 648-685
#[update]
fn complete_admin_transfer() -> Result<(), String>
```
- **Purpose:** Complete admin transfer after timelock
- **Security:** New admin must call after 24h

```rust
// Line 687-707
#[update]
fn cancel_admin_transfer() -> Result<(), String>
```
- **Purpose:** Cancel pending admin transfer
- **Security:** Current admin only

```rust
// Line 877-906
#[update]
fn add_oracle_updater(oracle: Principal) -> Result<(), String>
```
- **Purpose:** Authorize oracle to update flood levels
- **Security:** Admin only, validates not anonymous

```rust
// Line 908-930
#[update]
fn remove_oracle_updater(oracle: Principal) -> Result<(), String>
```
- **Purpose:** Remove oracle authorization
- **Security:** Admin only, keeps at least 1 oracle

#### 💰 Cycle Management

```rust
// Line 710-714
#[query]
fn get_cycles_balance() -> u64
```
- **Purpose:** Check canister cycle balance
- **Public:** Anyone can check

```rust
// Line 716-732
#[update]
fn top_up_cycles() -> Result<u64, String>
```
- **Purpose:** Add cycles to canister
- **Security:** Admin only
- **Returns:** Amount of cycles added

#### 📊 Query Functions

```rust
// Line 785-790
#[query]
fn get_policy(policy_id: PolicyId) -> Option<Policy>
```
- **Purpose:** Get policy by ID
- **Public:** Anyone can query

```rust
// Line 792-799
#[query]
fn get_policy_by_holder(policyholder: Principal) -> Option<Policy>
```
- **Purpose:** Get policy for specific holder
- **Public:** Anyone can query

```rust
// Line 801-813
#[query]
fn get_all_policies() -> Result<Vec<Policy>, String>
```
- **Purpose:** Get all policies
- **Security:** Admin only

```rust
// Line 815-827
#[query]
fn get_policy_stats() -> (u64, u64, u64)
```
- **Purpose:** Get statistics
- **Returns:** (total, active, paid_out)
- **Public:** Anyone can query

```rust
// Line 834-850
#[query]
fn is_payout_eligible(policyholder: Principal) -> bool
```
- **Purpose:** Check if eligible for payout
- **Logic:** active && !paid_out && !expired && flood > threshold

```rust
// Line 857-876
#[query]
fn health_check() -> (bool, String, u64, i64, u64)
```
- **Purpose:** System health status
- **Returns:** (healthy, version, cycles, flood_level, threshold)

#### 🧹 Maintenance Functions

```rust
// Line 766-796
#[update]
fn cleanup_expired_policies() -> Result<u64, String>
```
- **Purpose:** Remove expired/paid policies from map
- **Security:** Admin only
- **Returns:** Number of policies cleaned

```rust
// Line 734-743
#[query]
fn get_memory_stats() -> (usize, usize, usize, usize)
```
- **Purpose:** Check memory usage
- **Returns:** (policies, events, oracle_history, mirror_policies)

```rust
// Line 745-767
#[query]
fn get_events(from: Option<Timestamp>, limit: Option<usize>) -> Result<Vec<Event>, String>
```
- **Purpose:** Get audit events
- **Security:** Admin only
- **Parameters:** Optional timestamp filter and limit

---

## Frontend Functions

### File: `frontend-icp/src/lib/icp_fixed.ts`

#### 🔑 Authentication

```typescript
// Line 58-79
export async function initializeAuth(): Promise<void>
```
- **Purpose:** Initialize ICP authentication
- **Handles:** Development vs production mode

```typescript
// Line 118-158
export async function loginWithInternetIdentity(): Promise<Principal | null>
```
- **Purpose:** Login with Internet Identity
- **Returns:** User principal or null
- **Side Effects:** Sets up actor, checks admin status

```typescript
// Line 161-172
export async function logoutFromInternetIdentity(): Promise<void>
```
- **Purpose:** Logout and clear session

#### 💼 Policy Operations

```typescript
// Line 214-239
export async function createPolicy(coverageAmount: number): Promise<{
  success: boolean; 
  policyId?: string; 
  error?: string;
}>
```
- **Purpose:** Create new policy
- **Calculation:** Premium = 10% of coverage
- **Returns:** Success status with policy ID or error

```typescript
// Line 242-259
export async function getUserPolicy(): Promise<Policy | null>
```
- **Purpose:** Get current user's policy
- **Returns:** Policy object or null

```typescript
// Line 277-296
export async function claimPayout(): Promise<{
  success: boolean;
  amount?: string;
  error?: string;
}>
```
- **Purpose:** Trigger payout claim
- **Returns:** Success with amount or error

#### 🌊 Flood Data

```typescript
// Line 331-344
export async function getFloodLevel(): Promise<number>
```
- **Purpose:** Get current flood level in feet
- **Conversion:** Scales from chain units

```typescript
// Line 347-360
export async function getFloodThreshold(): Promise<number>
```
- **Purpose:** Get trigger threshold in feet

```typescript
// Line 299-312
export async function isPayoutEligible(): Promise<boolean>
```
- **Purpose:** Check payout eligibility

#### 👤 Admin Functions

```typescript
// Line 195-212
export async function isAdminPrincipal(principal: Principal): Promise<boolean>
```
- **Purpose:** Check if principal is admin
- **Security:** Queries canister for verification

```typescript
// Line 315-342
export async function updateThreshold(thresholdFeet: number): Promise<{
  success: boolean;
  error?: string;
}>
```
- **Purpose:** Update flood threshold
- **Security:** Admin only
- **Conversion:** Feet to scaled units

#### 📊 Statistics

```typescript
// Line 363-379
export async function getPolicyStats(): Promise<{
  total: number;
  active: number;
  paidOut: number;
}>
```
- **Purpose:** Get system statistics

```typescript
// Line 382-406
export async function healthCheck(): Promise<{
  healthy: boolean;
  version: string;
  cycles: string;
  floodLevel: number;
  threshold: number;
}>
```
- **Purpose:** System health check

---

## Oracle Functions

### File: `backend/icp-oracle-fixed.js`

#### 🔄 Core Oracle Loop

```javascript
// Line 324-352
async performUpdate()
```
- **Purpose:** Main update cycle
- **Flow:**
  1. Check circuit breaker
  2. Fetch flood data
  3. Validate data
  4. Update canister
  5. Log statistics
- **Schedule:** Every 5 minutes via cron

#### 🌊 Data Fetching

```javascript
// Line 147-183
async fetchUSGSData(stationId, isPrimary = true)
```
- **Purpose:** Fetch from USGS API
- **Parameters:** Station ID and primary/secondary flag
- **Returns:** Flood level, timestamp, station info
- **Timeout:** 10 seconds

```javascript
// Line 232-283
async fetchFloodLevel()
```
- **Purpose:** Get flood level with failover
- **Logic:**
  1. Try primary station
  2. Validate data
  3. Failover to secondary if needed
  4. Handle anomaly confirmation
- **Returns:** Validated flood data

#### ✅ Validation

```javascript
// Line 186-229
validateFloodData(data)
```
- **Purpose:** Validate USGS data
- **Checks:**
  - Data freshness (<1 hour)
  - Level range (0-100 feet)
  - Anomaly detection (>10 feet change)
  - Quality indicators
- **Returns:** true, false, or 'requires_confirmation'

#### 🔄 Canister Updates

```javascript
// Line 286-321
async updateCanisterWithRetry(floodLevel)
```
- **Purpose:** Update canister with retries
- **Features:**
  - 3 retry attempts
  - Exponential backoff
  - Circuit breaker on failures
  - Update history tracking
- **Conversion:** Feet to scaled units (×10^11)

#### 🏥 Health & Monitoring

```javascript
// Line 354-380
async performHealthCheck()
```
- **Purpose:** Check canister health
- **Returns:** Health status, version, cycles, levels

```javascript
// Line 396-409
getStatus()
```
- **Purpose:** Get oracle status
- **Returns:** Health, last update, history, failures

```javascript
// Line 383-394
async sendAlert(subject, message)
```
- **Purpose:** Send monitoring alerts
- **Integration:** Webhook support for external monitoring

---

## Data Structures

### Core Types

```rust
// Policy structure
struct Policy {
    policy_id: PolicyId,        // Unique ID
    policyholder: Principal,     // ICP identity
    premium: Nat,               // Amount paid
    coverage: Nat,              // Payout amount
    purchase_time: Timestamp,    // Unix timestamp
    active: bool,               // Is active
    paid_out: bool,            // Has paid out
    expiration_time: Timestamp, // Expiry time
}

// Event for audit trail
struct Event {
    event_type: EventType,      // Type of event
    timestamp: Timestamp,       // When occurred
    principal: Principal,       // Who triggered
    details: String,           // Description
}

// Oracle update record
struct OracleUpdate {
    updater: Principal,        // Oracle identity
    flood_level: i64,         // Level in scaled units
    timestamp: Timestamp,      // Update time
}
```

---

## Security Features

### Protection Mechanisms

1. **Re-entrancy Guards**
   - Location: All update functions
   - Implementation: State flag checked/set atomically

2. **Rate Limiting**
   - Location: `set_flood_level`
   - Limit: 60 seconds between updates

3. **Access Control**
   - Admin functions: Principal validation
   - Oracle functions: Authorized list
   - Policy functions: Ownership checks

4. **Input Validation**
   - All Nat inputs: Overflow protection
   - Flood levels: Range validation
   - Premiums: Business logic checks

5. **Audit Logging**
   - All critical operations logged
   - Event history maintained
   - Oracle updates tracked

---

## Integration Points

### External APIs
- **USGS Water Services:** Real-time flood data
  - Primary: Station 01646500
  - Secondary: Station 01647000
  - Format: JSON
  - Update: Every 5 minutes

### ICP Services
- **Internet Identity:** User authentication
- **Cycles Wallet:** Payment for computation
- **Stable Memory:** Cross-upgrade persistence

### Monitoring
- **Health Endpoint:** `/health_check`
- **Metrics:** Cycles, policies, flood levels
- **Alerts:** Webhook integration ready

---

**For AI Agents:** This map provides complete navigation of all functions, their purposes, security features, and integration points. Use this to quickly locate and understand any part of the codebase.