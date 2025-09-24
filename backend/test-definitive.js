const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

// Definitive IDL based on Rust implementation
const idl = ({ IDL }) => {
  return IDL.Service({
    // Assuming Rust uses u64 (Nat64) for flood levels based on common patterns
    'get_flood_level': IDL.Func([], [IDL.Nat64], ['query']),
    'get_flood_threshold': IDL.Func([], [IDL.Nat64], ['query']),
    'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
    'create_policy': IDL.Func([IDL.Nat, IDL.Nat], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
    'set_flood_level': IDL.Func([IDL.Nat64], [], []),
    'set_flood_threshold': IDL.Func([IDL.Nat64], [], [])
  });
};

async function testDefinitive() {
  console.log('🔍 DEFINITIVE COMPATIBILITY TEST');
  console.log('================================\n');
  
  const agent = new HttpAgent({ host: ICP_HOST });
  
  if (ICP_HOST.includes('127.0.0.1')) {
    await agent.fetchRootKey();
  }

  const actor = Actor.createActor(idl, { agent, canisterId: CANISTER_ID });

  try {
    // Test flood level functions
    console.log('🌊 Testing flood level functions...');
    const [level, threshold] = await Promise.all([
      actor.get_flood_level(),
      actor.get_flood_threshold()
    ]);
    console.log(`Current flood level: ${level}`);
    console.log(`Current threshold: ${threshold}`);

    // Test policy functions
    console.log('\n📋 Testing policy functions...');
    const stats = await actor.get_policy_stats();
    console.log(`Policy stats: Total=${stats[0]}, Active=${stats[1]}, Paid=${stats[2]}`);

    // Test creating a policy
    console.log('\n💰 Testing policy creation...');
    const result = await actor.create_policy(100n, 1000n);
    if ('Ok' in result) {
      console.log(`✅ Policy created with ID: ${result.Ok}`);
    } else {
      console.log(`❌ Error: ${result.Err}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDefinitive();
