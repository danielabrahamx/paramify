const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai'; // Using the new canister ID from deployment
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

// Perfectly matched IDL based on Rust implementation
const idl = ({ IDL }) => {
  return IDL.Service({
    'get_flood_level': IDL.Func([], [IDL.Int64], ['query']), // Matches Rust's i64
    'get_flood_threshold': IDL.Func([], [IDL.Nat64], ['query']), // Matches Rust's u64
    'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
    'create_policy': IDL.Func([IDL.Nat, IDL.Nat], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
    'set_flood_level': IDL.Func([IDL.Int64], [], []), // Matches Rust's i64 parameter
    'set_flood_threshold': IDL.Func([IDL.Nat64], [], []) // Matches Rust's u64 parameter
  });
};

async function testPerfectMatch() {
  console.log('🎯 PERFECT MATCH TEST');
  console.log('=====================\n');
  
  const agent = new HttpAgent({ host: ICP_HOST });
  await agent.fetchRootKey();

  const actor = Actor.createActor(idl, { agent, canisterId: CANISTER_ID });

  try {
    // Test flood level (i64)
    console.log('🌊 Testing get_flood_level (i64)...');
    const floodLevel = await actor.get_flood_level();
    console.log(`✅ Success! Flood level: ${floodLevel}`);

    // Test flood threshold (u64)
    console.log('\n🚨 Testing get_flood_threshold (Nat64)...');
    const threshold = await actor.get_flood_threshold();
    console.log(`✅ Success! Threshold: ${threshold}`);

    // Test policy stats
    console.log('\n📋 Testing get_policy_stats...');
    const stats = await actor.get_policy_stats();
    console.log(`✅ Success! Stats: Total=${stats[0]}, Active=${stats[1]}, Paid=${stats[2]}`);

    // Test policy creation
    console.log('\n💰 Testing create_policy...');
    const result = await actor.create_policy(100n, 1000n);
    if ('Ok' in result) {
      console.log(`✅ Policy created! ID: ${result.Ok}`);
    } else {
      console.log(`❌ Error: ${result.Err}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 TROUBLESHOOTING TIPS:');
    console.log('1. Verify canister ID in .env matches:', CANISTER_ID);
    console.log('2. Ensure dfx replica is running (dfx start)');
    console.log('3. Check Rust implementation for any recent changes');
  }
}

testPerfectMatch();
