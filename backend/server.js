const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Contract addresses and ABIs
const PARAMIFY_ADDRESS = process.env.PARAMIFY_ADDRESS;
const MOCK_ORACLE_ADDRESS = process.env.MOCK_ORACLE_ADDRESS;

// Paramify ABI (power outage insurance functions)
const PARAMIFY_ABI = [
  {
    "inputs": [],
    "name": "getLatestOutageDuration",
    "outputs": [
      {
        "internalType": "int256",
        "name": "",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "triggerPayout",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getContractBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Mock Oracle ABI (only the functions we need)
const MOCK_ORACLE_ABI = [
  {
    "inputs": [
      {
        "internalType": "int256",
        "name": "_answer",
        "type": "int256"
      }
    ],
    "name": "updateAnswer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "latestAnswer",
    "outputs": [
      {
        "internalType": "int256",
        "name": "",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Mock outage data storage
let mockOutageData = {
  outageDuration: 0,
  timestamp: null,
  lastUpdate: null,
  status: 'ready',
  error: null,
  source: 'Mock Outage API'
};

// Middleware
app.use(cors());
app.use(express.json());

// Global variables to store latest data
let latestOutageData = {
  outageDuration: 0,
  timestamp: null,
  lastUpdate: null,
  status: 'ready',
  error: null,
  source: 'Mock Outage API'
};

// Initialize Ethereum provider and signer
let provider;
let signer;
let mockOracleContract;
let paramifyContract;

async function initializeEthers() {
  try {
    // Connect to local Hardhat node with timeout
    provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // Test connection with timeout
    const network = await Promise.race([
      provider.getNetwork(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
    ]);
    
    // Use the first Hardhat account (admin account)
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    signer = new ethers.Wallet(privateKey, provider);
    
    // Initialize contract instances
    mockOracleContract = new ethers.Contract(MOCK_ORACLE_ADDRESS, MOCK_ORACLE_ABI, signer);
    paramifyContract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);
    
    console.log('✅ Ethereum provider initialized');
    console.log('Connected to:', await signer.getAddress());
    console.log('Network:', network.name, 'Chain ID:', network.chainId.toString());
  } catch (error) {
    console.warn('⚠️  Could not connect to blockchain immediately:', error.message);
    console.log('📡 Backend will continue running for outage data fetching');
    console.log('🔄 Blockchain connection will be retried when needed');
    latestOutageData.status = 'partial';
    latestOutageData.error = 'Blockchain connection pending';
  }
}

// Function to handle mock outage data
function handleMockOutageData(outageDuration) {
  console.log('⚡ Processing outage duration:', outageDuration, 'seconds');

  // Update global data
  latestOutageData = {
    outageDuration: outageDuration,
    timestamp: new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    status: 'active',
    error: null,
    source: 'Mock Outage API'
  };

  return outageDuration;
}

// Function to update the oracle contract with outage duration
async function updateOracleContract(outageDuration) {
  try {
    // Check if we have a valid contract connection
    if (!mockOracleContract || !signer) {
      console.log('🔄 Attempting to reconnect to blockchain...');
      await initializeEthers();

      if (!mockOracleContract) {
        throw new Error('Could not establish blockchain connection');
      }
    }

    // Use outage duration directly (no scaling needed for seconds)
    const outageValue = Math.floor(outageDuration);

    console.log(`🔄 Updating oracle with outage duration: ${outageValue} seconds`);

    // Get current gas price
    const gasPrice = await provider.getFeeData();

    // Update the oracle
    const tx = await mockOracleContract.updateAnswer(outageValue, {
      gasPrice: gasPrice.gasPrice
    });

    console.log(`📝 Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Oracle updated successfully! Block: ${receipt.blockNumber}`);

    // Verify the update
    const newValue = await mockOracleContract.latestAnswer();
    console.log(`🔍 Verified oracle value: ${newValue.toString()}`);

    return receipt;
  } catch (error) {
    console.error('❌ Error updating oracle:', error.message);
    // Don't throw the error - let the system continue with just outage data
    latestOutageData.error = `Oracle update failed: ${error.message}`;
    return null;
  }
}

// Main update function for outage data
async function updateOutageData(outageDuration) {
  try {
    console.log('\n⚡ Starting outage data update...');

    // Process mock outage data
    const duration = handleMockOutageData(outageDuration);

    // Try to update the oracle contract (non-blocking)
    const receipt = await updateOracleContract(duration);

    if (receipt) {
      console.log('✅ Outage data update completed successfully!\n');
      latestOutageData.status = 'active';
      latestOutageData.error = null;
    } else {
      console.log('⚠️  Outage data updated, but oracle update failed\n');
      latestOutageData.status = 'partial';
    }
  } catch (error) {
    console.error('❌ Failed to update outage data:', error.message);
    latestOutageData.status = 'error';
    latestOutageData.error = error.message;
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Paramify backend service is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/outage-data', async (req, res) => {
  try {
    res.json({
      ...latestOutageData
    });
  } catch (error) {
    res.json(latestOutageData);
  }
});

// Outage API endpoint for stopwatch integration
app.post('/api/outage', async (req, res) => {
  try {
    const { outageDuration } = req.body;

    // Validate input
    if (typeof outageDuration !== 'number' || outageDuration < 0) {
      return res.status(400).json({ error: 'Invalid outage duration. Must be a non-negative number.' });
    }

    console.log(`⚡ Received outage duration: ${outageDuration} seconds`);

    // Update outage data and oracle
    await updateOutageData(outageDuration);

    res.json({
      success: true,
      message: 'Outage data updated successfully',
      outageDuration: outageDuration,
      data: latestOutageData
    });
  } catch (error) {
    console.error('Error processing outage data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/manual-update', async (req, res) => {
  try {
    const { outageDuration = 0 } = req.body;
    console.log('📌 Manual outage update requested with duration:', outageDuration);
    await updateOutageData(outageDuration);
    res.json({
      success: true,
      message: 'Outage data updated successfully',
      data: latestOutageData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    // Get current oracle value
    let oracleValue = null;

    if (mockOracleContract) {
      const rawValue = await mockOracleContract.latestAnswer();
      oracleValue = Number(rawValue); // Oracle now stores outage duration in seconds
    }

    res.json({
      service: 'active',
      lastUpdate: latestOutageData.lastUpdate,
      currentOutageDuration: latestOutageData.outageDuration,
      oracleValue: oracleValue,
      dataSource: latestOutageData.source,
      updateInterval: 'on-demand',
      nextUpdate: null // No scheduled updates for outage data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
async function startServer() {
  try {
    // Start Express server first
    app.listen(PORT, () => {
      console.log(`🚀 Paramify backend server running on port ${PORT}`);
      console.log(`⚡ API endpoints available:`);
      console.log(`   - GET  /api/health`);
      console.log(`   - GET  /api/outage-data`);
      console.log(`   - GET  /api/status`);
      console.log(`   - POST /api/outage`);
      console.log(`   - POST /api/manual-update`);
    });
    
    // Initialize Ethereum connection (non-blocking)
    await initializeEthers();

    // Note: No initial data fetch or scheduled updates for outage data
    // Outage data is updated on-demand via API calls from the frontend stopwatch

    console.log(`⚡ Outage API ready for on-demand updates`);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    // Don't exit - let the server run even if blockchain connection fails
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Start the application
startServer();
