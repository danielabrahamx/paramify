import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface MirrorPolicy {
  'policyholder_eth' : string,
  'active' : boolean,
  'premium_wei' : bigint,
  'paid_out' : boolean,
  'purchase_time' : bigint,
  'policy_id' : bigint,
  'coverage_wei' : bigint,
}
export interface Policy {
  'active' : boolean,
  'premium' : bigint,
  'paid_out' : boolean,
  'purchase_time' : bigint,
  'coverage' : bigint,
  'policyholder' : Principal,
  'policy_id' : bigint,
}
export interface _SERVICE {
  'add_oracle_updater' : ActorMethod<
    [Principal],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'create_policy' : ActorMethod<
    [bigint, bigint],
    { 'Ok' : bigint } |
      { 'Err' : string }
  >,
  'get_admin' : ActorMethod<[], Principal>,
  'get_all_policies' : ActorMethod<
    [],
    { 'Ok' : Array<Policy> } |
      { 'Err' : string }
  >,
  'get_flood_level' : ActorMethod<[], bigint>,
  'get_flood_threshold' : ActorMethod<[], bigint>,
  'get_oracle_updaters' : ActorMethod<
    [],
    { 'Ok' : Array<Principal> } |
      { 'Err' : string }
  >,
  'get_policy' : ActorMethod<[bigint], [] | [Policy]>,
  'get_policy_by_holder' : ActorMethod<[Principal], [] | [Policy]>,
  'get_policy_stats' : ActorMethod<[], [bigint, bigint, bigint]>,
  'health_check' : ActorMethod<[], [boolean, string, bigint, bigint, bigint]>,
  'is_payout_eligible' : ActorMethod<[Principal], boolean>,
  'mirror_batch_upsert_policies' : ActorMethod<
    [Array<MirrorPolicy>],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'mirror_clear_policies' : ActorMethod<
    [],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'mirror_get_policies' : ActorMethod<[], Array<MirrorPolicy>>,
  'mirror_get_policy_stats' : ActorMethod<[], [bigint, bigint, bigint]>,
  'mirror_upsert_policy' : ActorMethod<
    [MirrorPolicy],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'remove_oracle_updater' : ActorMethod<
    [Principal],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'set_flood_level' : ActorMethod<
    [bigint],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'set_flood_threshold' : ActorMethod<
    [bigint],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'transfer_admin' : ActorMethod<
    [Principal],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
  'trigger_payout' : ActorMethod<[], { 'Ok' : bigint } | { 'Err' : string }>,
  'update_policy_status' : ActorMethod<
    [bigint, boolean, boolean],
    { 'Ok' : null } |
      { 'Err' : string }
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
