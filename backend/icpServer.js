const { Actor, HttpAgent } = require('@dfinity/agent');
const { Ed25519KeyIdentity } = require('@dfinity/identity');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

const CANISTER_ID = process.env.ICP_CANISTER_ID || 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
const ICP_HOST = process.env.ICP_HOST || 'http://127.0.0.1:4943';

app.use(cors());
app.use(express.json());

let icpActor;

async function initializeICP() {
  try {
    console.log('🚀 Initializing ICP connection...');
    
    const agent = new HttpAgent({
      host: ICP_HOST,
      fetch: require('node-fetch')
    });

    if (ICP_HOST.includes('127.0.0.1') || ICP_HOST.includes('localhost')) {
      await agent.fetchRootKey();
      console.log('🔑 Root key fetched for local development');
    }

    const idl = ({ IDL }) => {
      return IDL.Service({
        'get_flood_level': IDL.Func([], [IDL.Int64], ['query']),
        'set_flood_level': IDL.Func([IDL.Int64], [IDL.Variant({ 'Ok': IDL.Null, 'Err': IDL.Text })], []),
        'get_flood_threshold': IDL.Func([], [IDL.Nat64], ['query']),
        'get_policy_stats': IDL.Func([], [[IDL.Nat64, IDL.Nat64, IDL.Nat64]], ['query']),
      });
    };

    icpActor = Actor.createActor(idl, {
      agent,
      canisterId: CANISTER_ID,
    });

    console.log(`✅ Connected to ICP canister: ${CANISTER_ID}`);
  } catch (error) {
    console.error('❌ Failed to initialize ICP:', error);
    throw error;
  }
}

async function updateCanisterFloodLevel(waterLevel) {
  try {
    if (!icpActor) {
      throw new Error('ICP actor not initialized');
    }

    const scaledLevel = Math.floor(waterLevel * 100000000000);
    console.log(`📊 Updating canister flood level: ${waterLevel} ft (${scaledLevel} scaled)`);
    
    const result = await icpActor.set_flood_level(scaledLevel);
    
    if (result.Ok !== undefined) {
      console.log('✅ Successfully updated canister flood level');
      return { success: true, level: waterLevel };
    } else {
      console.error('❌ Failed to update canister:', result.Err);
      return { success: false, error: result.Err };
    }
  } catch (error) {
    console.error('❌ Error updating canister flood level:', error);
    return { success: false, error: error.message };
  }
}

app.get('/api/icp-status', async (req, res) => {
  try {
    if (!icpActor) {
      return res.status(500).json({ error: 'ICP not initialized' });
    }

    const floodLevel = await icpActor.get_flood_level();
    const threshold = await icpActor.get_flood_threshold();
    const stats = await icpActor.get_policy_stats();

    res.json({
      canisterId: CANISTER_ID,
      floodLevel: Number(floodLevel),
      floodLevelFeet: Number(floodLevel) / 100000000000,
      threshold: Number(threshold),
      thresholdFeet: Number(threshold) / 100000000000,
      policyStats: {
        total: Number(stats[0]),
        active: Number(stats[1]),
        paidOut: Number(stats[2])
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/update-flood-level', async (req, res) => {
  try {
    const { waterLevel } = req.body;
    
    if (typeof waterLevel !== 'number') {
      return res.status(400).json({ error: 'Water level must be a number' });
    }

    const result = await updateCanisterFloodLevel(waterLevel);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  try {
    await initializeICP();
    
    app.listen(PORT, () => {
      console.log(`🚀 ICP Server running on port ${PORT}`);
      console.log(`🔗 Connected to canister: ${CANISTER_ID}`);
      console.log(`📡 ICP status: http://localhost:${PORT}/api/icp-status`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();