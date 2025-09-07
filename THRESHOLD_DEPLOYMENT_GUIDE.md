# Paramify Threshold Management - Deployment Guide

## Overview
This guide covers the deployment and testing of the new threshold management system for Paramify flood insurance protocol. The system now uses a dynamic 12-foot flood threshold (adjustable by admin) instead of hardcoded values.

## Key Changes Implemented

### 1. Smart Contract Updates (contracts/Paramify.sol)
- Added `uint256 public floodThreshold = 1200000000000;` (12 feet default)
- Added `setThreshold()` function with owner-only access control
- Added `ThresholdChanged` event for audit trail
- Updated payout logic to use dynamic threshold

### 2. Backend API Updates (backend/server.js)
- Added `GET /api/threshold` - returns current threshold in feet and units
- Added `POST /api/threshold` - updates threshold (admin only)
- Integrated threshold data in `/api/status` response
- Added proper error handling and validation

### 3. Frontend Updates
- **Admin Dashboard**: Added threshold management UI, removed manual flood input
- **Customer Dashboard**: Displays current threshold, uses it for payout conditions
- Both dashboards show live USGS data with proper unit conversions

## Deployment Steps

### Step 1: Backup Current System
```bash
# Create backup directory
mkdir backup-$(date +%Y%m%d)

# Copy current contract addresses and configurations
cp backend/.env backup-$(date +%Y%m%d)/
cp frontend/src/lib/contract.ts backup-$(date +%Y%m%d)/
```

### Step 2: Deploy Updated Smart Contract
```bash
# Make sure Hardhat node is running
npx hardhat node

# In a new terminal, deploy the contract
npx hardhat run scripts/deploy.js --network localhost
```

**IMPORTANT**: Note the new Paramify contract address from the deployment output.

### Step 3: Update Contract Addresses

#### Update backend/.env:
```env
PARAMIFY_ADDRESS=<NEW_CONTRACT_ADDRESS>
MOCK_ORACLE_ADDRESS=<EXISTING_ORACLE_ADDRESS>
PRIVATE_KEY=<EXISTING_PRIVATE_KEY>
```

#### Update frontend/src/lib/contract.ts:
```typescript
export const PARAMIFY_ADDRESS = '<NEW_CONTRACT_ADDRESS>';
// Keep existing MOCK_ORACLE_ADDRESS unchanged
```

### Step 4: Restart Services

```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend (if not already running)
cd frontend
npm run dev
```

### Step 5: Fund the Contract
Access the admin dashboard and fund the contract with ETH for insurance payouts.

## Testing Procedures

### Test 1: Verify Default Threshold
1. Open Admin Dashboard (http://localhost:8080)
2. Check "Threshold Management" section shows 12.0 feet (1200000000000 units)
3. Open Customer Dashboard in another browser
4. Verify same threshold is displayed

### Test 2: Update Threshold
1. In Admin Dashboard, set threshold to 5 feet
2. Click "Update Threshold"
3. Verify success message
4. Check both dashboards show updated threshold (5.0 feet = 500000000000 units)

### Test 3: Test Payout Trigger
1. Current USGS reading should be ~4.26 feet
2. Set threshold to 4 feet (below current level)
3. Verify "THRESHOLD EXCEEDED" warning appears
4. Buy insurance policy on customer dashboard
5. Verify "Claim Insurance Payout" button appears
6. Click to trigger payout
7. Verify payout is processed successfully

### Test 4: Reset to Production
1. Set threshold back to 12 feet
2. Verify payout conditions no longer met
3. System ready for production use

## Mathematical Verification

### Scaling Formula
```
Contract Units = Feet × 100,000,000,000

Examples:
- 4.26 ft = 426,000,000,000 units
- 12 ft = 1,200,000,000,000 units
```

### Backend Conversion (server.js)
```javascript
// Feet to units
const thresholdUnits = Math.floor(thresholdFeet * 100000000000);

// USGS data scaling
const scaledValue = Math.floor(waterLevel * 100000000000);
```

## Troubleshooting

### Issue: Contract not found
- Ensure you updated both backend/.env and frontend contract.ts with new address
- Restart both backend and frontend services

### Issue: Threshold update fails
- Check wallet is connected as admin (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266)
- Ensure backend is running and connected to blockchain

### Issue: USGS data not updating
- Verify backend is running: `cd backend && npm start`
- Check console for any API errors
- Manual update available in admin dashboard

### Issue: Payout not triggering
- Verify flood level exceeds threshold
- Ensure user has active insurance policy
- Check contract has sufficient balance

## Security Considerations

1. **Access Control**: Only contract owner can modify threshold
2. **Input Validation**: 
   - Threshold must be positive
   - Maximum threshold: 100 feet (10000000000000 units)
3. **Event Logging**: All threshold changes emit events for audit trail
4. **No Breaking Changes**: Existing policies remain unaffected

## API Reference

### GET /api/threshold
```json
{
  "thresholdFeet": 12,
  "thresholdUnits": "1200000000000"
}
```

### POST /api/threshold
Request:
```json
{
  "thresholdFeet": 8.5
}
```

Response:
```json
{
  "success": true,
  "thresholdFeet": 8.5,
  "thresholdUnits": "850000000000",
  "transactionHash": "0x..."
}
```

## Rollback Procedure

If issues occur:
1. Stop all services
2. Restore original contract addresses from backup
3. Redeploy previous contract version if needed
4. Restart services
5. Verify system functionality

## Success Criteria Checklist

- [ ] Smart contract deployed successfully
- [ ] Contract addresses updated in all config files
- [ ] Backend API endpoints responding correctly
- [ ] Admin can view and update threshold
- [ ] Customer dashboard shows current threshold
- [ ] Threshold changes immediately affect payout conditions
- [ ] USGS data continues updating every 5 minutes
- [ ] Manual flood input completely removed from UI
- [ ] Events emitted for all threshold changes
- [ ] Only admin can modify threshold
- [ ] Existing insurance policies work correctly
- [ ] Payouts trigger automatically when threshold exceeded

## Production Ready
Once all tests pass and checklist items are verified, the system is ready for production use with dynamic threshold management fully operational.
