const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

// Correct IDL based on diagnostic results
const idl = ({ IDL }) => {
  return IDL.Service({
    'get_flood_level': IDL.Func([], [IDL.Int64], ['query']),
    'get_flood_threshold': IDL.Func([], [IDL.Int64], ['query']),
    'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
    'create_policy': IDL.Func([IDL.Nat, IDL.Nat], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
  });
};

async function testInsurance() {
  console.log('🏦 CORRECTED INSURANCE TEST');
  console.log('==========================\n');
  
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
    }
    
    const actor = Actor.createActor(idl, { agent, canisterId: CANISTER_ID });
    
    console.log('✅ Connected to canister successfully\n');
    
    // Test basic functions
    console.log('📊 Basic Functions');
    console.log('------------------');
    const floodLevel = await actor.get_flood_level();
    const threshold = await actor.get_flood_threshold();
    const stats = await actor.get_policy_stats();
    
    console.log(`🌊 Flood level: ${floodLevel} (type: ${typeof floodLevel})`);
    console.log(`🚨 Threshold: ${threshold} (type: ${typeof threshold})`);
    console.log(`📋 Stats: Total=${stats[0]}, Active=${stats[1]}, Paid out=${stats[2]}\n`);
    
    // Test policy creation
    console.log('💰 Creating Policy');
    console.log('------------------');
    const result = await actor.create_policy(100n, 1000n); // Using BigInt literals
    console.log('Result:', result);
    
    if (result.Ok) {
      console.log(`🎉 Policy created! ID: ${result.Ok}`);
      const newStats = await actor.get_policy_stats();
      console.log(`📋 Updated stats: Total=${newStats[0]}, Active=${newStats[1]}, Paid out=${newStats[2]}`);
    } else {
      console.log(`❌ Error: ${result.Err}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInsurance();
