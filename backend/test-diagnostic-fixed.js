const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

async function testDiagnostic() {
  console.log(' CANISTER DIAGNOSTIC (FIXED)');
  console.log('================================\n');
  
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
    }
    
    console.log(\ Canister ID: \\);
    console.log(\ Host: \\n\);
    
    // Test 1: Basic functions (FIXED IDL)
    console.log(' TEST 1: Basic Functions (FIXED)');
    console.log('----------------------------------');
    
    const basicIdl = ({ IDL }) => {
      return IDL.Service({
        'get_flood_level': IDL.Func([], [IDL.Float64], ['query']),
        'get_flood_threshold': IDL.Func([], [IDL.Float64], ['query']),
        // FIXED: Not IDL.Tuple  just list outputs
        'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
      });
    };
    
    const basicActor = Actor.createActor(basicIdl, { agent, canisterId: CANISTER_ID });
    
    try {
      const floodLevel = await basicActor.get_flood_level();
      const threshold = await basicActor.get_flood_threshold();
      const stats = await basicActor.get_policy_stats();
      
      console.log(' Basic functions work!');
      console.log(\   Flood level: \ feet\);
      console.log(\   Threshold: \ feet\);
      console.log(\   Stats: Total=\, Active=\, Paid out=\\n\);
    } catch (error) {
      console.log(\ Basic functions failed: \\n\);
    }
    
    // Test 2: Try create_policy function
    console.log(' TEST 2: create_policy Function');
    console.log('---------------------------------');
    
    const createPolicyIdl = ({ IDL }) => {
      return IDL.Service({
        'create_policy': IDL.Func([IDL.Nat, IDL.Nat], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
      });
    };
    
    const createPolicyActor = Actor.createActor(createPolicyIdl, { agent, canisterId: CANISTER_ID });
    
    try {
      const result = await createPolicyActor.create_policy(100, 1000);
      console.log(' create_policy function works!');
      console.log(\   Result: \\);
    } catch (error) {
      console.log(\ create_policy failed: \\);
    }
    
    // Test 3: Try to set flood level
    console.log('\n TEST 3: Setting Flood Level');
    console.log('-------------------------------');
    
    const floodIdl = ({ IDL }) => {
      return IDL.Service({
        'set_flood_level': IDL.Func([IDL.Float64], [IDL.Variant({ Ok: IDL.Null, Err: IDL.Text })], []),
        'get_flood_level': IDL.Func([], [IDL.Float64], ['query']),
      });
    };
    
    const floodActor = Actor.createActor(floodIdl, { agent, canisterId: CANISTER_ID });
    
    try {
      // Set flood level to 5.0 feet
      const setResult = await floodActor.set_flood_level(5.0);
      console.log(' set_flood_level result:', setResult);
      
      // Check the new level
      const newLevel = await floodActor.get_flood_level();
      console.log(\   New flood level: \ feet\);
    } catch (error) {
      console.log(\ set_flood_level failed: \\);
    }
    
    console.log('\n DIAGNOSTIC COMPLETE!');
    
  } catch (error) {
    console.error(' Diagnostic failed:', error.message);
  }
}

testDiagnostic();
