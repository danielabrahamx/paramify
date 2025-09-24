use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{api, query, update, init, pre_upgrade, post_upgrade};
use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpMethod, HttpResponse, TransformArgs,
    TransformContext, TransformFunc,
};
use ic_cdk_timers::set_timer_interval;
use serde::{Deserialize as SerdeDeserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use std::time::Duration;

// ============================================
// Type Definitions
// ============================================

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct FloodData {
    pub location: String,
    pub water_level_feet: f64,
    pub timestamp: u64,
    pub source: String,
    pub site_name: String,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct OracleConfig {
    pub update_interval_seconds: u64,
    pub max_retries: u32,
    pub authorized_principals: Vec<Principal>,
    pub usgs_base_url: String,
    pub is_paused: bool,
}

#[derive(CandidType, Deserialize, Serialize)]
pub struct GetDataRequest {
    pub location: String,
}

#[derive(CandidType, Deserialize)]
pub struct InitArgs {
    pub update_interval_seconds: Option<u64>,
    pub authorized_principals: Option<Vec<Principal>>,
}

#[derive(CandidType, Deserialize, Serialize, Clone)]
pub struct CachedData {
    pub data: FloodData,
    pub cached_at: u64,
}

#[derive(CandidType, Deserialize, Serialize)]
pub struct OracleStatus {
    pub total_updates: u64,
    pub last_update_time: Option<u64>,
    pub last_error: Option<String>,
    pub cached_locations: Vec<String>,
    pub is_paused: bool,
    pub update_interval_seconds: u64,
}

// USGS API Response structures
#[derive(SerdeDeserialize, Debug)]
struct UsgsResponse {
    value: UsgsValue,
}

#[derive(SerdeDeserialize, Debug)]
struct UsgsValue {
    #[serde(rename = "timeSeries")]
    time_series: Vec<UsgsTimeSeries>,
}

#[derive(SerdeDeserialize, Debug)]
struct UsgsTimeSeries {
    #[serde(rename = "sourceInfo")]
    source_info: UsgsSourceInfo,
    values: Vec<UsgsValues>,
}

#[derive(SerdeDeserialize, Debug)]
struct UsgsSourceInfo {
    #[serde(rename = "siteName")]
    site_name: String,
    #[serde(rename = "siteCode")]
    site_code: Vec<UsgsSiteCode>,
}

#[derive(SerdeDeserialize, Debug)]
struct UsgsSiteCode {
    value: String,
}

#[derive(SerdeDeserialize, Debug)]
struct UsgsValues {
    value: Vec<UsgsValue2>,
}

#[derive(SerdeDeserialize, Debug)]
struct UsgsValue2 {
    value: String,
    #[serde(rename = "dateTime")]
    date_time: String,
}

// ============================================
// State Management
// ============================================

thread_local! {
    static CONFIG: RefCell<OracleConfig> = RefCell::new(OracleConfig {
        update_interval_seconds: 300, // 5 minutes
        max_retries: 3,
        authorized_principals: vec![],
        usgs_base_url: "https://waterservices.usgs.gov/nwis/iv/".to_string(),
        is_paused: false,
    });
    
    static DATA_CACHE: RefCell<HashMap<String, CachedData>> = RefCell::new(HashMap::new());
    static STATS: RefCell<OracleStats> = RefCell::new(OracleStats::default());
    static TIMER_ID: RefCell<Option<ic_cdk_timers::TimerId>> = RefCell::new(None);
}

#[derive(Default, Clone, Serialize, Deserialize)]
struct OracleStats {
    total_updates: u64,
    last_update_time: Option<u64>,
    last_error: Option<String>,
    successful_fetches: u64,
    failed_fetches: u64,
}

// ============================================
// Initialization and Upgrade Hooks
// ============================================

#[init]
fn init(args: Option<InitArgs>) {
    ic_cdk::println!("Oracle canister initializing...");
    
    if let Some(args) = args {
        CONFIG.with(|config| {
            let mut cfg = config.borrow_mut();
            
            if let Some(interval) = args.update_interval_seconds {
                cfg.update_interval_seconds = interval.max(60); // Minimum 1 minute
            }
            
            if let Some(principals) = args.authorized_principals {
                cfg.authorized_principals = principals;
            }
            
            // Add the caller as an authorized principal
            let caller = api::caller();
            if !cfg.authorized_principals.contains(&caller) {
                cfg.authorized_principals.push(caller);
            }
        });
    }
    
    // Start the update timer
    start_update_timer();
    
    ic_cdk::println!("Oracle canister initialized successfully");
}

#[pre_upgrade]
fn pre_upgrade() {
    // Stop the timer before upgrade
    TIMER_ID.with(|id| {
        if let Some(timer_id) = id.borrow().as_ref() {
            ic_cdk_timers::clear_timer(*timer_id);
        }
    });
}

#[post_upgrade]
fn post_upgrade() {
    // Restart the timer after upgrade
    start_update_timer();
    ic_cdk::println!("Oracle canister upgraded successfully");
}

// ============================================
// Access Control
// ============================================

fn is_authorized(caller: Principal) -> bool {
    CONFIG.with(|config| {
        let cfg = config.borrow();
        cfg.authorized_principals.contains(&caller) || api::is_controller(&caller)
    })
}

fn require_authorized() -> Result<(), String> {
    let caller = api::caller();
    if is_authorized(caller) {
        Ok(())
    } else {
        Err("Unauthorized: Caller is not authorized".to_string())
    }
}

// ============================================
// Timer Management
// ============================================

fn start_update_timer() {
    let interval_seconds = CONFIG.with(|config| config.borrow().update_interval_seconds);
    let interval = Duration::from_secs(interval_seconds);
    
    let timer_id = set_timer_interval(interval, || {
        ic_cdk::spawn(async {
            update_all_cached_locations().await;
        });
    });
    
    TIMER_ID.with(|id| {
        *id.borrow_mut() = Some(timer_id);
    });
    
    ic_cdk::println!("Update timer started with interval: {} seconds", interval_seconds);
}

async fn update_all_cached_locations() {
    let locations: Vec<String> = DATA_CACHE.with(|cache| {
        cache.borrow().keys().cloned().collect()
    });
    
    for location in locations {
        if let Err(e) = fetch_and_cache_data(&location).await {
            ic_cdk::println!("Failed to update location {}: {}", location, e);
            STATS.with(|stats| {
                let mut s = stats.borrow_mut();
                s.failed_fetches += 1;
                s.last_error = Some(e);
            });
        }
    }
}

// ============================================
// HTTPS Outcalls
// ============================================

async fn fetch_usgs_data(site_id: &str) -> Result<FloodData, String> {
    let base_url = CONFIG.with(|config| config.borrow().usgs_base_url.clone());
    let url = format!(
        "{}?format=json&sites={}&parameterCd=00065&siteStatus=all",
        base_url, site_id
    );
    
    ic_cdk::println!("Fetching USGS data from: {}", url);
    
    let request = CanisterHttpRequestArgument {
        url: url.clone(),
        method: HttpMethod::GET,
        body: None,
        max_response_bytes: Some(10_000),
        transform: Some(TransformContext {
            function: TransformFunc(candid::Func {
                principal: api::id(),
                method: "transform_usgs_response".to_string(),
            }),
            context: vec![],
        }),
        headers: vec![],
    };
    
    // Calculate cycles needed for the HTTP request
    let cycles = 20_000_000_000_u128; // 20 billion cycles
    
    match http_request(request, cycles).await {
        Ok((response,)) => {
            parse_usgs_response(response, site_id)
        }
        Err(e) => {
            ic_cdk::println!("HTTP request failed: {:?}", e);
            Err(format!("HTTP request failed: {:?}", e))
        }
    }
}

fn parse_usgs_response(response: HttpResponse, site_id: &str) -> Result<FloodData, String> {
    let body = String::from_utf8(response.body)
        .map_err(|e| format!("Failed to parse response body: {}", e))?;
    
    let usgs_response: UsgsResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    // Extract the first time series data
    let time_series = usgs_response.value.time_series
        .first()
        .ok_or("No time series data found")?;
    
    let site_name = time_series.source_info.site_name.clone();
    
    // Get the latest value
    let latest_values = time_series.values
        .first()
        .ok_or("No values found")?;
    
    let latest_value = latest_values.value
        .first()
        .ok_or("No latest value found")?;
    
    let water_level_feet = latest_value.value.parse::<f64>()
        .map_err(|e| format!("Failed to parse water level: {}", e))?;
    
    Ok(FloodData {
        location: site_id.to_string(),
        water_level_feet,
        timestamp: api::time(),
        source: "USGS Water Data".to_string(),
        site_name,
    })
}

// Transform function for HTTPS outcall responses
#[query]
fn transform_usgs_response(args: TransformArgs) -> HttpResponse {
    // Return the response as-is for simplicity
    // In production, you might want to validate or sanitize the response
    args.response
}

async fn fetch_and_cache_data(location: &str) -> Result<(), String> {
    if CONFIG.with(|config| config.borrow().is_paused) {
        return Err("Oracle is paused".to_string());
    }
    
    match fetch_usgs_data(location).await {
        Ok(data) => {
            let cached_data = CachedData {
                data: data.clone(),
                cached_at: api::time(),
            };
            
            DATA_CACHE.with(|cache| {
                cache.borrow_mut().insert(location.to_string(), cached_data);
            });
            
            STATS.with(|stats| {
                let mut s = stats.borrow_mut();
                s.total_updates += 1;
                s.successful_fetches += 1;
                s.last_update_time = Some(api::time());
                s.last_error = None;
            });
            
            ic_cdk::println!("Successfully cached data for location: {}", location);
            Ok(())
        }
        Err(e) => {
            STATS.with(|stats| {
                let mut s = stats.borrow_mut();
                s.failed_fetches += 1;
                s.last_error = Some(e.clone());
            });
            Err(e)
        }
    }
}

// ============================================
// Query Methods
// ============================================

#[query]
fn get_latest_data(location: String) -> Result<FloodData, String> {
    DATA_CACHE.with(|cache| {
        cache.borrow()
            .get(&location)
            .map(|cached| cached.data.clone())
            .ok_or_else(|| format!("No data available for location: {}", location))
    })
}

#[query]
fn get_cached_data(location: String) -> Option<CachedData> {
    DATA_CACHE.with(|cache| {
        cache.borrow().get(&location).cloned()
    })
}

#[query]
fn get_all_cached_locations() -> Vec<String> {
    DATA_CACHE.with(|cache| {
        cache.borrow().keys().cloned().collect()
    })
}

#[query]
fn get_status() -> OracleStatus {
    let stats = STATS.with(|s| s.borrow().clone());
    let config = CONFIG.with(|c| c.borrow().clone());
    let locations = get_all_cached_locations();
    
    OracleStatus {
        total_updates: stats.total_updates,
        last_update_time: stats.last_update_time,
        last_error: stats.last_error,
        cached_locations: locations,
        is_paused: config.is_paused,
        update_interval_seconds: config.update_interval_seconds,
    }
}

#[query]
fn get_configuration() -> OracleConfig {
    CONFIG.with(|config| config.borrow().clone())
}

// ============================================
// Update Methods
// ============================================

#[update]
async fn manual_update(location: String) -> Result<FloodData, String> {
    require_authorized()?;
    
    fetch_and_cache_data(&location).await?;
    get_latest_data(location)
}

#[update]
async fn batch_update(locations: Vec<String>) -> Vec<(String, Result<FloodData, String>)> {
    if let Err(e) = require_authorized() {
        return locations.into_iter().map(|loc| (loc, Err(e.clone()))).collect();
    }
    
    let mut results = vec![];
    
    for location in locations {
        let result = fetch_and_cache_data(&location).await
            .and_then(|_| get_latest_data(location.clone()));
        results.push((location, result));
    }
    
    results
}

#[update]
fn update_configuration(new_config: OracleConfig) -> Result<String, String> {
    require_authorized()?;
    
    // Validate configuration
    if new_config.update_interval_seconds < 60 {
        return Err("Update interval must be at least 60 seconds".to_string());
    }
    
    CONFIG.with(|config| {
        *config.borrow_mut() = new_config;
    });
    
    // Restart timer with new interval
    TIMER_ID.with(|id| {
        if let Some(timer_id) = id.borrow().as_ref() {
            ic_cdk_timers::clear_timer(*timer_id);
        }
    });
    start_update_timer();
    
    Ok("Configuration updated successfully".to_string())
}

#[update]
fn set_paused(paused: bool) -> Result<String, String> {
    require_authorized()?;
    
    CONFIG.with(|config| {
        config.borrow_mut().is_paused = paused;
    });
    
    if paused {
        // Stop the timer
        TIMER_ID.with(|id| {
            if let Some(timer_id) = id.borrow().as_ref() {
                ic_cdk_timers::clear_timer(*timer_id);
            }
            *id.borrow_mut() = None;
        });
        Ok("Oracle paused".to_string())
    } else {
        // Restart the timer
        start_update_timer();
        Ok("Oracle unpaused".to_string())
    }
}

#[update]
fn add_authorized_principal(principal: Principal) -> Result<String, String> {
    require_authorized()?;
    
    CONFIG.with(|config| {
        let mut cfg = config.borrow_mut();
        if !cfg.authorized_principals.contains(&principal) {
            cfg.authorized_principals.push(principal);
            Ok(format!("Principal {} added to authorized list", principal))
        } else {
            Err("Principal already authorized".to_string())
        }
    })
}

#[update]
fn remove_authorized_principal(principal: Principal) -> Result<String, String> {
    require_authorized()?;
    
    CONFIG.with(|config| {
        let mut cfg = config.borrow_mut();
        cfg.authorized_principals.retain(|&p| p != principal);
        Ok(format!("Principal {} removed from authorized list", principal))
    })
}

#[update]
fn clear_cache() -> Result<String, String> {
    require_authorized()?;
    
    DATA_CACHE.with(|cache| {
        let size = cache.borrow().len();
        cache.borrow_mut().clear();
        Ok(format!("Cleared {} cached entries", size))
    })
}

// ============================================
// Candid Interface
// ============================================

ic_cdk::export_candid!();