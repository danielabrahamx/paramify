const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = 3001;

// USGS API endpoint for Potomac River at Washington, DC
const USGS_URL = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01646500&parameterCd=00065&siteStatus=all";

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Fetch real USGS data
async function fetchUSGSData() {
  try {
    console.log("�� Fetching real USGS data...");
    const response = await fetch(USGS_URL);
    const data = await response.json();
    
    if (data.value && data.value.timeSeries && data.value.timeSeries[0]) {
      const timeSeries = data.value.timeSeries[0];
      const values = timeSeries.values[0];
      
      if (values && values.length > 0) {
        const latestValue = values[values.length - 1];
        const floodLevel = parseFloat(latestValue.value);
        const timestamp = latestValue.dateTime;
        
        console.log(`✅ USGS Data: ${floodLevel} ft at ${timestamp}`);
        return {
          level: floodLevel,
          timestamp: timestamp,
          stationId: "01646500",
          stationName: "POTOMAC RIVER NEAR WASH, DC LITTLE FALLS PUMP STA"
        };
      }
    }
    
    throw new Error("No valid data in USGS response");
  } catch (error) {
    console.error("❌ USGS fetch error:", error.message);
    throw error;
  }
}

// Get flood data
app.get("/flood-data", async (req, res) => {
  try {
    const data = await fetchUSGSData();
    res.json(data);
  } catch (error) {
    console.error("❌ Failed to fetch flood data:", error.message);
    res.status(500).json({ error: "Failed to fetch USGS data" });
  }
});

// Get service status
app.get("/status", async (req, res) => {
  try {
    const data = await fetchUSGSData();
    res.json({
      currentFloodLevel: data.level,
      oracleValue: data.level,
      threshold: {
        thresholdFeet: 12.0,
        thresholdUnits: 12.0 * 100000000000
      },
      lastUpdate: data.timestamp,
      nextUpdate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      site: {
        name: data.stationName,
        siteId: data.stationId
      }
    });
  } catch (error) {
    console.error("❌ Failed to get status:", error.message);
    res.status(500).json({ error: "Failed to fetch USGS data" });
  }
});

// Update threshold
app.post("/api/threshold", (req, res) => {
  const { thresholdFeet } = req.body;
  if (thresholdFeet && thresholdFeet > 0 && thresholdFeet <= 100) {
    res.json({
      success: true,
      thresholdFeet: thresholdFeet,
      thresholdUnits: thresholdFeet * 100000000000
    });
  } else {
    res.status(400).json({ success: false, error: "Invalid threshold" });
  }
});

// Trigger update
app.post("/update", async (req, res) => {
  try {
    const data = await fetchUSGSData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 USGS Real Data Server running on port ${PORT}`);
  console.log(`🌐 Endpoints:`);
  console.log(`   📊 Flood data: http://localhost:${PORT}/flood-data`);
  console.log(`   📈 Status: http://localhost:${PORT}/status`);
  console.log(`   ❤️  Health: http://localhost:${PORT}/health`);
  console.log(`   🔄 Update: POST http://localhost:${PORT}/update`);
});
