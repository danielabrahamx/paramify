const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

// Universal IDL that tries to handle any numeric type
const universalIdl = ({ IDL }) => {
  return IDL.Service({
    'get_flood_level': IDL.Func([], [IDL.Nat64], ['query']),
    'get_flood_threshold': IDL.Func([], [IDL.Nat64], ['query']),
    'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
    'create_policy': IDL.Func([IDL.Nat, IDL.Nat], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
  });
};

async function testUniversal() {
  console.log('🌐 UNIVERSAL COMPATIBILITY TEST');
  console.log('===============================\n');
  
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
    }
    
    const actor = Actor.createActor(universalIdl, { agent, canisterId: CANISTER_ID });
    
    console.log('✅ Connected to canister\n');
    
    // Flexible value display
    const displayValue = (val) => {
      if (typeof val === 'bigint') return val.toString();
      if (typeof val === 'number') return val.toString();
      return JSON.stringify(val);
    };

    console.log('🔍 Testing get_flood_level...');
    const floodLevel = await actor.get_flood_level();
    console.log(`🌊 Flood level: ${displayValue(floodLevel)} (type: ${typeof floodLevel})`);

    console.log('\n🔍 Testing get_flood_threshold...');
    const threshold = await actor.get_flood_threshold();
    console.log(`🚨 Threshold: ${displayValue(threshold)} (type: ${typeof threshold})`);

    console.log('\n🔍 Testing get_policy_stats...');
    const stats = await actor.get_policy_stats();
    console.log(`📋 Stats: Total=${displayValue(stats[0])}, Active=${displayValue(stats[1])}, Paid out=${displayValue(stats[2])}`);

    console.log('\n🔍 Testing create_policy...');
    try {
      const result = await actor.create_policy(100n, 1000n);
      console.log('💵 Policy creation result:', result);
    } catch (error) {
      console.log('❌ Policy creation failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUniversal();
