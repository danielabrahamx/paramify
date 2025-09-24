const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

async function testDiagnostic() {
  console.log('🔍 CANISTER DIAGNOSTIC');
  console.log('======================\n');
  
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
    }
    
    console.log(`�� Canister ID: ${CANISTER_ID}`);
    console.log(`�� Host: ${ICP_HOST}\n`);
    
    // Test 1: Basic functions (we know these work)
    console.log('📊 TEST 1: Basic Functions');
    console.log('--------------------------');
    
    const basicIdl = ({ IDL }) => {
      return IDL.Service({
        'get_flood_level': IDL.Func([], [IDL.Int64], ['query']),
        'get_flood_threshold': IDL.Func([], [IDL.Nat64], ['query']),
        'get_policy_stats': IDL.Func([], [IDL.Tuple(IDL.Nat64, IDL.Nat64, IDL.Nat64)], ['query']),
      });
    };
    
    const basicActor = Actor.createActor(basicIdl, { agent, canisterId: CANISTER_ID });
    
    try {
      const floodLevel = await basicActor.get_flood_level();
      const threshold = await basicActor.get_flood_threshold();
      const stats = await basicActor.get_policy_stats();
      
      console.log('✅ Basic functions work!');
      console.log(`   Flood level: ${Number(floodLevel) / 100000000000} feet`);
      console.log(`   Threshold: ${Number(threshold) / 100000000000} feet`);
      console.log(`   Stats: Total=${stats[0]}, Active=${stats[1]}, Paid out=${stats[2]}\n`);
    } catch (error) {
      console.log(`❌ Basic functions failed: ${error.message}\n`);
    }
    
    // Test 2: Try create_policy function
    console.log('📊 TEST 2: create_policy Function');
    console.log('---------------------------------');
    
    const createPolicyIdl = ({ IDL }) => {
      return IDL.Service({
        'create_policy': IDL.Func([IDL.Nat, IDL.Nat], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
      });
    };
    
    const createPolicyActor = Actor.createActor(createPolicyIdl, { agent, canisterId: CANISTER_ID });
    
    try {
      const result = await createPolicyActor.create_policy(100, 1000);
      console.log('✅ create_policy function works!');
      console.log(`   Result: ${JSON.stringify(result)}`);
    } catch (error) {
      console.log(`❌ create_policy failed: ${error.message}`);
    }
    
    console.log('\n🎉 DIAGNOSTIC COMPLETE!');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  }
}

testDiagnostic();
