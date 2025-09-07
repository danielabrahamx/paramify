const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

// Try int64 version first
const idlInt64 = ({ IDL }) => {
  return IDL.Service({
    'get_flood_level': IDL.Func([], [IDL.Int64], ['query']),
    'get_flood_threshold': IDL.Func([], [IDL.Int64], ['query']),
    'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
  });
};

// Try float64 version
const idlFloat64 = ({ IDL }) => {
  return IDL.Service({
    'get_flood_level': IDL.Func([], [IDL.Float64], ['query']),
    'get_flood_threshold': IDL.Func([], [IDL.Float64], ['query']),
    'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
  });
};

async function testTypes() {
  console.log('�� TESTING CANISTER TYPES');
  console.log('==========================\n');
  
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
    }
    
    // Test int64 version
    console.log('�� Testing with Int64 types...');
    try {
      const actorInt64 = Actor.createActor(idlInt64, { agent, canisterId: CANISTER_ID });
      const floodLevel = await actorInt64.get_flood_level();
      const threshold = await actorInt64.get_flood_threshold();
      const stats = await actorInt64.get_policy_stats();
      
      console.log('✅ Int64 version works!');
      console.log(`🌊 Flood level: ${floodLevel} (type: ${typeof floodLevel})`);
      console.log(`🚨 Threshold: ${threshold} (type: ${typeof threshold})`);
      console.log(`📋 Stats: ${stats[0]}, ${stats[1]}, ${stats[2]}\n`);
      
    } catch (error) {
      console.log(`❌ Int64 version failed: ${error.message}\n`);
    }
    
    // Test float64 version
    console.log('�� Testing with Float64 types...');
    try {
      const actorFloat64 = Actor.createActor(idlFloat64, { agent, canisterId: CANISTER_ID });
      const floodLevel = await actorFloat64.get_flood_level();
      const threshold = await actorFloat64.get_flood_threshold();
      const stats = await actorFloat64.get_policy_stats();
      
      console.log('✅ Float64 version works!');
      console.log(`🌊 Flood level: ${floodLevel} (type: ${typeof floodLevel})`);
      console.log(`🚨 Threshold: ${threshold} (type: ${typeof threshold})`);
      console.log(`📋 Stats: ${stats[0]}, ${stats[1]}, ${stats[2]}\n`);
      
    } catch (error) {
      console.log(`❌ Float64 version failed: ${error.message}\n`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTypes();
