import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import fetch from 'node-fetch';
import cron from 'node-cron';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// USGS API configuration
const USGS_URL = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01646500&parameterCd=00065&siteStatus=all';

// Canister interface IDL
const idlFactory = ({ IDL }) => {
  const Policy = IDL.Record({
    policyholder: IDL.Principal,
    premium: IDL.Nat64,
    coverage: IDL.Nat64,
    active: IDL.Bool,
    paid_out: IDL.Bool,
    created_at: IDL.Nat64,
    flood_level_at_creation: IDL.Float64,
  });
  
  const FloodData = IDL.Record({
    level: IDL.Float64,
    threshold: IDL.Float64,
    last_updated: IDL.Nat64,
    station_id: IDL.Text,
  });
  
  const SystemStatus = IDL.Record({
    total_policies: IDL.Nat64,
    active_policies: IDL.Nat64,
    total_payouts: IDL.Nat64,
    contract_balance: IDL.Nat64,
    current_flood_level: IDL.Float64,
    flood_threshold: IDL.Float64,
    last_oracle_update: IDL.Nat64,
  });
  
  const CreatePolicyRequest = IDL.Record({
    coverage_amount: IDL.Nat64,
  });
  
  const PayoutResult = IDL.Record({
    success: IDL.Bool,
    amount: IDL.Nat64,
    message: IDL.Text,
  });
  
  return IDL.Service({
    // Update methods
    create_policy: IDL.Func([CreatePolicyRequest], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    trigger_payout: IDL.Func([], [IDL.Variant({
      Ok: PayoutResult,
      Err: IDL.Text
    })], []),
    set_flood_level: IDL.Func([IDL.Float64, IDL.Opt(IDL.Text)], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    set_threshold: IDL.Func([IDL.Float64], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    add_oracle: IDL.Func([IDL.Principal], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    fund_contract: IDL.Func([IDL.Nat64], [IDL.Variant({
      Ok: IDL.Text,
      Err: IDL.Text
    })], []),
    
    // Query methods
    get_policy: IDL.Func([IDL.Opt(IDL.Principal)], [IDL.Opt(Policy)], ['query']),
    get_flood_data: IDL.Func([], [FloodData], ['query']),
    get_system_status: IDL.Func([], [SystemStatus], ['query']),
    is_payout_eligible: IDL.Func([IDL.Opt(IDL.Principal)], [IDL.Bool], ['query']),
    get_admin: IDL.Func([], [IDL.Principal], ['query']),
    get_oracles: IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
  });
};

// Oracle configuration
class ICPOracle {
  constructor() {
    this.canisterId = process.env.CANISTER_ID_PARAMIFY_INSURANCE || 'rrkah-fqaaa-aaaaa-aaaaq-cai';
    this.host = process.env.ICP_HOST || 'http://localhost:8000';
    this.identity = null;
    this.agent = null;
    this.actor = null;
    this.stationId = process.env.USGS_STATION_ID || '01646500';
    this.lastUpdate = null;
    this.updateCount = 0;
  }
  
  async init() {
    try {
      // Create HTTP agent for local development
      this.agent = new HttpAgent({ 
        host: this.host,
        fetch: fetch
      });
      
      // Fetch root key for local development
      if (this.host.includes('localhost')) {
        await this.agent.fetchRootKey();
      }
      
      // Create actor
      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: this.canisterId,
      });
      
      console.log('✅ ICP Oracle initialized');
      console.log(`📍 Canister ID: ${this.canisterId}`);
      console.log(`🌐 Host: ${this.host}`);
      console.log(`🚰 USGS Station: ${this.stationId}`);
      
      // Get initial status
      await this.getSystemStatus();
      
    } catch (error) {
      console.error('❌ Failed to initialize ICP Oracle:', error);
      throw error;
    }
  }
  
  async fetchUSGSData() {
    try {
      const response = await fetch(USGS_URL);
      if (!response.ok) {
        throw new Error(`USGS API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract water level data
      const timeSeries = data.value?.timeSeries?.[0];
      if (!timeSeries) {
        throw new Error('No time series data available');
      }
      
      const latestValue = timeSeries.values?.[0]?.value?.[0];
      if (!latestValue) {
        throw new Error('No water level value available');
      }
      
      const waterLevel = parseFloat(latestValue.value);
      const timestamp = latestValue.dateTime;
      
      return {
        level: waterLevel,
        timestamp: timestamp,
        stationId: this.stationId,
        stationName: timeSeries.sourceInfo?.siteName || 'Unknown Station'
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch USGS data:', error);
      throw error;
    }
  }
  
  async updateCanisterFloodLevel(floodData) {
    try {
      // Call canister method to update flood level
      const result = await this.actor.set_flood_level(
        floodData.level,
        [floodData.stationId]
      );
      
      if (result.Ok) {
        this.updateCount++;
        this.lastUpdate = new Date();
        
        console.log('✅ Canister updated successfully');
        console.log(`📊 Flood Level: ${floodData.level.toFixed(2)} ft`);
        console.log(`🕐 Timestamp: ${floodData.timestamp}`);
        console.log(`📍 Station: ${floodData.stationName} (${floodData.stationId})`);
        console.log(`📈 Total Updates: ${this.updateCount}`);
        
        return true;
      } else {
        console.error('❌ Canister update failed:', result.Err);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Failed to update canister:', error);
      return false;
    }
  }
  
  async getSystemStatus() {
    try {
      const status = await this.actor.get_system_status();
      
      console.log('\n📊 System Status:');
      console.log(`   Total Policies: ${status.total_policies}`);
      console.log(`   Active Policies: ${status.active_policies}`);
      console.log(`   Total Payouts: ${status.total_payouts}`);
      console.log(`   Contract Balance: ${Number(status.contract_balance) / 100_000_000} ICP`);
      console.log(`   Current Flood Level: ${status.current_flood_level.toFixed(2)} ft`);
      console.log(`   Payout Threshold: ${status.flood_threshold.toFixed(2)} ft`);
      
      // Check if payout conditions are met
      if (status.current_flood_level > status.flood_threshold) {
        console.log('⚠️  WARNING: Flood level exceeds threshold! Payouts may be triggered.');
      }
      
      return status;
      
    } catch (error) {
      console.error('❌ Failed to get system status:', error);
      return null;
    }
  }
  
  async performUpdate() {
    try {
      console.log('\n🔄 Fetching latest USGS data...');
      
      // Fetch USGS data
      const floodData = await this.fetchUSGSData();
      
      // Update canister
      await this.updateCanisterFloodLevel(floodData);
      
      // Get updated system status
      await this.getSystemStatus();
      
    } catch (error) {
      console.error('❌ Update cycle failed:', error);
    }
  }
  
  startScheduledUpdates() {
    // Update every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('\n⏰ Scheduled update starting...');
      await this.performUpdate();
    });
    
    console.log('📅 Scheduled updates enabled (every 5 minutes)');
    
    // Perform initial update
    this.performUpdate();
  }
  
  // Manual update method for testing
  async manualUpdate() {
    console.log('\n🔧 Manual update triggered...');
    await this.performUpdate();
  }
}

// Express server for health checks and manual triggers
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Initialize oracle
const oracle = new ICPOracle();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    canisterId: oracle.canisterId,
    host: oracle.host,
    lastUpdate: oracle.lastUpdate,
    updateCount: oracle.updateCount
  });
});

// Manual update endpoint
app.post('/update', async (req, res) => {
  try {
    await oracle.manualUpdate();
    res.json({ success: true, message: 'Update triggered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current flood data
app.get('/flood-data', async (req, res) => {
  try {
    const data = await oracle.fetchUSGSData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system status
app.get('/status', async (req, res) => {
  try {
    const status = await oracle.getSystemStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server and oracle
async function start() {
  try {
    // Initialize oracle
    await oracle.init();
    
    // Start scheduled updates
    oracle.startScheduledUpdates();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n🚀 ICP Oracle Server running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log(`🔄 Manual update: POST http://localhost:${PORT}/update`);
      console.log(`💧 Current flood data: http://localhost:${PORT}/flood-data`);
      console.log(`📊 System status: http://localhost:${PORT}/status`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start oracle server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down oracle server...');
  process.exit(0);
});

// Start the oracle
start();
