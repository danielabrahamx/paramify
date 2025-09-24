const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

async function debugCanister() {
  console.log('🔍 CANISTER DEBUG');
  console.log('==================\n');
  
  try {
    const agent = new HttpAgent({ host: ICP_HOST });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
    }
    
    console.log(`🎯 Canister ID: ${CANISTER_ID}`);
    console.log(`🌐 Host: ${ICP_HOST}\n`);
    
    // Test 1: Try to get the actual Candid interface
    console.log('📋 TEST 1: Get Candid Interface');
    console.log('--------------------------------');
    
    try {
      // This will show us what the canister actually exports
      const response = await fetch(`${ICP_HOST}/api/v2/canister/${CANISTER_ID}/candid`);
      if (response.ok) {
        const candidInterface = await response.text();
        console.log('✅ Candid interface retrieved:');
        console.log(candidInterface);
      } else {
        console.log('❌ Could not retrieve Candid interface');
      }
    } catch (e) {
      console.log('❌ Candid interface fetch failed:', e.message);
    }
    
    console.log('\n📋 TEST 2: Raw dfx call');
    console.log('------------------------');
    console.log('Try running this command manually:');
    console.log(`dfx canister call ${CANISTER_ID} get_policy_stats`);
    console.log('This will show you the raw return value\n');
    
    // Test 3: Try different IDL interpretations
    console.log('📋 TEST 3: Try Single Nat64 Return');
    console.log('-----------------------------------');
    
    const singleIdl = ({ IDL }) => {
      return IDL.Service({
        'get_policy_stats': IDL.Func([], [IDL.Nat64], ['query']),
      });
    };
    
    const singleActor = Actor.createActor(singleIdl, { agent, canisterId: CANISTER_ID });
    
    try {
      const singleResult = await singleActor.get_policy_stats();
      console.log('✅ Single nat64 works! Result:', singleResult);
      console.log('🚨 This confirms your canister is returning a single value, not a tuple!\n');
    } catch (error) {
      console.log('❌ Single nat64 failed:', error.message);
    }
    
    // Test 4: Try tuple interpretation
    console.log('📋 TEST 4: Try Tuple Return');
    console.log('----------------------------');
    
    const tupleIdl = ({ IDL }) => {
      return IDL.Service({
        'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
      });
    };
    
    const tupleActor = Actor.createActor(tupleIdl, { agent, canisterId: CANISTER_ID });
    
    try {
      const tupleResult = await tupleActor.get_policy_stats();
      console.log('✅ Tuple works! Result:', tupleResult);
    } catch (error) {
      console.log('❌ Tuple failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugCanister();