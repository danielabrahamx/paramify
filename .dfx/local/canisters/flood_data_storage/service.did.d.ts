import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type Error = { 'NotFound' : null } |
  { 'InvalidData' : null } |
  { 'Unauthorized' : null };
export interface FloodData {
  'level' : number,
  'stationId' : string,
  'timestamp' : bigint,
}
export type Result = { 'ok' : null } |
  { 'err' : Error };
export type Result_1 = { 'ok' : FloodData } |
  { 'err' : Error };
export interface _SERVICE {
  'clearData' : ActorMethod<[], undefined>,
  'getAllFloodData' : ActorMethod<[], Array<[string, FloodData]>>,
  'getFloodData' : ActorMethod<[string], Result_1>,
  'setAdmin' : ActorMethod<[Principal], undefined>,
  'storeFloodData' : ActorMethod<[string, number], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
