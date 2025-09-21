import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface CachedData { 'data' : FloodData, 'cached_at' : bigint }
export interface FloodData {
  'water_level_feet' : number,
  'source' : string,
  'site_name' : string,
  'timestamp' : bigint,
  'location' : string,
}
export interface HttpResponse {
  'status' : bigint,
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
}
export interface InitArgs {
  'update_interval_seconds' : [] | [bigint],
  'authorized_principals' : [] | [Array<Principal>],
}
export interface OracleConfig {
  'update_interval_seconds' : bigint,
  'authorized_principals' : Array<Principal>,
  'is_paused' : boolean,
  'max_retries' : number,
  'usgs_base_url' : string,
}
export interface OracleStatus {
  'last_error' : [] | [string],
  'total_updates' : bigint,
  'last_update_time' : [] | [bigint],
  'update_interval_seconds' : bigint,
  'cached_locations' : Array<string>,
  'is_paused' : boolean,
}
export interface TransformArgs {
  'context' : Uint8Array | number[],
  'response' : HttpResponse,
}
export interface _SERVICE {
  'add_authorized_principal' : ActorMethod<
    [Principal],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'batch_update' : ActorMethod<
    [Array<string>],
    Array<[string, { 'Ok' : FloodData } | { 'Err' : string }]>
  >,
  'clear_cache' : ActorMethod<[], { 'Ok' : string } | { 'Err' : string }>,
  'get_all_cached_locations' : ActorMethod<[], Array<string>>,
  'get_cached_data' : ActorMethod<[string], [] | [CachedData]>,
  'get_configuration' : ActorMethod<[], OracleConfig>,
  'get_latest_data' : ActorMethod<
    [string],
    { 'Ok' : FloodData } |
      { 'Err' : string }
  >,
  'get_status' : ActorMethod<[], OracleStatus>,
  'manual_update' : ActorMethod<
    [string],
    { 'Ok' : FloodData } |
      { 'Err' : string }
  >,
  'remove_authorized_principal' : ActorMethod<
    [Principal],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
  'set_paused' : ActorMethod<[boolean], { 'Ok' : string } | { 'Err' : string }>,
  'transform_usgs_response' : ActorMethod<[TransformArgs], HttpResponse>,
  'update_configuration' : ActorMethod<
    [OracleConfig],
    { 'Ok' : string } |
      { 'Err' : string }
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
