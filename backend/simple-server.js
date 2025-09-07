const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const USGS_SITE_ID = '01646500';
const USGS_PARAMETER_CODE = '00065';
const USGS_API_URL = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${USGS_SITE_ID}&parameterCd=${USGS_PARAMETER_CODE}&siteStatus=all`;

app.use(cors());
app.use(express.json());

let latestFloodData = {
  value: null,
  timestamp: null,
  lastUpdate: null,
  status: 'initializing'
};

async function fetchUSGSData() {
  try {
    console.log('🌊 Fetching USGS water level data...');
    const response = await axios.get(USGS_API_URL);
    const data = response.data;
    
    if (!data.value?.timeSeries?.[0]?.values?.[0]?.value?.[0]) {
      throw new Error('Invalid USGS data structure');
    }
    
    const timeSeries = data.value.timeSeries[0];
    const latestValue = timeSeries.values[0].value[0];
    
    const waterLevelFeet = parseFloat(latestValue.value);
    const timestamp = latestValue.dateTime;
    
    console.log(`📊 Latest water level: ${waterLevelFeet} ft at ${timestamp}`);
    
    const FLOOD_THRESHOLD = 10.0;
    const isFloodCondition = waterLevelFeet > FLOOD_THRESHOLD;
    
    latestFloodData = {
      value: waterLevelFeet,
      timestamp: timestamp,
      lastUpdate: new Date().toISOString(),
      status: 'active',
      isFloodCondition: isFloodCondition,
      threshold: FLOOD_THRESHOLD
    };
    
    if (isFloodCondition) {
      console.log(`🚨 FLOOD ALERT! Water level ${waterLevelFeet}ft exceeds threshold ${FLOOD_THRESHOLD}ft`);
    } else {
      console.log(`✅ Normal conditions: ${waterLevelFeet}ft below threshold ${FLOOD_THRESHOLD}ft`);
    }
    
    return waterLevelFeet;
  } catch (error) {
    console.error('❌ Error fetching USGS data:', error.message);
    latestFloodData.status = 'error';
    latestFloodData.error = error.message;
    throw error;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Paramify backend service is running',
    canisterId: process.env.ICP_CANISTER_ID || 'not-configured',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/flood-data', (req, res) => {
  res.json(latestFloodData);
});

app.get('/api/test-usgs', async (req, res) => {
  try {
    const waterLevel = await fetchUSGSData();
    res.json({ 
      success: true, 
      waterLevel,
      data: latestFloodData 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log(`🚀 Paramify Backend running on port ${PORT}`);
      console.log(`🔗 ICP Canister: ${process.env.ICP_CANISTER_ID || 'not-configured'}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🌊 USGS test: http://localhost:${PORT}/api/test-usgs`);
    });
    
    console.log('\n🔄 Initial USGS data fetch...');
    await fetchUSGSData();
    
    cron.schedule('*/5 * * * *', async () => {
      console.log('\n⏰ Scheduled flood data update...');
      try {
        await fetchUSGSData();
      } catch (error) {
        console.error('⏰ Scheduled update failed:', error.message);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
  }
}

startServer();
