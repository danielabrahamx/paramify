const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

// Simplified IDL for basic insurance testing (using correct types from working test)
const idl = ({ IDL }) => {
  return IDL.Service({
    'create_policy': IDL.Func([IDL.Nat, IDL.Nat], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
    'get_policy': IDL.Func([IDL.Nat64], [IDL.Opt(IDL.Record({
      policy_id: IDL.Nat64,
      policyholder: IDL.Principal,
      premium: IDL.Nat,
      coverage: IDL.Nat,
      purchase_time: IDL.Nat64,
      active: IDL.Bool,
      paid_out: IDL.Bool
    }))], ['query']),
    'get_policy_stats': IDL.Func([], [IDL.Tuple(IDL.Nat64, IDL.Nat64, IDL.Nat64)], ['query']),
    'get_flood_level': IDL.Func([], [IDL.Int64], ['query']),
    'get_flood_threshold': IDL.Func([], [IDL.Nat64], ['query']),
    'is_payout_eligible': IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
  });
};

async function testBasicInsurance() {
  console.log('🏦 BASIC INSURANCE TEST');
  console.log('========================\n');
  
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
    }
    
    const actor = Actor.createActor(idl, { agent, canisterId: CANISTER_ID });
    
    // Check initial state
    console.log('�� Initial State:');
    const stats = await actor.get_policy_stats();
    const floodLevel = await actor.get_flood_level();
    const threshold = await actor.get_flood_threshold();
    
    console.log(`   Policies: Total=${stats[0]}, Active=${stats[1]}, Paid out=${stats[2]}`);
    console.log(`   Flood level: ${floodLevel} (raw value)`);
    console.log(`   Flood level: ${Number(floodLevel) / 100000000000} feet`);
    console.log(`   Threshold: ${threshold} (raw value)`);
    console.log(`   Threshold: ${Number(threshold) / 100000000000} feet\n`);
    
    // Create a policy (1000 ICP coverage, 100 ICP premium)
    console.log('💰 Creating Policy:');
    console.log('   Coverage: 1000 ICP tokens');
    console.log('   Premium: 100 ICP tokens');
    
    const result = await actor.create_policy(100, 1000);
    
    if (result.Ok) {
      const policyId = result.Ok;
      console.log(`   ✅ Policy created! ID: ${policyId}\n`);
      
      // Check the policy
      const policy = await actor.get_policy(policyId);
      if (policy.Some) {
        const p = policy.Some;
        console.log('📋 Policy Details:');
        console.log(`   ID: ${p.policy_id}`);
        console.log(`   Premium: ${p.premium} tokens`);
        console.log(`   Coverage: ${p.coverage} tokens`);
        console.log(`   Active: ${p.active}`);
        console.log(`   Paid out: ${p.paid_out}\n`);
        
        // Check payout eligibility
        const eligible = await actor.is_payout_eligible(p.policyholder);
        console.log(`🎯 Payout eligible: ${eligible ? 'YES' : 'NO'}\n`);
      }
      
      // Check updated stats
      const newStats = await actor.get_policy_stats();
      console.log('�� Updated Stats:');
      console.log(`   Total: ${newStats[0]}, Active: ${newStats[1]}, Paid out: ${newStats[2]}`);
      
    } else {
      console.log(`   ❌ Failed: ${result.Err}\n`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBasicInsurance();
