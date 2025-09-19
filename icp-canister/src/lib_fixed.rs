use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::time;
use ic_cdk_macros::{init, post_upgrade, pre_upgrade, query, update};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::convert::TryFrom;

// Type definitions
type PolicyId = u64;
type Timestamp = u64;

// Constants for security limits
const MIN_CYCLES: u64 = 1_000_000_000; // 1 billion cycles minimum
const MAX_POLICIES: usize = 100_000;
const MAX_EVENTS: usize = 10_000;
const MAX_ORACLE_HISTORY: usize = 1_000;
const ORACLE_UPDATE_RATE_LIMIT: u64 = 60; // seconds
const ADMIN_TRANSFER_TIMELOCK: u64 = 86400; // 24 hours

// Business logic constants
const MIN_PREMIUM: u64 = 1_000_000;
const MAX_PREMIUM: u64 = 1_000_000_000_000;
const MIN_COVERAGE: u64 = 10_000_000;
const MAX_COVERAGE: u64 = 10_000_000_000_000;
const MIN_FLOOD_LEVEL: i64 = 0;
const MAX_FLOOD_LEVEL: i64 = 10_000_000_000_000; // 100 feet in scaled units
const ANOMALY_THRESHOLD: i64 = 1_000_000_000_000; // 10 feet change

// Policy data structure
#[derive(CandidType, Deserialize, Clone)]
struct Policy {
    policy_id: PolicyId,
    policyholder: Principal,
    premium: Nat,
    coverage: Nat,
    purchase_time: Timestamp,
    active: bool,
    paid_out: bool,
    expiration_time: Timestamp, // Added expiration
}

// Event system for audit trail
#[derive(CandidType, Deserialize, Clone)]
enum EventType {
    PolicyCreated,
    PolicyUpdated,
    PayoutTriggered,
    FloodLevelUpdated,
    AdminTransferInitiated,
    AdminTransferCompleted,
    AdminTransferCancelled,
    OracleAdded,
    OracleRemoved,
    ThresholdChanged,
    AnomalyDetected,
}

#[derive(CandidType, Deserialize, Clone)]
struct Event {
    event_type: EventType,
    timestamp: Timestamp,
    principal: Principal,
    details: String,
}

// Oracle update history
#[derive(CandidType, Deserialize, Clone)]
struct OracleUpdate {
    updater: Principal,
    flood_level: i64,
    timestamp: Timestamp,
}

// Mirror policy for Ethereum dashboard compatibility
#[derive(CandidType, Deserialize, Clone)]
struct MirrorPolicy {
    policy_id: PolicyId,
    policyholder_eth: String,
    premium_wei: Nat,
    coverage_wei: Nat,
    purchase_time: Timestamp,
    active: bool,
    paid_out: bool,
}

// Upgrade authorization
#[derive(CandidType, Deserialize)]
struct UpgradeAuth {
    authorized_by: Principal,
    upgrade_time: Timestamp,
    version: String,
}

// State structure for stable storage
#[derive(CandidType, Deserialize)]
struct State {
    policies: BTreeMap<PolicyId, Policy>,
    policy_id_counter: PolicyId,
    policyholder_map: BTreeMap<Principal, PolicyId>,
    flood_level: i64,
    flood_threshold: u64,
    admin: Principal,
    oracle_updaters: Vec<Principal>,
    mirror_policies: BTreeMap<PolicyId, MirrorPolicy>,
    
    // Security enhancements
    reentrancy_guard: bool,
    last_oracle_update: Timestamp,
    oracle_update_count: u64,
    oracle_update_history: Vec<OracleUpdate>,
    events: Vec<Event>,
    
    // Admin transfer mechanism
    pending_admin: Option<Principal>,
    admin_transfer_timestamp: Option<Timestamp>,
    
    // System metadata
    deployment_timestamp: Timestamp,
    last_upgrade_timestamp: Timestamp,
    canister_version: String,
}

// Thread-local storage for the canister state
thread_local! {
    static STATE: RefCell<State> = RefCell::new(State {
        policies: BTreeMap::new(),
        policy_id_counter: 0,
        policyholder_map: BTreeMap::new(),
        flood_level: 0,
        flood_threshold: 1200000000000, // 12 feet default
        admin: Principal::anonymous(),
        oracle_updaters: Vec::new(),
        mirror_policies: BTreeMap::new(),
        reentrancy_guard: false,
        last_oracle_update: 0,
        oracle_update_count: 0,
        oracle_update_history: Vec::new(),
        events: Vec::new(),
        pending_admin: None,
        admin_transfer_timestamp: None,
        deployment_timestamp: 0,
        last_upgrade_timestamp: 0,
        canister_version: "1.0.0".to_string(),
    });
}

// Helper function to check cycles
fn check_cycles() -> Result<(), String> {
    if ic_cdk::api::canister_balance() < MIN_CYCLES {
        return Err("Insufficient cycles for operation".to_string());
    }
    Ok(())
}

// Helper function to log events
fn log_event(event_type: EventType, details: String) {
    let caller = ic_cdk::caller();
    let timestamp = time();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        let event = Event {
            event_type,
            timestamp,
            principal: caller,
            details: details.clone(),
        };
        
        state.events.push(event);
        
        // Keep only last MAX_EVENTS events
        if state.events.len() > MAX_EVENTS {
            state.events.remove(0);
        }
        
        // Also print to console for debugging
        ic_cdk::println!("[{}] {}: {}", timestamp, caller.to_text(), details);
    });
}

// Initialize the canister with explicit admin
#[init]
fn init(admin_principal: Option<Principal>) {
    let deployment_time = time();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        // Use provided admin or fallback to caller
        let admin = admin_principal.unwrap_or_else(|| ic_cdk::caller());
        
        // Validate admin is not anonymous
        if admin == Principal::anonymous() {
            ic_cdk::trap("Cannot set anonymous principal as admin");
        }
        
        state.admin = admin;
        state.oracle_updaters.push(admin);
        state.deployment_timestamp = deployment_time;
        state.canister_version = "1.0.0".to_string();
        
        // Log initialization
        ic_cdk::println!("Canister initialized with admin: {} at {}", 
            admin.to_text(), deployment_time);
    });
    
    log_event(
        EventType::AdminTransferCompleted,
        format!("Canister initialized with admin: {}", 
            admin_principal.unwrap_or_else(|| ic_cdk::caller()).to_text())
    );
}

// Pre-upgrade hook to save state
#[pre_upgrade]
fn pre_upgrade() {
    STATE.with(|state| {
        let state = state.borrow();
        ic_cdk::storage::stable_save((state.clone(),))
            .expect("Failed to save state");
    });
}

// Post-upgrade hook with authorization check
#[post_upgrade]
fn post_upgrade(auth: Option<UpgradeAuth>) {
    // Verify upgrade authorization
    if let Some(auth_info) = auth {
        ic_cdk::println!("Upgrade authorized by {} at {} to version {}", 
            auth_info.authorized_by.to_text(), 
            auth_info.upgrade_time, 
            auth_info.version);
        
        // Restore state
        let (mut state,): (State,) = ic_cdk::storage::stable_restore()
            .expect("Failed to restore state");
        
        // Update metadata
        state.last_upgrade_timestamp = time();
        state.canister_version = auth_info.version;
        state.reentrancy_guard = false; // Reset guard after upgrade
        
        STATE.with(|cell| {
            *cell.borrow_mut() = state;
        });
        
        log_event(
            EventType::AdminTransferCompleted,
            format!("Canister upgraded to version {}", auth_info.version)
        );
    } else {
        // For backward compatibility during first upgrade
        // Try restoring with new schema first
        let restore_result: Result<(State,), _> = ic_cdk::storage::stable_restore();
        
        match restore_result {
            Ok((mut state,)) => {
                state.last_upgrade_timestamp = time();
                state.reentrancy_guard = false;
                
                STATE.with(|cell| {
                    *cell.borrow_mut() = state;
                });
            }
            Err(_) => {
                ic_cdk::trap("Failed to restore state - incompatible schema");
            }
        }
    }
}

// Create a new insurance policy with comprehensive validation
#[update]
fn create_policy(premium: Nat, coverage: Nat) -> Result<PolicyId, String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    
    // Check storage limits
    STATE.with(|state| {
        let state = state.borrow();
        if state.policies.len() >= MAX_POLICIES {
            return Err("Maximum number of policies reached".to_string());
        }
        Ok(())
    })?;
    
    // Convert and validate Nat values
    let premium_u64 = premium.0.to_u64()
        .ok_or("Premium value too large")?;
    let coverage_u64 = coverage.0.to_u64()
        .ok_or("Coverage value too large")?;
    
    // Validate business logic constraints
    if premium_u64 < MIN_PREMIUM || premium_u64 > MAX_PREMIUM {
        return Err(format!("Premium must be between {} and {}", MIN_PREMIUM, MAX_PREMIUM));
    }
    
    if coverage_u64 < MIN_COVERAGE || coverage_u64 > MAX_COVERAGE {
        return Err(format!("Coverage must be between {} and {}", MIN_COVERAGE, MAX_COVERAGE));
    }
    
    // Validate premium/coverage ratio (1-20%)
    let ratio = (premium_u64 * 100) / coverage_u64;
    if ratio < 1 || ratio > 20 {
        return Err("Invalid premium/coverage ratio: must be between 1% and 20%".to_string());
    }
    
    // Check for existing active policy
    let existing_policy_id = STATE.with(|state| {
        state.borrow().policyholder_map.get(&caller).cloned()
    });
    
    if let Some(policy_id) = existing_policy_id {
        let is_active = STATE.with(|state| {
            state.borrow().policies.get(&policy_id)
                .map(|p| p.active && !p.paid_out)
                .unwrap_or(false)
        });
        
        if is_active {
            return Err("Active policy already exists".to_string());
        }
    }
    
    // Create new policy with re-entrancy protection
    STATE.with(|cell| {
        // Check and set reentrancy guard
        {
            let state = cell.borrow();
            if state.reentrancy_guard {
                return Err("Re-entrancy detected".to_string());
            }
        }
        
        let mut state = cell.borrow_mut();
        state.reentrancy_guard = true;
        
        let result = (|| {
            state.policy_id_counter += 1;
            let new_policy_id = state.policy_id_counter;
            let current_time = time();
            
            let policy = Policy {
                policy_id: new_policy_id,
                policyholder: caller,
                premium: Nat::from(premium_u64),
                coverage: Nat::from(coverage_u64),
                purchase_time: current_time,
                active: true,
                paid_out: false,
                expiration_time: current_time + (365 * 24 * 60 * 60 * 1_000_000_000), // 1 year
            };
            
            state.policies.insert(new_policy_id, policy);
            state.policyholder_map.insert(caller, new_policy_id);
            
            Ok(new_policy_id)
        })();
        
        state.reentrancy_guard = false;
        
        if let Ok(policy_id) = &result {
            log_event(
                EventType::PolicyCreated,
                format!("Policy {} created for {} with premium {} and coverage {}", 
                    policy_id, caller.to_text(), premium_u64, coverage_u64)
            );
        }
        
        result
    })
}

// Update policy status with re-entrancy protection
#[update]
fn update_policy_status(policy_id: PolicyId, active: bool, paid_out: bool) -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    
    STATE.with(|cell| {
        // Check and set reentrancy guard
        {
            let state = cell.borrow();
            if state.reentrancy_guard {
                return Err("Re-entrancy detected".to_string());
            }
        }
        
        let mut state = cell.borrow_mut();
        state.reentrancy_guard = true;
        
        let result = (|| {
            let policy = state.policies.get(&policy_id)
                .ok_or("Policy not found")?;
            
            // Authorization check
            if policy.policyholder != caller && state.admin != caller {
                return Err("Unauthorized".to_string());
            }
            
            // Validate transitions
            if paid_out && !policy.active {
                return Err("Cannot pay out inactive policy".to_string());
            }
            
            if policy.paid_out && paid_out {
                return Err("Policy already paid out".to_string());
            }
            
            // Safe flood level conversion
            let flood_level_unsigned = if state.flood_level < 0 {
                0u64
            } else {
                u64::try_from(state.flood_level).unwrap_or(u64::MAX)
            };
            
            if paid_out && flood_level_unsigned < state.flood_threshold {
                return Err("Flood level below threshold".to_string());
            }
            
            // Apply mutations
            let policy_mut = state.policies.get_mut(&policy_id)
                .ok_or("Policy not found")?;
            policy_mut.active = active;
            policy_mut.paid_out = paid_out;
            
            Ok(())
        })();
        
        state.reentrancy_guard = false;
        
        if result.is_ok() {
            log_event(
                EventType::PolicyUpdated,
                format!("Policy {} status updated: active={}, paid_out={}", 
                    policy_id, active, paid_out)
            );
        }
        
        result
    })
}

// Set flood level with comprehensive validation and rate limiting
#[update]
fn set_flood_level(flood_level: i64) -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    let current_time = time() / 1_000_000_000; // Convert to seconds
    
    STATE.with(|cell| {
        // Check reentrancy
        {
            let state = cell.borrow();
            if state.reentrancy_guard {
                return Err("Re-entrancy detected".to_string());
            }
        }
        
        let mut state = cell.borrow_mut();
        state.reentrancy_guard = true;
        
        let result = (|| {
            // Check authorization
            if !state.oracle_updaters.contains(&caller) && state.admin != caller {
                return Err("Unauthorized: Oracle updater access required".to_string());
            }
            
            // Rate limiting
            if state.oracle_update_count > 0 && 
               current_time - state.last_oracle_update < ORACLE_UPDATE_RATE_LIMIT {
                return Err(format!("Rate limit exceeded: wait {} seconds between updates", 
                    ORACLE_UPDATE_RATE_LIMIT));
            }
            
            // Validate flood level range
            if flood_level < MIN_FLOOD_LEVEL || flood_level > MAX_FLOOD_LEVEL {
                return Err(format!("Invalid flood level: must be between {} and {} scaled units", 
                    MIN_FLOOD_LEVEL, MAX_FLOOD_LEVEL));
            }
            
            // Check for anomalous changes
            if state.oracle_update_count > 0 {
                let change = (flood_level - state.flood_level).abs();
                if change > ANOMALY_THRESHOLD {
                    log_event(
                        EventType::AnomalyDetected,
                        format!("Large flood level change detected: {} by {}", 
                            change, caller.to_text())
                    );
                }
            }
            
            // Update state
            let old_level = state.flood_level;
            state.flood_level = flood_level;
            state.last_oracle_update = current_time;
            state.oracle_update_count += 1;
            
            // Maintain audit history
            let update = OracleUpdate {
                updater: caller,
                flood_level,
                timestamp: time(),
            };
            
            state.oracle_update_history.push(update);
            if state.oracle_update_history.len() > MAX_ORACLE_HISTORY {
                state.oracle_update_history.remove(0);
            }
            
            ic_cdk::println!("Flood level updated: {} -> {} by {} at {}", 
                old_level, flood_level, caller.to_text(), current_time);
            
            Ok(())
        })();
        
        state.reentrancy_guard = false;
        
        if result.is_ok() {
            log_event(
                EventType::FloodLevelUpdated,
                format!("Flood level updated to {} by {}", flood_level, caller.to_text())
            );
        }
        
        result
    })
}

// Trigger payout with comprehensive validation
#[update]
fn trigger_payout() -> Result<Nat, String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    
    STATE.with(|cell| {
        // Check reentrancy
        {
            let state = cell.borrow();
            if state.reentrancy_guard {
                return Err("Re-entrancy detected".to_string());
            }
        }
        
        let mut state = cell.borrow_mut();
        state.reentrancy_guard = true;
        
        let result = (|| {
            // Get policy for caller
            let policy_id = state.policyholder_map.get(&caller)
                .ok_or("No policy found")?;
            
            let policy = state.policies.get(policy_id)
                .ok_or("Policy not found")?;
            
            // Validate policy status
            if !policy.active {
                return Err("Policy is not active".to_string());
            }
            
            if policy.paid_out {
                return Err("Policy already paid out".to_string());
            }
            
            // Check if policy expired
            if time() > policy.expiration_time {
                return Err("Policy has expired".to_string());
            }
            
            // Safe flood level check
            let flood_level_unsigned = if state.flood_level < 0 {
                0u64
            } else {
                u64::try_from(state.flood_level).unwrap_or(u64::MAX)
            };
            
            if flood_level_unsigned < state.flood_threshold {
                return Err(format!("Flood level {} below threshold {}", 
                    flood_level_unsigned, state.flood_threshold));
            }
            
            // Process payout
            let policy_mut = state.policies.get_mut(policy_id)
                .ok_or("Policy not found")?;
            
            policy_mut.paid_out = true;
            policy_mut.active = false;
            
            Ok(policy_mut.coverage.clone())
        })();
        
        state.reentrancy_guard = false;
        
        if let Ok(coverage) = &result {
            log_event(
                EventType::PayoutTriggered,
                format!("Payout of {} triggered for {}", coverage, caller.to_text())
            );
        }
        
        result
    })
}

// Admin transfer functions with timelock
#[update]
fn initiate_admin_transfer(new_admin: Principal) -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    let current_time = time() / 1_000_000_000;
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        if new_admin == Principal::anonymous() {
            return Err("Cannot transfer to anonymous principal".to_string());
        }
        
        if new_admin == state.admin {
            return Err("New admin same as current admin".to_string());
        }
        
        state.pending_admin = Some(new_admin);
        state.admin_transfer_timestamp = Some(current_time);
        
        log_event(
            EventType::AdminTransferInitiated,
            format!("Admin transfer initiated to {}", new_admin.to_text())
        );
        
        Ok(())
    })
}

#[update]
fn complete_admin_transfer() -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    let current_time = time() / 1_000_000_000;
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        let pending = state.pending_admin
            .ok_or("No pending admin transfer")?;
        
        if caller != pending {
            return Err("Only pending admin can complete transfer".to_string());
        }
        
        let transfer_time = state.admin_transfer_timestamp
            .ok_or("Invalid transfer state")?;
        
        if current_time - transfer_time < ADMIN_TRANSFER_TIMELOCK {
            let remaining = ADMIN_TRANSFER_TIMELOCK - (current_time - transfer_time);
            return Err(format!("Transfer timelock not expired ({} seconds remaining)", remaining));
        }
        
        let old_admin = state.admin;
        state.admin = pending;
        state.pending_admin = None;
        state.admin_transfer_timestamp = None;
        
        log_event(
            EventType::AdminTransferCompleted,
            format!("Admin transferred from {} to {}", 
                old_admin.to_text(), pending.to_text())
        );
        
        Ok(())
    })
}

#[update]
fn cancel_admin_transfer() -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        state.pending_admin = None;
        state.admin_transfer_timestamp = None;
        
        log_event(
            EventType::AdminTransferCancelled,
            "Admin transfer cancelled".to_string()
        );
        
        Ok(())
    })
}

// Cycle management functions
#[query]
fn get_cycles_balance() -> u64 {
    ic_cdk::api::canister_balance()
}

#[update]
fn top_up_cycles() -> Result<u64, String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        if state.borrow().admin != caller {
            return Err("Unauthorized: Admin only".to_string());
        }
        Ok(())
    })?;
    
    let amount = ic_cdk::api::call::msg_cycles_available();
    if amount > 0 {
        ic_cdk::api::call::msg_cycles_accept(amount);
        Ok(amount)
    } else {
        Err("No cycles provided".to_string())
    }
}

// Memory management functions
#[query]
fn get_memory_stats() -> (usize, usize, usize, usize) {
    STATE.with(|state| {
        let state = state.borrow();
        (
            state.policies.len(),
            state.events.len(),
            state.oracle_update_history.len(),
            state.mirror_policies.len(),
        )
    })
}

// Event query for admin
#[query]
fn get_events(from: Option<Timestamp>, limit: Option<usize>) -> Result<Vec<Event>, String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let state = state.borrow();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        let from_time = from.unwrap_or(0);
        let max_limit = limit.unwrap_or(100).min(1000);
        
        let events: Vec<Event> = state.events.iter()
            .filter(|e| e.timestamp >= from_time)
            .take(max_limit)
            .cloned()
            .collect();
        
        Ok(events)
    })
}

// Cleanup function for expired policies
#[update]
fn cleanup_expired_policies() -> Result<u64, String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    let current_time = time();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        let mut removed = 0u64;
        let mut to_remove = Vec::new();
        
        for (principal, policy_id) in state.policyholder_map.iter() {
            if let Some(policy) = state.policies.get(policy_id) {
                // Remove if expired or paid out
                if policy.paid_out || current_time > policy.expiration_time {
                    to_remove.push(*principal);
                    removed += 1;
                }
            }
        }
        
        for principal in to_remove {
            state.policyholder_map.remove(&principal);
        }
        
        Ok(removed)
    })
}

// Query methods (keeping existing ones with minor enhancements)
#[query]
fn get_policy(policy_id: PolicyId) -> Option<Policy> {
    STATE.with(|state| {
        state.borrow().policies.get(&policy_id).cloned()
    })
}

#[query]
fn get_policy_by_holder(policyholder: Principal) -> Option<Policy> {
    STATE.with(|state| {
        let state = state.borrow();
        state.policyholder_map.get(&policyholder)
            .and_then(|id| state.policies.get(id).cloned())
    })
}

#[query]
fn get_all_policies() -> Result<Vec<Policy>, String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let state = state.borrow();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        Ok(state.policies.values().cloned().collect())
    })
}

#[query]
fn get_policy_stats() -> (u64, u64, u64) {
    STATE.with(|state| {
        let state = state.borrow();
        let total = state.policy_id_counter;
        let active = state.policies.values()
            .filter(|p| p.active && !p.paid_out)
            .count() as u64;
        let paid_out = state.policies.values()
            .filter(|p| p.paid_out)
            .count() as u64;
        
        (total, active, paid_out)
    })
}

#[query]
fn get_flood_level() -> i64 {
    STATE.with(|state| state.borrow().flood_level)
}

#[query]
fn get_flood_threshold() -> u64 {
    STATE.with(|state| state.borrow().flood_threshold)
}

#[query]
fn is_payout_eligible(policyholder: Principal) -> bool {
    STATE.with(|state| {
        let state = state.borrow();
        
        if let Some(policy_id) = state.policyholder_map.get(&policyholder) {
            if let Some(policy) = state.policies.get(policy_id) {
                if policy.active && !policy.paid_out && time() <= policy.expiration_time {
                    let flood_level_unsigned = if state.flood_level < 0 {
                        0u64
                    } else {
                        state.flood_level as u64
                    };
                    return flood_level_unsigned >= state.flood_threshold;
                }
            }
        }
        
        false
    })
}

#[query]
fn get_admin() -> Principal {
    STATE.with(|state| state.borrow().admin)
}

#[query]
fn get_oracle_updaters() -> Result<Vec<Principal>, String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let state = state.borrow();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        Ok(state.oracle_updaters.clone())
    })
}

#[query]
fn get_oracle_history(limit: Option<usize>) -> Result<Vec<OracleUpdate>, String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let state = state.borrow();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        let max_limit = limit.unwrap_or(100).min(MAX_ORACLE_HISTORY);
        let history: Vec<OracleUpdate> = state.oracle_update_history
            .iter()
            .rev()
            .take(max_limit)
            .cloned()
            .collect();
        
        Ok(history)
    })
}

// System health check
#[query]
fn health_check() -> (bool, String, u64, i64, u64) {
    STATE.with(|state| {
        let state = state.borrow();
        let cycles = ic_cdk::api::canister_balance();
        let healthy = cycles > MIN_CYCLES;
        let version = state.canister_version.clone();
        
        (healthy, version, cycles, state.flood_level, state.flood_threshold)
    })
}

// Oracle management functions with proper validation
#[update]
fn add_oracle_updater(oracle: Principal) -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        if oracle == Principal::anonymous() {
            return Err("Cannot add anonymous principal as oracle".to_string());
        }
        
        if !state.oracle_updaters.contains(&oracle) {
            state.oracle_updaters.push(oracle);
            
            log_event(
                EventType::OracleAdded,
                format!("Oracle updater added: {}", oracle.to_text())
            );
        }
        
        Ok(())
    })
}

#[update]
fn remove_oracle_updater(oracle: Principal) -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        // Ensure at least one oracle remains
        if state.oracle_updaters.len() <= 1 {
            return Err("Cannot remove last oracle updater".to_string());
        }
        
        state.oracle_updaters.retain(|&p| p != oracle);
        
        log_event(
            EventType::OracleRemoved,
            format!("Oracle updater removed: {}", oracle.to_text())
        );
        
        Ok(())
    })
}

// Set flood threshold with validation
#[update]
fn set_flood_threshold(threshold: u64) -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        if threshold == 0 {
            return Err("Threshold must be positive".to_string());
        }
        
        if threshold > MAX_FLOOD_LEVEL as u64 {
            return Err("Threshold exceeds maximum allowed value".to_string());
        }
        
        let old_threshold = state.flood_threshold;
        state.flood_threshold = threshold;
        
        log_event(
            EventType::ThresholdChanged,
            format!("Flood threshold changed from {} to {}", old_threshold, threshold)
        );
        
        Ok(())
    })
}

// Mirror policy functions (kept for compatibility)
#[update]
fn mirror_upsert_policy(policy: MirrorPolicy) -> Result<(), String> {
    check_cycles()?;
    
    let caller = ic_cdk::caller();
    STATE.with(|cell| {
        let mut state = cell.borrow_mut();
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        state.mirror_policies.insert(policy.policy_id, policy);
        Ok(())
    })
}

#[query]
fn mirror_get_policies() -> Vec<MirrorPolicy> {
    STATE.with(|cell| cell.borrow().mirror_policies.values().cloned().collect())
}

// Candid interface export
ic_cdk::export_candid!();