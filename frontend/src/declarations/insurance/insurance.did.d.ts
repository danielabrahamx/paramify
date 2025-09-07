import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type PolicyId = string;
export type TokenAmount = bigint;
export type Timestamp = bigint;

export type PolicyStatus = 
  | { 'Active': null }
  | { 'Expired': null }
  | { 'PaidOut': null }
  | { 'Cancelled': null };

export interface Policy {
  'id': PolicyId;
  'customer': Principal;
  'coverage_amount': TokenAmount;
  'premium_amount': TokenAmount;
  'purchase_date': Timestamp;
  'expiry_date': Timestamp;
  'status': PolicyStatus;
  'flood_threshold': number;
  'last_payout_check': [] | [Timestamp];
  'total_payouts': TokenAmount;
}

export interface PolicyRequest {
  'coverage_amount': TokenAmount;
}

export interface InsuranceConfig {
  'oracle_canister': Principal;
  'payments_canister': Principal;
  'token_canister': Principal;
  'default_threshold': number;
  'premium_percentage': bigint;
}

export interface SystemStatus {
  'total_policies': bigint;
  'active_policies': bigint;
  'total_premiums_collected': TokenAmount;
  'total_payouts_made': TokenAmount;
  'pool_balance': TokenAmount;
  'last_oracle_update': [] | [Timestamp];
  'current_flood_level': [] | [number];
  'configuration': InsuranceConfig;
}

export type Result = { 'ok': string } | { 'err': string };
export type PolicyResult = { 'ok': Policy } | { 'err': string };

export interface PayoutEligibility {
  'eligible': boolean;
  'current_flood_level': number;
  'threshold': number;
  'policy_status': PolicyStatus;
  'reason': [] | [string];
}

export interface _SERVICE {
  'initialize': ActorMethod<[InsuranceConfig], Result>;
  'purchase_policy': ActorMethod<[PolicyRequest], PolicyResult>;
  'cancel_policy': ActorMethod<[], Result>;
  'renew_policy': ActorMethod<[], PolicyResult>;
  'check_payout_eligibility': ActorMethod<[Principal], PayoutEligibility>;
  'claim_payout': ActorMethod<[], Result>;
  'process_automatic_payouts': ActorMethod<[], Result>;
  'get_policy': ActorMethod<[Principal], [] | [Policy]>;
  'get_policy_by_id': ActorMethod<[PolicyId], [] | [Policy]>;
  'get_all_active_policies': ActorMethod<[], Array<Policy>>;
  'get_customer_policies': ActorMethod<[Principal], Array<Policy>>;
  'get_expired_policies': ActorMethod<[bigint], Array<Policy>>;
  'get_system_status': ActorMethod<[], SystemStatus>;
  'update_threshold': ActorMethod<[number], Result>;
  'update_premium_percentage': ActorMethod<[bigint], Result>;
  'set_oracle_canister': ActorMethod<[Principal], Result>;
  'set_payments_canister': ActorMethod<[Principal], Result>;
  'add_admin': ActorMethod<[Principal], Result>;
  'remove_admin': ActorMethod<[Principal], Result>;
  'is_admin': ActorMethod<[Principal], boolean>;
  'emergency_pause': ActorMethod<[], Result>;
  'emergency_resume': ActorMethod<[], Result>;
  'get_total_premiums': ActorMethod<[], TokenAmount>;
  'get_total_payouts': ActorMethod<[], TokenAmount>;
  'get_policy_count': ActorMethod<[], bigint>;
}