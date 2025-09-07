use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::time;
use ic_cdk_macros::{init, post_upgrade, pre_upgrade, query, update};
use std::cell::RefCell;
use std::collections::BTreeMap;

// Type definitions
type PolicyId = u64;
type Timestamp = u64;

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
}

// State structure for stable storage
#[derive(CandidType, Deserialize)]
struct State {
    policies: BTreeMap<PolicyId, Policy>,
    policy_id_counter: PolicyId,
    policyholder_map: BTreeMap<Principal, PolicyId>,
    flood_level: i64, // Current flood level in scaled units
    flood_threshold: u64, // Threshold for payouts (default 12 feet = 1200000000000)
    admin: Principal,
    oracle_updaters: Vec<Principal>,
    // Mirror storage for admin dashboard (Ethereum-facing data)
    mirror_policies: BTreeMap<PolicyId, MirrorPolicy>,
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
    });
}

// Initialize the canister
#[init]
fn init() {
    let caller = ic_cdk::caller();
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.admin = caller;
        state.oracle_updaters.push(caller);
    });
}

// Pre-upgrade hook to save state
#[pre_upgrade]
fn pre_upgrade() {
    STATE.with(|state| {
        let state = state.borrow();
        ic_cdk::storage::stable_save((
            &state.policies,
            &state.policy_id_counter,
            &state.policyholder_map,
            &state.flood_level,
            &state.flood_threshold,
            &state.admin,
            &state.oracle_updaters,
            &state.mirror_policies,
        ))
        .expect("Failed to save state");
    });
}

// Post-upgrade hook to restore state (backward compatible)
#[post_upgrade]
fn post_upgrade() {
    // Try restoring with the new schema including mirror_policies
    let restored_new: Result<(
        BTreeMap<PolicyId, Policy>,
        PolicyId,
        BTreeMap<Principal, PolicyId>,
        i64,
        u64,
        Principal,
        Vec<Principal>,
        BTreeMap<PolicyId, MirrorPolicy>,
    ), _> = ic_cdk::storage::stable_restore();

    match restored_new {
        Ok((policies, policy_id_counter, policyholder_map, flood_level, flood_threshold, admin, oracle_updaters, mirror_policies)) => {
            STATE.with(|state| {
                let mut state = state.borrow_mut();
                state.policies = policies;
                state.policy_id_counter = policy_id_counter;
                state.policyholder_map = policyholder_map;
                state.flood_level = flood_level;
                state.flood_threshold = flood_threshold;
                state.admin = admin;
                state.oracle_updaters = oracle_updaters;
                state.mirror_policies = mirror_policies;
            });
        }
        Err(_) => {
            // Fallback to old schema without mirror_policies
            let (
                policies,
                policy_id_counter,
                policyholder_map,
                flood_level,
                flood_threshold,
                admin,
                oracle_updaters,
            ): (
                BTreeMap<PolicyId, Policy>,
                PolicyId,
                BTreeMap<Principal, PolicyId>,
                i64,
                u64,
                Principal,
                Vec<Principal>,
            ) = ic_cdk::storage::stable_restore().expect("Failed to restore state");

            STATE.with(|state| {
                let mut state = state.borrow_mut();
                state.policies = policies;
                state.policy_id_counter = policy_id_counter;
                state.policyholder_map = policyholder_map;
                state.flood_level = flood_level;
                state.flood_threshold = flood_threshold;
                state.admin = admin;
                state.oracle_updaters = oracle_updaters;
                // Initialize empty mirror storage on first upgrade
                state.mirror_policies = BTreeMap::new();
            });
        }
    }
}

// Mirror policy used for admin dashboard storage (Ethereum-oriented)
#[derive(CandidType, Deserialize, Clone)]
struct MirrorPolicy {
    policy_id: PolicyId,
    policyholder_eth: String, // Ethereum address as hex string
    premium_wei: Nat,
    coverage_wei: Nat,
    purchase_time: Timestamp,
    active: bool,
    paid_out: bool,
}

// Admin: upsert a single mirror policy
#[update]
fn mirror_upsert_policy(policy: MirrorPolicy) -> Result<(), String> {
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

// Admin: batch upsert mirror policies
#[update]
fn mirror_batch_upsert_policies(policies: Vec<MirrorPolicy>) -> Result<(), String> {
    let caller = ic_cdk::caller();
    STATE.with(|cell| {
        let mut state = cell.borrow_mut();
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        for p in policies.into_iter() {
            state.mirror_policies.insert(p.policy_id, p);
        }
        Ok(())
    })
}

// Admin: clear mirror policies
#[update]
fn mirror_clear_policies() -> Result<(), String> {
    let caller = ic_cdk::caller();
    STATE.with(|cell| {
        let mut state = cell.borrow_mut();
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        state.mirror_policies.clear();
        Ok(())
    })
}

// Public query: fetch mirror policies for admin dashboard
#[query]
fn mirror_get_policies() -> Vec<MirrorPolicy> {
    STATE.with(|cell| cell.borrow().mirror_policies.values().cloned().collect())
}

// Public query: stats from mirror policies
#[query]
fn mirror_get_policy_stats() -> (u64, u64, u64) {
    STATE.with(|cell| {
        let state = cell.borrow();
        let total = state.mirror_policies.len() as u64;
        let mut active = 0u64;
        let mut paid_out = 0u64;
        for p in state.mirror_policies.values() {
            if p.active {
                active += 1;
            }
            if p.paid_out {
                paid_out += 1;
            }
        }
        (total, active, paid_out)
    })
}

// Create a new insurance policy
#[update]
fn create_policy(premium: Nat, coverage: Nat) -> Result<PolicyId, String> {
    let caller = ic_cdk::caller();
    
    // Check if the caller already has an active policy
    let existing_policy_id = STATE.with(|state| {
        state.borrow().policyholder_map.get(&caller).cloned()
    });
    
    if let Some(policy_id) = existing_policy_id {
        let is_active = STATE.with(|state| {
            state.borrow().policies.get(&policy_id)
                .map(|p| p.active)
                .unwrap_or(false)
        });
        
        if is_active {
            return Err("Policy already active".to_string());
        }
    }
    
    // Validate inputs
    if premium == 0u64 {
        return Err("Premium must be greater than 0".to_string());
    }
    
    if coverage == 0u64 {
        return Err("Coverage must be greater than 0".to_string());
    }
    
    // Create new policy
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.policy_id_counter += 1;
        let new_policy_id = state.policy_id_counter;
        
        let policy = Policy {
            policy_id: new_policy_id,
            policyholder: caller,
            premium,
            coverage,
            purchase_time: time() / 1_000_000_000, // Convert nanoseconds to seconds
            active: true,
            paid_out: false,
        };
        
        state.policies.insert(new_policy_id, policy);
        state.policyholder_map.insert(caller, new_policy_id);
        
        Ok(new_policy_id)
    })
}

// Get a specific policy by ID
#[query]
fn get_policy(policy_id: PolicyId) -> Option<Policy> {
    STATE.with(|state| {
        state.borrow().policies.get(&policy_id).cloned()
    })
}

// Get policy by policyholder
#[query]
fn get_policy_by_holder(policyholder: Principal) -> Option<Policy> {
    STATE.with(|state| {
        let state = state.borrow();
        state.policyholder_map.get(&policyholder)
            .and_then(|id| state.policies.get(id).cloned())
    })
}

// Update policy status (for payout triggering)
#[update]
fn update_policy_status(policy_id: PolicyId, active: bool, paid_out: bool) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|cell| {
        // Snapshot needed immutable state first to avoid borrow conflicts
        let (admin, flood_level_unsigned, flood_threshold, policy_snapshot) = {
            let state = cell.borrow();
            (
                state.admin,
                state.flood_level as u64,
                state.flood_threshold,
                state.policies.get(&policy_id).cloned(),
            )
        };

        let Some(existing_policy) = policy_snapshot else {
            return Err("Policy not found".to_string());
        };

        // Authorization check using snapshot
        if existing_policy.policyholder != caller && admin != caller {
            return Err("Unauthorized".to_string());
        }

        // Validate transitions using snapshot
        if paid_out && !existing_policy.active {
            return Err("Cannot pay out inactive policy".to_string());
        }
        if existing_policy.paid_out && paid_out {
            return Err("Policy already paid out".to_string());
        }
        if paid_out && flood_level_unsigned < flood_threshold {
            return Err("Flood level below threshold".to_string());
        }

        // Apply mutations after checks
        let mut state = cell.borrow_mut();
        let policy = state.policies.get_mut(&policy_id).ok_or("Policy not found")?;
        policy.active = active;
        policy.paid_out = paid_out;
        Ok(())
    })
}

// Get all policies (admin only)
#[query]
fn get_all_policies() -> Result<Vec<Policy>, String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let state = state.borrow();
        
        // Check if caller is admin
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        Ok(state.policies.values().cloned().collect())
    })
}

// Get policy statistics
#[query]
fn get_policy_stats() -> (u64, u64, u64) {
    STATE.with(|state| {
        let state = state.borrow();
        let total = state.policy_id_counter;
        let active = state.policies.values().filter(|p| p.active).count() as u64;
        let paid_out = state.policies.values().filter(|p| p.paid_out).count() as u64;
        
        (total, active, paid_out)
    })
}

// Set flood level (oracle function)
#[update]
fn set_flood_level(flood_level: i64) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        // Check if caller is authorized oracle updater
        if !state.oracle_updaters.contains(&caller) && state.admin != caller {
            return Err("Unauthorized: Oracle updater access required".to_string());
        }
        
        state.flood_level = flood_level;
        Ok(())
    })
}

// Get current flood level
#[query]
fn get_flood_level() -> i64 {
    STATE.with(|state| state.borrow().flood_level)
}

// Set flood threshold (admin only)
#[update]
fn set_flood_threshold(threshold: u64) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        // Check if caller is admin
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        // Validate threshold
        if threshold == 0 {
            return Err("Threshold must be positive".to_string());
        }
        
        if threshold > 10000000000000 { // Max 100 feet
            return Err("Threshold too high".to_string());
        }
        
        state.flood_threshold = threshold;
        Ok(())
    })
}

// Get current flood threshold
#[query]
fn get_flood_threshold() -> u64 {
    STATE.with(|state| state.borrow().flood_threshold)
}

// Add oracle updater (admin only)
#[update]
fn add_oracle_updater(oracle: Principal) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        if !state.oracle_updaters.contains(&oracle) {
            state.oracle_updaters.push(oracle);
        }
        
        Ok(())
    })
}

// Remove oracle updater (admin only)
#[update]
fn remove_oracle_updater(oracle: Principal) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        state.oracle_updaters.retain(|&p| p != oracle);
        Ok(())
    })
}

// Get oracle updaters list (admin only)
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

// Transfer admin role
#[update]
fn transfer_admin(new_admin: Principal) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        
        if state.admin != caller {
            return Err("Unauthorized: Admin access required".to_string());
        }
        
        state.admin = new_admin;
        Ok(())
    })
}

// Get current admin
#[query]
fn get_admin() -> Principal {
    STATE.with(|state| state.borrow().admin)
}

// Check if payout is eligible for a policyholder
#[query]
fn is_payout_eligible(policyholder: Principal) -> bool {
    STATE.with(|state| {
        let state = state.borrow();
        
        // Get policy ID for the policyholder
        if let Some(policy_id) = state.policyholder_map.get(&policyholder) {
            // Get the policy
            if let Some(policy) = state.policies.get(policy_id) {
                // Check if policy is active and not paid out
                if policy.active && !policy.paid_out {
                    // Check if flood level exceeds threshold
                    let flood_level_unsigned = state.flood_level as u64;
                    return flood_level_unsigned >= state.flood_threshold;
                }
            }
        }
        
        false
    })
}

// Trigger payout for the caller's policy
#[update]
fn trigger_payout() -> Result<Nat, String> {
    let caller = ic_cdk::caller();
    
    STATE.with(|cell| {
        // Snapshot immutable data first
        let (policy_id_opt, flood_level_unsigned, flood_threshold, policy_snapshot) = {
            let state = cell.borrow();
            let pid = state.policyholder_map.get(&caller).cloned();
            let snap = pid.and_then(|id| state.policies.get(&id).cloned());
            (pid, state.flood_level as u64, state.flood_threshold, snap)
        };

        let policy_id = policy_id_opt.ok_or("No policy found")?;
        let policy = policy_snapshot.ok_or("Policy not found")?;

        if !policy.active {
            return Err("No active policy".to_string());
        }
        if policy.paid_out {
            return Err("Payout already issued".to_string());
        }
        if flood_level_unsigned < flood_threshold {
            return Err("Flood level below threshold".to_string());
        }

        // Apply mutations
        let mut state = cell.borrow_mut();
        let policy_mut = state.policies.get_mut(&policy_id).ok_or("Policy not found")?;
        policy_mut.paid_out = true;
        policy_mut.active = false;
        Ok(policy_mut.coverage.clone())
    })
}

// Candid interface export
ic_cdk::export_candid!();
