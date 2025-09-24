const { Actor, HttpAgent } = require('@dfinity/agent');
require('dotenv').config();

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

const idl = ({ IDL }) => {
  return IDL.Service({
    'get_flood_level': IDL.Func([], [IDL.Int64], ['query']),
    'get_flood_threshold': IDL.Func([], [IDL.Nat64], ['query']),
    'get_policy_stats': IDL.Func([], [IDL.Nat64, IDL.Nat64, IDL.Nat64], ['query']),
  });
};

async function testBasicConnectivity() {
  console.log('🔍 Testing basic canister connectivity...');
  console.log(`🔗 Canister ID: ${CANISTER_ID}`);
  console.log(`🌐 Host: ${ICP_HOST}`);
  
  try {
    const agent = new HttpAgent({
      host: ICP_HOST,
    });
    
    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      console.log('🔑 Fetching root key for local development...');
      await agent.fetchRootKey();
    }
    
    const actor = Actor.createActor(idl, {
      agent,
      canisterId: CANISTER_ID,
    });
    
    console.log('✅ Actor created successfully');
    
    console.log('\n📊 Testing canister queries...');
    
    const floodLevel = await actor.get_flood_level();
    console.log(`🌊 Current flood level: ${floodLevel} (raw value)`);
    
    const floodLevelFeet = Number(floodLevel) / 100000000000;
    console.log(`🌊 Current flood level: ${floodLevelFeet} feet`);
    
    const threshold = await actor.get_flood_threshold();  
    console.log(`🚨 Flood threshold: ${threshold} (raw value)`);
    
    const thresholdFeet = Number(threshold) / 100000000000;
    console.log(`🚨 Flood threshold: ${thresholdFeet} feet`);
    
    const stats = await actor.get_policy_stats();
    console.log(`📋 Policy stats: Total=${stats[0]}, Active=${stats[1]}, Paid out=${stats[2]}`);
    
    const isFloodCondition = Number(floodLevel) >= Number(threshold);
    console.log(`🚨 Flood condition: ${isFloodCondition ? 'YES - PAYOUT ELIGIBLE' : 'NO - Normal conditions'}`);
    
    console.log('\n🎉 COMPLETE SUCCESS! ��');
    console.log('✅ Your canister is running and responding to queries');
    console.log('✅ Backend can successfully communicate with ICP canister');
    
  } catch (error) {
    console.error('❌ Connectivity test FAILED:', error.message);
  }
}

testBasicConnectivity();
