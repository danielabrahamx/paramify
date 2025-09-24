import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import fetch from 'node-fetch';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { readFileSync } from 'fs';
import winston from 'winston';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'oracle-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'oracle.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Constants
const USGS_PRIMARY_URL = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01646500&parameterCd=00065&siteStatus=all';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000; // milliseconds
const DATA_STALENESS_THRESHOLD = 3600000; // 1 hour in milliseconds
const ANOMALY_THRESHOLD = 10; // feet
const UPDATE_INTERVAL = '*/5 * * * *'; // Every 5 minutes

// Canister interface IDL for Insurance Canister
const idlFactory = ({ IDL }) => {
  const Policy = IDL.Record({
    policy_id: IDL.Nat64,
    holder: IDL.Principal,
    premium: IDL.Nat64,
    payout_amount: IDL.Nat64,
    created_at: IDL.Nat64,
    expires_at: IDL.Nat64,
    is_active: IDL.Bool,
  });

  const EventType = IDL.Variant({
    PolicyCreated: IDL.Null,
    PayoutProcessed: IDL.Null,
    FloodLevelUpdated: IDL.Null,
    AnomalyDetected: IDL.Null,
    AdminActionPerformed: IDL.Null,
  });

  const Event = IDL.Record({
    event_type: EventType,
    timestamp: IDL.Nat64,
    principal: IDL.Principal,
    details: IDL.Text,
  });

  return IDL.Service({
    add_oracle_updater: IDL.Func([IDL.Principal], [IDL.Variant({ Ok: IDL.Null, Err: IDL.Text })], []),
    create_policy: IDL.Func([IDL.Nat64, IDL.Nat64, IDL.Nat64], [IDL.Variant({ Ok: IDL.Nat64, Err: IDL.Text })], []),
    get_events: IDL.Func([], [IDL.Vec(Event)], ['query']),
    get_flood_level: IDL.Func([], [IDL.Int64], ['query']),
    get_policies: IDL.Func([], [IDL.Vec(Policy)], ['query']),
    get_policy: IDL.Func([IDL.Nat64], [IDL.Opt(Policy)], ['query']),
    process_payouts: IDL.Func([], [IDL.Variant({ Ok: IDL.Vec(IDL.Nat64), Err: IDL.Text })], []),
    set_flood_level: IDL.Func([IDL.Int64], [IDL.Variant({ Ok: IDL.Null, Err: IDL.Text })], []),
  });
};

class SecureICPOracle {
  constructor() {
    this.canisterId = process.env.CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';
    this.host = process.env.DFX_NETWORK === 'ic' ? 'https://ic0.app' : 'http://127.0.0.1:4943';
    this.identity = null;
    this.agent = null;
    this.actor = null;
    this.primaryStationId = process.env.USGS_PRIMARY_STATION || '01646500';
    this.lastKnownLevel = null;
    this.lastUpdateTime = null;
    this.updateHistory = [];
    this.failureCount = 0;
    this.maxConsecutiveFailures = 5;
    this.isHealthy = true;
  }

  async initialize() {
    try {
      logger.info('Initializing oracle...');

      // Load identity from seed phrase
      const seedPhrase = process.env.ORACLE_SEED_PHRASE;
      if (!seedPhrase) {
        throw new Error('ORACLE_SEED_PHRASE not found in environment variables');
      }

      // Convert seed phrase to seed bytes
      const seed = new TextEncoder().encode(seedPhrase);
      this.identity = Ed25519KeyIdentity.fromSecretKey(seed.slice(0, 32));

      // Create HTTP agent
      this.agent = new HttpAgent({
        host: this.host,
        identity: this.identity,
      });

      // Fetch root key in development
      if (process.env.NODE_ENV !== 'production') {
        await this.agent.fetchRootKey();
      }

      // Create actor
      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: this.canisterId,
      });

      logger.info('Oracle initialized successfully', {
        canisterId: this.canisterId,
        host: this.host,
        principal: this.identity.getPrincipal().toText()
      });

      // Perform health check
      await this.healthCheck();

    } catch (error) {
      logger.error('Failed to initialize oracle:', error);
      throw error;
    }
  }

  async fetchUSGSData(stationId) {
    try {
      logger.info(`Fetching data from station: ${stationId}`);
      
      const response = await fetch(USGS_PRIMARY_URL, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Paramify-Oracle/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.value || !data.value.timeSeries || data.value.timeSeries.length === 0) {
        throw new Error('No time series data found');
      }

      const timeSeries = data.value.timeSeries[0];
      if (!timeSeries.values || timeSeries.values.length === 0) {
        throw new Error('No measurement values found');
      }

      const values = timeSeries.values[0].value;
      if (!values || values.length === 0) {
        throw new Error('No current readings available');
      }

      // Get most recent reading
      const latestReading = values[values.length - 1];
      const gageHeight = parseFloat(latestReading.value);
      const timestamp = new Date(latestReading.dateTime);

      // Check data staleness
      const now = new Date();
      const ageInMs = now - timestamp;
      if (ageInMs > DATA_STALENESS_THRESHOLD) {
        logger.warn('Data is stale', {
          age: `${(ageInMs / 1000).toFixed(3)} seconds`,
          dataTime: timestamp.toISOString()
        });
      }

      return {
        value: gageHeight,
        timestamp: timestamp,
        stationId: stationId,
        qualityCode: latestReading.qualifiers || 'A'
      };

    } catch (error) {
      logger.error(`Failed to fetch from station:`, {
        error: error.message,
        stationId: stationId
      });
      throw error;
    }
  }

  // Validate flood data
  validateFloodData(data) {
    if (!data || typeof data.value !== 'number' || isNaN(data.value)) {
      return false;
    }

    // Basic range validation (0-50 feet is reasonable for gage height)
    if (data.value < 0 || data.value > 50) {
      logger.warn('Data value out of expected range', { value: data.value });
      return false;
    }

    // Check for anomalous changes
    if (this.lastKnownLevel !== null) {
      const change = Math.abs(data.value - this.lastKnownLevel);
      if (change > ANOMALY_THRESHOLD) {
        logger.warn('Large flood level change detected', {
          previous: this.lastKnownLevel,
          current: data.value,
          change: change
        });
        return 'requires_confirmation';
      }
    }

    return true;
  }

  // Fetch flood level from primary station only
  async fetchFloodLevel() {
    try {
      // Only use primary data source (01646500)
      const primaryData = await this.fetchUSGSData(this.primaryStationId);
      
      // Validate primary data
      const validation = this.validateFloodData(primaryData);
      
      if (validation === true || validation === 'requires_confirmation') {
        return primaryData;
      }

      throw new Error('Primary data source failed validation');
    } catch (error) {
      logger.error('Failed to fetch flood level:', error);
      throw error;
    }
  }

  // Update canister with retry logic
  async updateCanisterWithRetry(floodLevel) {
    const scaledLevel = BigInt(Math.floor(floodLevel * 100000000)); // Scale to preserve 8 decimal places
    
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        logger.info(`Attempting to update canister (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`, {
          floodLevel: floodLevel,
          scaledLevel: scaledLevel.toString()
        });

        const result = await this.actor.set_flood_level(scaledLevel);
        
        if ('Ok' in result) {
          logger.info('Successfully updated canister flood level', {
            attempt: attempt,
            floodLevel: floodLevel,
            scaledLevel: scaledLevel.toString()
          });
          return result;
        } else {
          throw new Error(`Canister returned error: ${result.Err}`);
        }

      } catch (error) {
        logger.error(`Update attempt ${attempt} failed:`, {
          error: error.message,
          floodLevel: floodLevel,
          scaledLevel: scaledLevel.toString(),
          stack: error.stack
        });

        if (attempt === MAX_RETRY_ATTEMPTS) {
          throw new Error(`Failed to update canister after ${MAX_RETRY_ATTEMPTS} attempts`);
        }

        // Exponential backoff
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        logger.info(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Simple status check using get_flood_level
  async healthCheck() {
    try {
      const floodLevel = await this.actor.get_flood_level();
      
      logger.info('Health check completed', {
        current_flood_level: Number(floodLevel) / 100000000,
        oracle_healthy: true
      });

      return {
        healthy: true,
        current_flood_level: Number(floodLevel) / 100000000,
        last_known_level: this.lastKnownLevel
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }

  // Get current flood level from canister
  async getCurrentFloodLevel() {
    try {
      const result = await this.actor.get_flood_level();
      return Number(result) / 100000000; // Convert back from scaled units
    } catch (error) {
      logger.error('Failed to get current flood level:', error);
      throw error;
    }
  }

  // Performance update cycle
  async performUpdate() {
    try {
      const floodData = await this.fetchFloodLevel();
      
      if (!floodData) {
        throw new Error('No flood data available');
      }

      await this.updateCanisterWithRetry(floodData.value);
      
      // Update tracking
      this.lastKnownLevel = floodData.value;
      this.lastUpdateTime = new Date();
      this.failureCount = 0;
      this.isHealthy = true;
      
      // Add to history (keep last 10 updates)
      this.updateHistory.push({
        timestamp: this.lastUpdateTime,
        level: this.lastKnownLevel,
        success: true
      });
      
      if (this.updateHistory.length > 10) {
        this.updateHistory.shift();
      }
      
      logger.info('Update cycle completed successfully', {
        floodLevel: this.lastKnownLevel,
        timestamp: this.lastUpdateTime.toISOString()
      });

    } catch (error) {
      this.failureCount++;
      this.isHealthy = this.failureCount < this.maxConsecutiveFailures;
      
      logger.error('Update cycle failed:', {
        error: error.message,
        failureCount: this.failureCount,
        isHealthy: this.isHealthy,
        stack: error.stack
      });

      // Add failure to history
      this.updateHistory.push({
        timestamp: new Date(),
        level: null,
        success: false,
        error: error.message
      });
      
      if (this.updateHistory.length > 10) {
        this.updateHistory.shift();
      }

      throw error;
    }
  }

  // Start oracle with scheduled updates
  async start() {
    try {
      await this.initialize();
      
      logger.info('Starting oracle update cycle');
      
      // Perform initial update
      await this.performUpdate();
      
      // Schedule regular updates
      cron.schedule(UPDATE_INTERVAL, async () => {
        if (this.isHealthy) {
          await this.performUpdate();
        } else {
          logger.warn('Oracle unhealthy, skipping update cycle');
        }
      });

      logger.info('Oracle started with update interval:', UPDATE_INTERVAL);

    } catch (error) {
      logger.error('Failed to start oracle:', error);
      throw error;
    }
  }

  // Get oracle status
  getStatus() {
    return {
      isHealthy: this.isHealthy,
      lastKnownLevel: this.lastKnownLevel,
      lastUpdateTime: this.lastUpdateTime,
      failureCount: this.failureCount,
      updateHistory: this.updateHistory
    };
  }
}

// Create and start oracle instance
const oracle = new SecureICPOracle();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the oracle
oracle.start().catch((error) => {
  logger.error('Oracle startup failed:', error);
  process.exit(1);
});