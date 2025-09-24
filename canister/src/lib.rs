use ic_cdk::api::{caller, time};
use ic_cdk_macros::{init, query, update, pre_upgrade, post_upgrade};
use candid::{CandidType, Deserialize, Principal, Nat};
use std::cell::RefCell;
use std::collections::HashMap;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, Storable,
};
use std::borrow::Cow;

// Type definitions
type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Policy {
    pub policyholder: Principal,
    pub premium: u64,        // Premium paid in ICP e-8s (1 ICP = 100_000_000 e-8s)
    pub coverage: u64,       // Coverage amount in ICP e-8s
    pub active: bool,
    pub paid_out: bool,
    pub created_at: u64,     // Timestamp in nanoseconds
    pub flood_level_at_creation: f64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FloodData {
    pub level: f64,          // Current water level in feet
    pub threshold: f64,      // Payout trigger threshold (default 3.0 feet)
    pub last_updated: u64,   // Timestamp in nanoseconds
    pub station_id: String,  // USGS station identifier
}

#[derive(CandidType, Deserialize, Clone)]
pub struct SystemStatus {
    pub total_policies: u64,
    pub active_policies: u64,
    pub total_payouts: u64,
    pub contract_balance: u64,
    pub current_flood_level: f64,
    pub flood_threshold: f64,
    pub last_oracle_update: u64,
}

#[derive(CandidType, Deserialize)]
pub struct CreatePolicyRequest {
    pub coverage_amount: u64,  // Desired coverage in ICP e-8s
}

#[derive(CandidType, Deserialize)]
pub struct PayoutResult {
    pub success: bool,
    pub amount: u64,
    pub message: String,
}

// Stable storage
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );
    
    // In-memory state (will be persisted in upgrades)
    static POLICIES: RefCell<HashMap<Principal, Policy>> = RefCell::new(HashMap::new());
    static FLOOD_DATA: RefCell<FloodData> = RefCell::new(FloodData {
        level: 0.0,
        threshold: 3.0,
        last_updated: 0,
        station_id: "01646500".to_string(), // Default USGS station
    });
    static ADMIN: RefCell<Principal> = RefCell::new(Principal::anonymous());
    static CONTRACT_BALANCE: RefCell<u64> = RefCell::new(0);
    static ORACLE_PRINCIPALS: RefCell<Vec<Principal>> = RefCell::new(Vec::new());
}

// Initialize canister
#[init]
fn init() {
    let caller_principal = caller();
    ADMIN.with(|admin| {
        *admin.borrow_mut() = caller_principal;
    });
    
    // Add the deployer as an oracle updater
    ORACLE_PRINCIPALS.with(|oracles| {
        oracles.borrow_mut().push(caller_principal);
    });
    
    ic_cdk::println!("Paramify Insurance Canister initialized. Admin: {}", caller_principal);
}

// Create a new insurance policy
#[update]
async fn create_policy(request: CreatePolicyRequest) -> Result<String, String> {
    let policyholder = caller();
    
    // Validate coverage amount
    if request.coverage_amount == 0 {
        return Err("Coverage amount must be greater than 0".to_string());
    }
    
    // Calculate premium (10% of coverage)
    let premium = request.coverage_amount / 10;
    
    // Check if user already has an active policy
    let has_active_policy = POLICIES.with(|policies| {
        policies.borrow().get(&policyholder)
            .map(|p| p.active)
            .unwrap_or(false)
    });
    
    if has_active_policy {
        return Err("You already have an active policy".to_string());
    }
    
    // Get current flood level
    let current_flood_level = FLOOD_DATA.with(|flood_data| {
        flood_data.borrow().level
    });
    
    // Create new policy
    let policy = Policy {
        policyholder: policyholder.clone(),
        premium,
        coverage: request.coverage_amount,
        active: true,
        paid_out: false,
        created_at: time(),
        flood_level_at_creation: current_flood_level,
    };
    
    // Store policy
    POLICIES.with(|policies| {
        policies.borrow_mut().insert(policyholder, policy);
    });
    
    // Update contract balance (simulate premium payment)
    CONTRACT_BALANCE.with(|balance| {
        *balance.borrow_mut() += premium;
    });
    
    Ok(format!(
        "Policy created successfully! Premium: {} e-8s, Coverage: {} e-8s",
        premium, request.coverage_amount
    ))
}

// Trigger payout for eligible policy
#[update]
async fn trigger_payout() -> Result<PayoutResult, String> {
    let policyholder = caller();
    
    // Get current flood data
    let (current_level, threshold) = FLOOD_DATA.with(|flood_data| {
        let data = flood_data.borrow();
        (data.level, data.threshold)
    });
    
    // Check if flood level exceeds threshold
    if current_level <= threshold {
        return Err(format!(
            "Flood level ({:.2} ft) is below payout threshold ({:.2} ft)",
            current_level, threshold
        ));
    }
    
    // Get and validate policy
    let mut policy = POLICIES.with(|policies| {
        policies.borrow().get(&policyholder).cloned()
    }).ok_or("No policy found for this user".to_string())?;
    
    if !policy.active {
        return Err("Policy is not active".to_string());
    }
    
    if policy.paid_out {
        return Err("Policy has already been paid out".to_string());
    }
    
    // Check contract balance
    let contract_balance = CONTRACT_BALANCE.with(|balance| *balance.borrow());
    if contract_balance < policy.coverage {
        return Err("Insufficient contract balance for payout".to_string());
    }
    
    // Process payout
    policy.paid_out = true;
    policy.active = false;
    
    // Update policy
    POLICIES.with(|policies| {
        policies.borrow_mut().insert(policyholder, policy.clone());
    });
    
    // Update contract balance
    CONTRACT_BALANCE.with(|balance| {
        *balance.borrow_mut() -= policy.coverage;
    });
    
    Ok(PayoutResult {
        success: true,
        amount: policy.coverage,
        message: format!(
            "Payout of {} e-8s processed successfully! Flood level: {:.2} ft",
            policy.coverage, current_level
        ),
    })
}

// Update flood level (restricted to oracle/admin)
#[update]
fn set_flood_level(level: f64, station_id: Option<String>) -> Result<String, String> {
    let caller_principal = caller();
    
    // Check authorization
    let is_authorized = ADMIN.with(|admin| {
        *admin.borrow() == caller_principal
    }) || ORACLE_PRINCIPALS.with(|oracles| {
        oracles.borrow().contains(&caller_principal)
    });
    
    if !is_authorized {
        return Err("Unauthorized: Only admin or oracle can update flood level".to_string());
    }
    
    // Validate level
    if level < 0.0 || level > 100.0 {
        return Err("Invalid flood level: must be between 0 and 100 feet".to_string());
    }
    
    // Update flood data
    FLOOD_DATA.with(|flood_data| {
        let mut data = flood_data.borrow_mut();
        data.level = level;
        data.last_updated = time();
        if let Some(id) = station_id {
            data.station_id = id;
        }
    });
    
    Ok(format!("Flood level updated to {:.2} feet", level))
}

// Update flood threshold (admin only)
#[update]
fn set_threshold(new_threshold: f64) -> Result<String, String> {
    let caller_principal = caller();
    
    // Check if caller is admin
    let is_admin = ADMIN.with(|admin| {
        *admin.borrow() == caller_principal
    });
    
    if !is_admin {
        return Err("Unauthorized: Only admin can update threshold".to_string());
    }
    
    // Validate threshold
    if new_threshold <= 0.0 || new_threshold > 50.0 {
        return Err("Invalid threshold: must be between 0 and 50 feet".to_string());
    }
    
    let old_threshold = FLOOD_DATA.with(|flood_data| {
        let mut data = flood_data.borrow_mut();
        let old = data.threshold;
        data.threshold = new_threshold;
        old
    });
    
    Ok(format!(
        "Threshold updated from {:.2} feet to {:.2} feet",
        old_threshold, new_threshold
    ))
}

// Add oracle principal (admin only)
#[update]
fn add_oracle(oracle: Principal) -> Result<String, String> {
    let caller_principal = caller();
    
    // Check if caller is admin
    let is_admin = ADMIN.with(|admin| {
        *admin.borrow() == caller_principal
    });
    
    if !is_admin {
        return Err("Unauthorized: Only admin can add oracles".to_string());
    }
    
    ORACLE_PRINCIPALS.with(|oracles| {
        let mut oracles = oracles.borrow_mut();
        if !oracles.contains(&oracle) {
            oracles.push(oracle);
            Ok(format!("Oracle {} added successfully", oracle))
        } else {
            Err("Oracle already exists".to_string())
        }
    })
}

// Fund contract (admin only)
#[update]
fn fund_contract(amount: u64) -> Result<String, String> {
    let caller_principal = caller();
    
    // Check if caller is admin
    let is_admin = ADMIN.with(|admin| {
        *admin.borrow() == caller_principal
    });
    
    if !is_admin {
        return Err("Unauthorized: Only admin can fund contract".to_string());
    }
    
    CONTRACT_BALANCE.with(|balance| {
        *balance.borrow_mut() += amount;
    });
    
    Ok(format!("Contract funded with {} e-8s", amount))
}

// Query functions

#[query]
fn get_policy(user: Option<Principal>) -> Option<Policy> {
    let target = user.unwrap_or_else(caller);
    POLICIES.with(|policies| {
        policies.borrow().get(&target).cloned()
    })
}

#[query]
fn get_flood_data() -> FloodData {
    FLOOD_DATA.with(|flood_data| {
        flood_data.borrow().clone()
    })
}

#[query]
fn get_system_status() -> SystemStatus {
    let (total_policies, active_policies, total_payouts) = POLICIES.with(|policies| {
        let policies = policies.borrow();
        let total = policies.len() as u64;
        let active = policies.values().filter(|p| p.active).count() as u64;
        let payouts = policies.values().filter(|p| p.paid_out).count() as u64;
        (total, active, payouts)
    });
    
    let contract_balance = CONTRACT_BALANCE.with(|balance| *balance.borrow());
    
    let (current_flood_level, flood_threshold, last_oracle_update) = FLOOD_DATA.with(|flood_data| {
        let data = flood_data.borrow();
        (data.level, data.threshold, data.last_updated)
    });
    
    SystemStatus {
        total_policies,
        active_policies,
        total_payouts,
        contract_balance,
        current_flood_level,
        flood_threshold,
        last_oracle_update,
    }
}

#[query]
fn is_payout_eligible(user: Option<Principal>) -> bool {
    let target = user.unwrap_or_else(caller);
    
    // Get policy
    let policy = POLICIES.with(|policies| {
        policies.borrow().get(&target).cloned()
    });
    
    match policy {
        Some(p) if p.active && !p.paid_out => {
            // Check flood level
            FLOOD_DATA.with(|flood_data| {
                let data = flood_data.borrow();
                data.level > data.threshold
            })
        },
        _ => false,
    }
}

#[query]
fn get_admin() -> Principal {
    ADMIN.with(|admin| *admin.borrow())
}

#[query]
fn get_oracles() -> Vec<Principal> {
    ORACLE_PRINCIPALS.with(|oracles| oracles.borrow().clone())
}

// Upgrade hooks for state persistence
#[pre_upgrade]
fn pre_upgrade() {
    // Store state before upgrade
    let policies = POLICIES.with(|p| p.borrow().clone());
    let flood_data = FLOOD_DATA.with(|f| f.borrow().clone());
    let admin = ADMIN.with(|a| *a.borrow());
    let balance = CONTRACT_BALANCE.with(|b| *b.borrow());
    let oracles = ORACLE_PRINCIPALS.with(|o| o.borrow().clone());
    
    ic_cdk::storage::stable_save((policies, flood_data, admin, balance, oracles))
        .expect("Failed to save state");
}

#[post_upgrade]
fn post_upgrade() {
    // Restore state after upgrade
    let (policies, flood_data, admin, balance, oracles): (
        HashMap<Principal, Policy>,
        FloodData,
        Principal,
        u64,
        Vec<Principal>,
    ) = ic_cdk::storage::stable_restore().expect("Failed to restore state");
    
    POLICIES.with(|p| *p.borrow_mut() = policies);
    FLOOD_DATA.with(|f| *f.borrow_mut() = flood_data);
    ADMIN.with(|a| *a.borrow_mut() = admin);
    CONTRACT_BALANCE.with(|b| *b.borrow_mut() = balance);
    ORACLE_PRINCIPALS.with(|o| *o.borrow_mut() = oracles);
}

// Export Candid interface
ic_cdk::export_candid!();
