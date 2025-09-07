# USGS Real-Time Flood Data Integration Guide

## Overview

This guide documents the automatic real-time flood level data integration from the USGS (United States Geological Survey) water monitoring system into the Paramify flood insurance application.

## System Architecture

### Components

1. **Backend Service** (`backend/server.js`)
   - Node.js/Express server running on port 3001
   - Fetches USGS data every 5 minutes
   - Updates the smart contract oracle automatically
   - Provides REST API for frontend

2. **Frontend Integration**
   - Admin Dashboard shows real-time USGS data status
   - Customer Dashboard displays live flood levels
   - Auto-refreshes every 10 seconds

3. **Smart Contract Integration**
   - Mock Oracle contract receives automatic updates
   - Flood levels converted from feet to units (1 ft = 1000 units)

## USGS Data Source

- **Monitoring Location**: 01646500 (POTOMAC RIVER NEAR WASH, DC LITTLE FALLS PUMP STA)
- **Parameter**: Gage height (water level in feet)
- **API Endpoint**: USGS Instantaneous Values REST Web Service
- **Update Frequency**: Every 5 minutes

## Installation & Setup

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Configure Environment

The backend uses environment variables configured in `backend/.env`:

```env
# Backend Server Configuration
PORT=3001

# Ethereum Configuration
RPC_URL=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PARAMIFY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
MOCK_ORACLE_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

# USGS Configuration
USGS_SITE_ID=01646500
USGS_PARAMETER_CODE=00065

# Update Interval (in minutes)
UPDATE_INTERVAL=5
```

### 3. Start the Services

1. **Start Hardhat Node** (if not already running):
   ```bash
   npx hardhat node
   ```

2. **Deploy Contracts** (if not already deployed):
   ```bash
   npx hardhat run scripts/deployMock.js --network localhost
   ```

3. **Start Backend Service**:
   ```bash
   cd backend
   npm start
   ```

4. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

## Features

### Automatic Data Updates
- Backend fetches USGS data every 5 minutes
- Automatically updates the oracle contract
- No manual intervention required

### Real-Time Status Display
- Live connection status indicator
- Current water level in feet and units
- Next update countdown timer
- Data source information
- Last update timestamp

### Manual Update Option
- Admin dashboard includes "Manual Update" button
- Triggers immediate USGS data fetch
- Useful for testing or urgent updates

### Error Handling
- Graceful handling of USGS API downtime
- Fallback to last known values
- Clear error messages in UI
- Automatic retry mechanism

## API Endpoints

### Backend REST API

1. **GET /api/flood-data**
   - Returns current USGS flood data
   - Response format:
   ```json
   {
     "value": 3.45,
     "timestamp": "2024-06-25T10:30:00.000Z",
     "status": "success",
     "source": "USGS API",
     "siteInfo": {
       "name": "POTOMAC RIVER NEAR WASH, DC",
       "siteId": "01646500"
     }
   }
   ```

2. **GET /api/status**
   - Returns service status and oracle information
   - Response format:
   ```json
   {
     "service": "USGS Flood Data Service",
     "lastUpdate": "2024-06-25T10:30:00.000Z",
     "currentFloodLevel": 3.45,
     "oracleValue": 3.45,
     "dataSource": "USGS Water Services",
     "updateInterval": "5 minutes",
     "nextUpdate": "2024-06-25T10:35:00.000Z"
   }
   ```

3. **POST /api/manual-update**
   - Triggers immediate USGS data fetch
   - Admin-only endpoint

4. **GET /api/health**
   - Health check endpoint
   - Returns service status

## Data Flow

1. **USGS API → Backend Service**
   - Fetch current water level data
   - Parse XML response
   - Extract gage height value

2. **Backend Service → Oracle Contract**
   - Convert feet to contract units (×1000)
   - Convert to 8 decimal format
   - Update oracle answer

3. **Oracle Contract → Paramify Contract**
   - Paramify reads latest price from oracle
   - Uses for insurance calculations

4. **Backend Service → Frontend**
   - REST API provides current data
   - WebSocket updates (future enhancement)

## Testing the Integration

### 1. Verify USGS Data Fetch
```bash
# Check backend logs
# Should see: "Fetching USGS data..."
# And: "USGS data fetched successfully"
```

### 2. Check Oracle Updates
- Open Admin Dashboard
- Observe "USGS Real-Time Data" section
- Verify water level matches USGS website

### 3. Test Manual Update
- Click "Manual Update" button
- Check console for update confirmation
- Verify new data appears

### 4. Monitor Automatic Updates
- Watch "Next Update In" countdown
- Verify updates occur every 5 minutes
- Check oracle value changes

## Troubleshooting

### Backend Not Connecting
1. Ensure Hardhat node is running
2. Check contract addresses in .env
3. Verify private key is correct

### USGS Data Not Updating
1. Check internet connection
2. Verify USGS API is accessible
3. Check backend console for errors
4. Try manual update button

### Frontend Not Showing Data
1. Ensure backend is running on port 3001
2. Check browser console for errors
3. Verify CORS is enabled

## Production Considerations

### Security
- Use environment variables for sensitive data
- Implement rate limiting for API endpoints
- Add authentication for admin endpoints
- Use HTTPS in production

### Reliability
- Implement database for data persistence
- Add backup data sources
- Use process manager (PM2) for backend
- Set up monitoring and alerts

### Scalability
- Consider caching USGS responses
- Implement WebSocket for real-time updates
- Use message queue for oracle updates
- Add load balancing for multiple instances

## Future Enhancements

1. **Multiple Data Sources**
   - Add NOAA data integration
   - Support multiple monitoring stations
   - Aggregate data from multiple sources

2. **Advanced Features**
   - Historical data tracking
   - Flood prediction algorithms
   - Alert system for threshold breaches
   - Mobile app notifications

3. **Blockchain Improvements**
   - Decentralized oracle network
   - Multiple oracle providers
   - On-chain data validation
   - Chainlink integration

## Support

For issues or questions:
1. Check backend logs for errors
2. Verify all services are running
3. Ensure correct network configuration
4. Review this documentation

## License

This integration is part of the Paramify project and follows the same license terms.
