const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

// Use the EXACT same IDL as the working test-canister-final.js
const idl = ({ IDL }) => {
  return IDL.Service({
    'get_flood_level': IDL.Func([], [IDL.Float64], ['query']),
    'get_flood_threshold': IDL.Func([], [IDL.Float64], ['query']),
    'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
    'create_policy': IDL.Func([IDL.Nat, IDL.Nat], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
  });
};

async function testInsuranceWorking() {
  console.log('🏦 WORKING INSURANCE TEST');
  console.log('==========================\n');
  
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
    }
    
    const actor = Actor.createActor(idl, { agent, canisterId: CANISTER_ID });
    
    console.log('✅ Connected to canister successfully\n');
    
    // Test 1: Basic functions (same as working test)
    console.log('📊 STEP 1: Basic Functions');
    console.log('--------------------------');
    
    const floodLevel = await actor.get_flood_level();
    const threshold = await actor.get_flood_threshold();
    const stats = await actor.get_policy_stats();
    
    console.log(`🌊 Current flood level: ${floodLevel} feet`);
    console.log(`🚨 Flood threshold: ${threshold} feet`);
    console.log(`📋 Policy stats: Total=${stats[0]}, Active=${stats[1]}, Paid out=${stats[2]}\n`);
    
    // Test 2: Create insurance policy
    console.log('💰 STEP 2: Creating Insurance Policy');
    console.log('------------------------------------');
    
    try {
      const result = await actor.create_policy(100, 1000);
      console.log('✅ create_policy result:', result);
      
      if (result.Ok) {
        console.log(`🎉 Policy created successfully! ID: ${result.Ok}`);
        
        // Check updated stats
        const newStats = await actor.get_policy_stats();
        console.log(`📋 Updated stats: Total=${newStats[0]}, Active=${newStats[1]}, Paid out=${newStats[2]}`);
      } else {
        console.log(`❌ Policy creation failed: ${result.Err}`);
      }
    } catch (error) {
      console.log(`❌ create_policy error: ${error.message}`);
    }
    
    console.log('\n🎉 INSURANCE TEST COMPLETE!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInsuranceWorking();
