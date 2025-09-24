export const idlFactory = ({ IDL }) => {
  const Policy = IDL.Record({
    'active' : IDL.Bool,
    'premium' : IDL.Nat,
    'paid_out' : IDL.Bool,
    'purchase_time' : IDL.Nat64,
    'coverage' : IDL.Nat,
    'policyholder' : IDL.Principal,
    'policy_id' : IDL.Nat64,
  });
  const MirrorPolicy = IDL.Record({
    'policyholder_eth' : IDL.Text,
    'active' : IDL.Bool,
    'premium_wei' : IDL.Nat,
    'paid_out' : IDL.Bool,
    'purchase_time' : IDL.Nat64,
    'policy_id' : IDL.Nat64,
    'coverage_wei' : IDL.Nat,
  });
  return IDL.Service({
    'add_oracle_updater' : IDL.Func(
        [IDL.Principal],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'create_policy' : IDL.Func(
        [IDL.Nat, IDL.Nat],
        [IDL.Variant({ 'Ok' : IDL.Nat64, 'Err' : IDL.Text })],
        [],
      ),
    'get_admin' : IDL.Func([], [IDL.Principal], ['query']),
    'get_all_policies' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : IDL.Vec(Policy), 'Err' : IDL.Text })],
        ['query'],
      ),
    'get_flood_level' : IDL.Func([], [IDL.Int64], ['query']),
    'get_flood_threshold' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_oracle_updaters' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : IDL.Vec(IDL.Principal), 'Err' : IDL.Text })],
        ['query'],
      ),
    'get_policy' : IDL.Func([IDL.Nat64], [IDL.Opt(Policy)], ['query']),
    'get_policy_by_holder' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(Policy)],
        ['query'],
      ),
    'get_policy_stats' : IDL.Func(
        [],
        [IDL.Nat64, IDL.Nat64, IDL.Nat64],
        ['query'],
      ),
    'is_payout_eligible' : IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    'mirror_batch_upsert_policies' : IDL.Func(
        [IDL.Vec(MirrorPolicy)],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'mirror_clear_policies' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'mirror_get_policies' : IDL.Func([], [IDL.Vec(MirrorPolicy)], ['query']),
    'mirror_get_policy_stats' : IDL.Func(
        [],
        [IDL.Nat64, IDL.Nat64, IDL.Nat64],
        ['query'],
      ),
    'mirror_upsert_policy' : IDL.Func(
        [MirrorPolicy],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'remove_oracle_updater' : IDL.Func(
        [IDL.Principal],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'set_flood_level' : IDL.Func(
        [IDL.Int64],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'set_flood_threshold' : IDL.Func(
        [IDL.Nat64],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'transfer_admin' : IDL.Func(
        [IDL.Principal],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
    'trigger_payout' : IDL.Func(
        [],
        [IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : IDL.Text })],
        [],
      ),
    'update_policy_status' : IDL.Func(
        [IDL.Nat64, IDL.Bool, IDL.Bool],
        [IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
