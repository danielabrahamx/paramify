export const idlFactory = ({ IDL }) => {
  const PolicyId = IDL.Text;
  const TokenAmount = IDL.Nat;
  const Timestamp = IDL.Int;
  
  const PolicyStatus = IDL.Variant({
    'Active': IDL.Null,
    'Expired': IDL.Null,
    'PaidOut': IDL.Null,
    'Cancelled': IDL.Null,
  });

  const Policy = IDL.Record({
    'id': PolicyId,
    'customer': IDL.Principal,
    'coverage_amount': TokenAmount,
    'premium_amount': TokenAmount,
    'purchase_date': Timestamp,
    'expiry_date': Timestamp,
    'status': PolicyStatus,
    'flood_threshold': IDL.Float64,
    'last_payout_check': IDL.Opt(Timestamp),
    'total_payouts': TokenAmount,
  });

  const PolicyRequest = IDL.Record({
    'coverage_amount': TokenAmount,
  });

  const InsuranceConfig = IDL.Record({
    'oracle_canister': IDL.Principal,
    'payments_canister': IDL.Principal,
    'token_canister': IDL.Principal,
    'default_threshold': IDL.Float64,
    'premium_percentage': IDL.Nat,
  });

  const SystemStatus = IDL.Record({
    'total_policies': IDL.Nat,
    'active_policies': IDL.Nat,
    'total_premiums_collected': TokenAmount,
    'total_payouts_made': TokenAmount,
    'pool_balance': TokenAmount,
    'last_oracle_update': IDL.Opt(Timestamp),
    'current_flood_level': IDL.Opt(IDL.Float64),
    'configuration': InsuranceConfig,
  });

  const Result = IDL.Variant({
    'ok': IDL.Text,
    'err': IDL.Text,
  });

  const PolicyResult = IDL.Variant({
    'ok': Policy,
    'err': IDL.Text,
  });

  const PayoutEligibility = IDL.Record({
    'eligible': IDL.Bool,
    'current_flood_level': IDL.Float64,
    'threshold': IDL.Float64,
    'policy_status': PolicyStatus,
    'reason': IDL.Opt(IDL.Text),
  });

  return IDL.Service({
    'initialize': IDL.Func([InsuranceConfig], [Result], []),
    'purchase_policy': IDL.Func([PolicyRequest], [PolicyResult], []),
    'cancel_policy': IDL.Func([], [Result], []),
    'renew_policy': IDL.Func([], [PolicyResult], []),
    'check_payout_eligibility': IDL.Func([IDL.Principal], [PayoutEligibility], ['query']),
    'claim_payout': IDL.Func([], [Result], []),
    'process_automatic_payouts': IDL.Func([], [Result], []),
    'get_policy': IDL.Func([IDL.Principal], [IDL.Opt(Policy)], ['query']),
    'get_policy_by_id': IDL.Func([PolicyId], [IDL.Opt(Policy)], ['query']),
    'get_all_active_policies': IDL.Func([], [IDL.Vec(Policy)], ['query']),
    'get_customer_policies': IDL.Func([IDL.Principal], [IDL.Vec(Policy)], ['query']),
    'get_expired_policies': IDL.Func([IDL.Nat], [IDL.Vec(Policy)], ['query']),
    'get_system_status': IDL.Func([], [SystemStatus], ['query']),
    'update_threshold': IDL.Func([IDL.Float64], [Result], []),
    'update_premium_percentage': IDL.Func([IDL.Nat], [Result], []),
    'set_oracle_canister': IDL.Func([IDL.Principal], [Result], []),
    'set_payments_canister': IDL.Func([IDL.Principal], [Result], []),
    'add_admin': IDL.Func([IDL.Principal], [Result], []),
    'remove_admin': IDL.Func([IDL.Principal], [Result], []),
    'is_admin': IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    'emergency_pause': IDL.Func([], [Result], []),
    'emergency_resume': IDL.Func([], [Result], []),
    'get_total_premiums': IDL.Func([], [TokenAmount], ['query']),
    'get_total_payouts': IDL.Func([], [TokenAmount], ['query']),
    'get_policy_count': IDL.Func([], [IDL.Nat], ['query']),
  });
};

export const init = ({ IDL }) => { return []; };