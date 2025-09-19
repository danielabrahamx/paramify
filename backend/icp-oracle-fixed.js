import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import fetch from 'node-fetch';
import cron from 'node-cron';
import dotenv from 'dotenv';
import winston from 'winston';
import { Ed25519KeyIdentity } from '@dfinity/identity';

// Load environment variables
dotenv.config();

// Configure logger
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
const USGS_SECONDARY_URL = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01647000&parameterCd=00065&siteStatus=all';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 1000; // milliseconds
const DATA_STALENESS_THRESHOLD = 3600000; // 1 hour in milliseconds
const ANOMALY_THRESHOLD = 10; // feet
const UPDATE_INTERVAL = '*/5 * * * *'; // Every 5 minutes

// Canister interface IDL
const idlFactory = ({ IDL }) => {
  const Policy = IDL.Record({
    policy_id: IDL.Nat64,
    policyholder: IDL.Principal,
    premium: IDL.Nat,
    coverage: IDL.Nat,
    purchase_time: IDL.Nat64,
    active: IDL.Bool,
    paid_out: IDL.Bool,
    expiration_time: IDL.Nat64,
  });
  
  return IDL.Service({
    // Update methods
    set_flood_level: IDL.Func([IDL.Int64], [IDL.Variant({
      Ok: IDL.Null,
      Err: IDL.Text
    })], []),
    
    // Query methods
    get_flood_level: IDL.Func([], [IDL.Int64], ['query']),
    get_flood_threshold: IDL.Func([], [IDL.Nat64], ['query']),
    get_policy_stats: IDL.Func([], [IDL.Tuple(IDL.Nat64, IDL.Nat64, IDL.Nat64)], ['query']),
    health_check: IDL.Func([], [IDL.Tuple(IDL.Bool, IDL.Text, IDL.Nat64, IDL.Int64, IDL.Nat64)], ['query']),
  });
};

// Enhanced Oracle Class with Security and Reliability Features
class SecureICPOracle {
  constructor() {
    this.canisterId = process.env.CANISTER_ID_PARAMIFY_INSURANCE;
    this.host = process.env.ICP_HOST || 'http://localhost:8000';
    this.identity = null;
    this.agent = null;
    this.actor = null;
    this.primaryStationId = process.env.USGS_PRIMARY_STATION || '01646500';
    this.secondaryStationId = process.env.USGS_SECONDARY_STATION || '01647000';
    this.lastKnownLevel = null;
    this.lastUpdateTime = null;
    this.updateHistory = [];
    this.failureCount = 0;
    this.maxConsecutiveFailures = 5;
    this.isHealthy = true;
  }

  // Initialize the oracle with proper identity
  async initialize() {
    try {
      if (!this.canisterId) {
        throw new Error('CANISTER_ID_PARAMIFY_INSURANCE not configured');
      }

      // Create identity from seed phrase or private key
      if (process.env.ORACLE_SEED_PHRASE) {
        // In production, use proper key management
        const seed = Buffer.from(process.env.ORACLE_SEED_PHRASE, 'hex');
        this.identity = Ed25519KeyIdentity.fromSeed(seed);
      } else {
        // For development, use anonymous identity
        logger.warn('Using anonymous identity - not suitable for production');
        this.identity = null;
      }

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

      // Perform initial health check
      await this.performHealthCheck();

      logger.info('Oracle initialized successfully', {
        canisterId: this.canisterId,
        host: this.host,
        principal: this.identity ? this.identity.getPrincipal().toText() : 'anonymous'
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize oracle:', error);
      throw error;
    }
  }

  // Fetch flood data from USGS with validation
  async fetchUSGSData(stationId, isPrimary = true) {
    const url = isPrimary ? USGS_PRIMARY_URL : USGS_SECONDARY_URL;
    
    try {
      logger.info(`Fetching data from ${isPrimary ? 'primary' : 'secondary'} station: ${stationId}`);
      
      const response = await fetch(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Paramify-Oracle/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract flood level from USGS response
      const timeSeries = data.value?.timeSeries?.[0];
      if (!timeSeries) {
        throw new Error('No time series data found');
      }

      const values = timeSeries.values?.[0]?.value;
      if (!values || values.length === 0) {
        throw new Error('No values found in time series');
      }

      const latestValue = values[values.length - 1];
      
      return {
        value: parseFloat(latestValue.value),
        timestamp: new Date(latestValue.dateTime).toISOString(),
        stationId: stationId,
        qualifiers: latestValue.qualifiers || []
      };
    } catch (error) {
      logger.error(`Failed to fetch from ${isPrimary ? 'primary' : 'secondary'} station:`, {
        error: error.message,
        stationId
      });
      throw error;
    }
  }

  // Validate flood data integrity
  validateFloodData(data) {
    try {
      if (!data || typeof data !== 'object') {
        logger.warn('Invalid data structure');
        return false;
      }

      // Check data freshness
      const dataTime = new Date(data.timestamp);
      const now = new Date();
      const age = now.getTime() - dataTime.getTime();

      if (age > DATA_STALENESS_THRESHOLD) {
        logger.warn('Data is stale', {
          dataTime: dataTime.toISOString(),
          age: `${age / 1000} seconds`
        });
        return false;
      }

      // Validate flood level range (0 to 100 feet)
      const level = data.value;
      if (isNaN(level) || level < 0 || level > 100) {
        logger.warn('Invalid flood level', { level });
        return false;
      }

      // Check for data quality indicators
      if (data.qualifiers && data.qualifiers.includes('e')) {
        logger.warn('Data has estimated qualifier', { qualifiers: data.qualifiers });
        // Don't reject, but log for review
      }

      // Check for anomalies
      if (this.lastKnownLevel !== null) {
        const change = Math.abs(level - this.lastKnownLevel);
        if (change > ANOMALY_THRESHOLD) {
          logger.warn('Anomalous flood level change detected', {
            previousLevel: this.lastKnownLevel,
            currentLevel: level,
            change: `${change} feet`
          });
          
          // For large changes, require confirmation from secondary source
          return 'requires_confirmation';
        }
      }

      return true;
    } catch (error) {
      logger.error('Error validating flood data:', error);
      return false;
    }
  }

  // Fetch flood level with failover
  async fetchFloodLevel() {
    try {
      // Try primary data source
      let primaryData = null;
      try {
        primaryData = await this.fetchUSGSData(this.primaryStationId, true);
      } catch (error) {
        logger.warn('Primary station failed, attempting secondary');
      }

      // Validate primary data
      if (primaryData) {
        const validation = this.validateFloodData(primaryData);
        
        if (validation === true) {
          return primaryData;
        } else if (validation === 'requires_confirmation') {
          // Get secondary confirmation for large changes
          try {
            const secondaryData = await this.fetchUSGSData(this.secondaryStationId, false);
            if (this.validateFloodData(secondaryData) === true) {
              // Compare both sources
              const diff = Math.abs(primaryData.value - secondaryData.value);
              if (diff < 5) { // Accept if sources agree within 5 feet
                logger.info('Large change confirmed by secondary source');
                return primaryData;
              } else {
                logger.warn('Sources disagree on large change, using average', {
                  primary: primaryData.value,
                  secondary: secondaryData.value
                });
                primaryData.value = (primaryData.value + secondaryData.value) / 2;
                return primaryData;
              }
            }
          } catch (error) {
            logger.warn('Secondary confirmation failed, rejecting large change');
            throw new Error('Cannot confirm large flood level change');
          }
        }
      }

      // Fallback to secondary source
      const secondaryData = await this.fetchUSGSData(this.secondaryStationId, false);
      const validation = this.validateFloodData(secondaryData);
      
      if (validation === true || validation === 'requires_confirmation') {
        logger.info('Using secondary data source');
        return secondaryData;
      }

      throw new Error('All data sources failed validation');
    } catch (error) {
      logger.error('Failed to fetch flood level:', error);
      throw error;
    }
  }

  // Update canister with retry logic
  async updateCanisterWithRetry(floodLevel) {
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // Convert to scaled units (multiply by 100000000000)
        const scaledLevel = BigInt(Math.floor(floodLevel * 100000000000));
        
        logger.info(`Attempt ${attempt}: Updating canister with flood level`, {
          feet: floodLevel,
          scaled: scaledLevel.toString()
        });

        const result = await this.actor.set_flood_level(scaledLevel);
        
        if ('Ok' in result) {
          logger.info('Successfully updated flood level', {
            level: floodLevel,
            attempt
          });
          
          // Update tracking
          this.lastKnownLevel = floodLevel;
          this.lastUpdateTime = new Date();
          this.updateHistory.push({
            level: floodLevel,
            timestamp: this.lastUpdateTime,
            attempts: attempt
          });
          
          // Keep only last 100 updates
          if (this.updateHistory.length > 100) {
            this.updateHistory.shift();
          }
          
          this.failureCount = 0;
          return true;
        } else {
          logger.error(`Canister rejected update:`, { error: result.Err, attempt });
        }
      } catch (error) {
        logger.error(`Update attempt ${attempt} failed:`, error);
      }
      
      // Exponential backoff
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        logger.info(`Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    this.failureCount++;
    
    // Check for circuit breaker
    if (this.failureCount >= this.maxConsecutiveFailures) {
      this.isHealthy = false;
      logger.error('Oracle circuit breaker triggered - too many consecutive failures');
    }
    
    throw new Error(`Failed to update canister after ${MAX_RETRY_ATTEMPTS} attempts`);
  }

  // Perform system health check
  async performHealthCheck() {
    try {
      if (!this.actor) {
        throw new Error('Actor not initialized');
      }

      const [healthy, version, cycles, floodLevel, threshold] = await this.actor.health_check();
      
      logger.info('Health check completed', {
        healthy,
        version,
        cycles: cycles.toString(),
        floodLevel: Number(floodLevel) / 100000000000,
        threshold: Number(threshold) / 100000000000
      });

      // Check if cycles are low
      if (Number(cycles) < 1_000_000_000) {
        logger.warn('Canister cycles are low', { cycles: cycles.toString() });
      }

      return {
        healthy,
        version,
        cycles: Number(cycles),
        floodLevel: Number(floodLevel) / 100000000000,
        threshold: Number(threshold) / 100000000000
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }

  // Main update cycle
  async performUpdate() {
    try {
      // Check circuit breaker
      if (!this.isHealthy) {
        logger.warn('Oracle is unhealthy, skipping update');
        
        // Try to recover after some failures
        if (this.failureCount > 0 && this.failureCount % 10 === 0) {
          logger.info('Attempting to recover oracle health');
          this.isHealthy = true;
        } else {
          return;
        }
      }

      logger.info('Starting oracle update cycle');
      
      // Fetch flood data
      const floodData = await this.fetchFloodLevel();
      
      // Update canister
      await this.updateCanisterWithRetry(floodData.value);
      
      // Log statistics
      const stats = await this.actor.get_policy_stats();
      logger.info('Update cycle completed', {
        floodLevel: floodData.value,
        totalPolicies: Number(stats[0]),
        activePolicies: Number(stats[1]),
        paidOutPolicies: Number(stats[2])
      });
    } catch (error) {
      logger.error('Update cycle failed:', error);
      
      // Send alert for critical failures
      if (this.failureCount >= this.maxConsecutiveFailures) {
        await this.sendAlert('Oracle service is down', error.message);
      }
    }
  }

  // Send alerts (implement based on your notification system)
  async sendAlert(subject, message) {
    // Implement email, SMS, or other alerting mechanism
    logger.error(`ALERT: ${subject} - ${message}`);
    
    // Example: Could integrate with services like SendGrid, Twilio, PagerDuty
    if (process.env.ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject,
            message,
            timestamp: new Date().toISOString(),
            service: 'paramify-oracle'
          })
        });
      } catch (error) {
        logger.error('Failed to send alert:', error);
      }
    }
  }

  // Start the oracle service
  async start() {
    try {
      await this.initialize();
      
      // Perform initial update
      await this.performUpdate();
      
      // Schedule regular updates
      const job = cron.schedule(UPDATE_INTERVAL, async () => {
        await this.performUpdate();
      });
      
      logger.info(`Oracle started with update interval: ${UPDATE_INTERVAL}`);
      
      // Graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully');
        job.stop();
        process.exit(0);
      });
      
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully');
        job.stop();
        process.exit(0);
      });
    } catch (error) {
      logger.error('Failed to start oracle:', error);
      process.exit(1);
    }
  }

  // Get oracle status
  getStatus() {
    return {
      healthy: this.isHealthy,
      lastUpdateTime: this.lastUpdateTime,
      lastKnownLevel: this.lastKnownLevel,
      failureCount: this.failureCount,
      updateHistory: this.updateHistory.slice(-10), // Last 10 updates
      canisterId: this.canisterId
    };
  }
}

// Create and start oracle instance
const oracle = new SecureICPOracle();

// Start the oracle
oracle.start().catch(error => {
  logger.error('Fatal error starting oracle:', error);
  process.exit(1);
});

// Export for testing
export default SecureICPOracle;