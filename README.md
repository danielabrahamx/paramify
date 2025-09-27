# Paramify: Decentralized Power Outage Insurance 🚀

![alt text](image.png)

## 🏆 **FULLY WORKING - READY FOR DEMO!**

**Paramify** is a complete decentralized power outage insurance platform built for the European Defense Hackathon. This production-ready system demonstrates real automated insurance purchases and payouts with dynamic timing via an integrated stopwatch system.

## ✨ **Live Demo Features**
- 🎯 **Real ETH Payouts**: Actual cryptocurrency transfers to your wallet
- ⏱️ **Dynamic Timing**: Your stopwatch determines payout amounts  
- 💰 **Flexible Rates**: Set any insurance rate (0.1-100+ ETH/minute)
- 🔄 **Instant Claims**: Receive payouts immediately after outages
- 📱 **Professional UI**: Clean, intuitive interface with real-time calculations
- 🔐 **Multi-Account Testing**: Multiple scenarios with different policy rates

### How It Works
1. **Buy Insurance**: Set your desired payout rate per minute (e.g., 4 ETH/minute)
2. **Pay Premium**: Premium = rate × 2 (e.g., 8 ETH for 4 ETH/minute rate)
3. **Use Stopwatch**: Simulate power outages with built-in timer
4. **Claim Payout**: Receive `(seconds ÷ 60) × rate` ETH instantly
5. **Get Paid**: ETH goes directly to your MetaMask wallet

### Example Scenarios
- **30 seconds** at 4 ETH/min → **2 ETH payout**
- **60 seconds** at 4 ETH/min → **4 ETH payout**  
- **90 seconds** at 4 ETH/min → **6 ETH payout**


## Prerequisites

- **Node.js**: Version 18.x or 23.x (tested with 23.9.0).
- **MetaMask**: Browser extension for wallet interactions.
- **Git**: To clone the repository.
- **Hardhat**: For contract deployment and testing.
- **Python 3** (optional): For alternative frontend serving if `http-server` is unavailable.


## Quick Start: Choose Your Environment

This project can be run in either **GitHub Codespaces** (cloud) or on your **local machine**. Follow the instructions for your preferred environment below.

---

## 🚀 **INSTANT DEMO SETUP**

Get the full system running in 3 commands:

```bash
# Terminal 1: Start blockchain
npx hardhat node

# Terminal 2: Deploy & setup (in new terminal)
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/setup-new-contracts.js --network localhost
npx hardhat run scripts/grant-admin-roles.js --network localhost
npx hardhat run scripts/create-stopwatch-test-policy.js --network localhost

# Terminal 3: Start frontend (in new terminal)
cd frontend && npm run dev

# Terminal 4: Start frontend
cd frontend  
npm run dev
```

Then configure MetaMask with the Hardhat network and import test accounts. The system will show real-time flood level updates in the backend terminal every 5 minutes.

---

## A. GitHub Codespaces Deployment

### 1. Clone and Install
```bash
git clone https://github.com/your-username/paramify.git
cd paramify
npm install
npm install -g http-server
```

### 2. Start the Hardhat Node
```bash
npx hardhat node
```
- This starts a node at `http://127.0.0.1:8545` (Chain ID 31337) and prints test accounts and private keys.

### 3. Deploy Contracts
```bash
npx hardhat run scripts/deploy.js --network localhost
```
- Note the deployed `Paramify` contract address. Update `frontend/index.html` with this address in `PARAMIFY_ADDRESS`.

### 4. Fund the Contract
```bash
npx hardhat run scripts/fund-contract.js --network localhost
```
- This sends 2 ETH to the contract for payouts.

### 5. Start the Backend Server
```bash
cd backend
npm start
```
- This starts the backend server on port 3001 with real-time USGS flood data updates.
- The server fetches flood levels every 5 minutes and updates the blockchain oracle.
- You'll see live flood level updates in the terminal (e.g., "Latest water level: 4.11 ft").

### 6. Serve the Frontend
```bash
cd frontend
http-server -p 8080
```
- If `http-server` is unavailable, use:
  ```bash
  python3 -m http.server 8080
  ```
- In the Codespaces "Ports" tab, make port 8080 public. Open the resulting URL (e.g., `https://<random-id>-8080.app.github.dev`) in your browser.

### 6. Configure MetaMask
- In the Codespaces "Ports" tab, make port 8545 public. Use the public URL (e.g., `https://<random-id>-8545.app.github.dev`) as the RPC URL in MetaMask.
- In MetaMask, add a new network:
  - Network Name: Hardhat (Codespace)
  - New RPC URL: (your public 8545 URL)
  - Chain ID: 31337
  - Currency Symbol: ETH
- Import test accounts using private keys from the Hardhat node output (see terminal logs).
- Update `frontend/src/lib/contract.ts` with the correct contract addresses if you redeploy contracts.

---

## B. Local Machine Deployment

### 1. Clone and Install
```bash
git clone https://github.com/your-username/paramify.git
cd paramify
npm install
npm install -g http-server
```

### 2. Start the Hardhat Node
```bash
npx hardhat node
```
- This starts a node at `http://127.0.0.1:8545` (Chain ID 31337) and prints test accounts and private keys.

### 3. Deploy Contracts
```bash
npx hardhat run scripts/deploy.js --network localhost
```
- Note the deployed `Paramify` contract address. Update `frontend/index.html` with this address in `PARAMIFY_ADDRESS`.

### 4. Fund the Contract
```bash
npx hardhat run scripts/fund-contract.js --network localhost
```
- This sends 2 ETH to the contract for payouts.

### 5. Start the Backend Server
```bash
cd backend
npm start
```
- This starts the backend server on port 3001 with real-time USGS flood data updates.
- The server fetches flood levels every 5 minutes and updates the blockchain oracle.
- You'll see live flood level updates in the terminal (e.g., "Latest water level: 4.11 ft").

### 6. Serve the Frontend
```bash
cd frontend
npm run dev
```
- This starts the Vite development server on port 8080.
- Open [http://localhost:8080](http://localhost:8080) in your browser.

### 6. Configure MetaMask
- In MetaMask, add a new network:
  - Network Name: Hardhat (Local)
  - New RPC URL: `http://127.0.0.1:8545`
  - Chain ID: 31337
  - Currency Symbol: ETH
- Import test accounts using private keys from the Hardhat node output (see terminal logs).
- Update `frontend/src/lib/contract.ts` and `backend/.env` with the correct contract addresses if you redeploy contracts.

---

**Note:** For both environments, always update the contract addresses in `frontend/src/lib/contract.ts` and `backend/.env` after redeployment. The backend server provides real-time flood data updates that you can monitor in the terminal output.

## Power Outage Monitoring System

The Paramify system now includes on-demand power outage monitoring:

- **Stopwatch Integration**: Manual stopwatch in frontend for simulating and recording outage durations
- **Backend API**: Accepts outage duration data via POST requests to `/api/outage`
- **Frontend Dashboard**: Real-time display of current outage status and duration
- **API Endpoint**: Access outage data at `http://localhost:3001/api/outage-data`
- **Blockchain Oracle**: Updated on-demand with outage duration values for smart contract integration

### Example Usage
```javascript
// Submit outage duration from frontend stopwatch
const response = await fetch('/api/outage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ outageDuration: 300 }) // 5 minutes in seconds
});
```

## Demo Instructions

### 1. Buy Power Outage Insurance
- Connect MetaMask as the customer (`0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199`).
- In the UI, enter desired payout rate per minute (e.g., `120` for £120/minute).
- Monthly premium will automatically calculate as: `payout rate × 2 = £240`.
- Click "Buy Insurance" and confirm in MetaMask.
- Verify: Premium: 240 ETH (in testnet), Payout Rate: 120/minute, Status: Active.

### 2. Simulate Power Outage with Stopwatch
- Use the stopwatch feature in the UI to simulate an outage.
- Click "Start" to begin timing, "Stop" to end timing.
- Enter the duration (e.g., 300 seconds for 5 minutes).
- Click "Submit Outage" to send duration to backend oracle.

### 3. Trigger Payout
- Connect as the customer.
- The system will automatically detect when outage duration > 0.
- Click "Claim Insurance Payout" and confirm.
- Verify:
  - Status: Paid Out.
  - Customer balance increases by calculated payout amount.
  - Payout = outage_duration_seconds × (payout_rate_per_minute / 60).

### 4. Edge Cases
- **Low Flood Level**: Set flood level to 2000 and try payout (fails: “Flood level below threshold”).
- **Low Contract Balance**: Deploy a new contract without funding and try payout (fails: “Payout failed”).
- **Duplicate Policy**: Try buying another policy while one is active (fails: “Policy already active”).

## Testing

Run unit tests to verify contract functionality:
```bash
npx hardhat test
```
- Tests cover:
  - Policy creation and validation.
  - Payout triggering above/below threshold.
  - Role-based access control.
  - Contract funding and withdrawal.

To verify the current state:
```bash
npx hardhat run scripts/check-policy.js --network localhost
```
- Example script (`scripts/check-policy.js`):
  ```javascript
  const { ethers } = require("hardhat");

  async function main() {
    const customer = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
    const contract = await ethers.getContractAt("Paramify", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
    const policy = await contract.policies(customer);
    console.log("Policy:", {
      active: policy.active,
      premium: ethers.formatEther(policy.premium),
      coverage: ethers.formatEther(policy.coverage),
      paidOut: policy.paidOut,
    });
    const balance = await contract.getContractBalance();
    console.log("Contract Balance:", ethers.formatEther(balance), "ETH");
    const customerBalance = await ethers.provider.getBalance(customer);
    console.log("Customer Balance:", ethers.formatEther(customerBalance), "ETH");
  }

  main().catch(console.error);
  ```

## Project Structure

```
paramify/
├── contracts/
│   ├── Paramify.sol          # Main insurance contract
│   └── mocks/
│       └── MockV3Aggregator.sol # Mock Chainlink oracle
├── backend/
│   ├── server.js             # Node.js backend with USGS integration
│   ├── package.json          # Backend dependencies
│   └── .env                  # Contract addresses and configuration
├── frontend/
│   ├── src/                  # React frontend source
│   ├── package.json          # Frontend dependencies
│   └── vite.config.ts        # Vite configuration (port 8080)
├── scripts/
│   ├── deploy.js             # Deploy contracts
│   ├── fund-contract.js      # Fund contract with ETH
│   └── check-policy.js       # Check policy and balances
├── test/
│   └── Paramify.test.js      # Unit tests
├── hardhat.config.js         # Hardhat configuration
├── package.json              # Root dependencies
└── README.md                 # This file
```

## Security and Dependencies

- **Dependencies**:
  - `@openzeppelin/contracts@5.0.2`: For AccessControl.
  - `@chainlink/contracts@1.2.0`: For AggregatorV3Interface.
  - `hardhat`, `ethers`, `@nomicfoundation/hardhat-toolbox`: For development.
- **Vulnerability Check**:
  ```bash
  npm audit fix
  npm audit
  ```
  - Address any high-severity issues before deployment.

## Premium Calculation & Payout System

### Premium Formula
- **Monthly Premium** = Payout Rate Per Minute × 2
- **Example**: For £120/minute payout rate → Monthly Premium = £240

### Payout Formula
- **Payout Amount** = Outage Duration (seconds) × Payout Rate Per Second
- **Payout Rate Per Second** = Payout Rate Per Minute ÷ 60
- **Example**: 300 seconds outage × (£120/60) = £600 payout

### Complete Example
1. User sets payout rate of £120/minute
2. Monthly premium = £120 × 2 = £240
3. User simulates 5-minute (300 seconds) outage with stopwatch
4. Payout = 300 × (£120/60) = 300 × £2 = £600

## Future Enhancements

- **Avalanche Integration**:
  - Deploy on Avalanche C-Chain for EVM compatibility.
  - Integrate with Avalanche-native oracles for real-world data.
- **Real Oracle Data**: Replace `MockV3Aggregator` with Chainlink's power outage data feeds.
- **Multi-Policy Support**: Allow users to hold multiple policies.
- **Frontend Polish**: Add a custom logo, improve UX, and support mobile views.
- **IoT Integration**: Connect with smart meters and IoT devices for automatic outage detection.


## Troubleshooting

- **Backend server not starting:**
  - Ensure Node.js is installed and run `npm install` in the backend directory.
  - Check if port 3001 is available: `netstat -ano | findstr :3001` (Windows) or `lsof -i :3001` (Mac/Linux).
- **Frontend not loading:**
  - Ensure frontend is running on port 8080: `npm run dev` in the frontend directory.
  - Check if port 8080 is available and kill conflicting processes if needed.
- **No flood data updates:**
  - Check the backend terminal for error messages.
  - Verify the backend server is connected to the blockchain (should show "Connected to: 0xf39...").
- **Contract address mismatch:**
  - Update both `frontend/src/lib/contract.ts` and `backend/.env` with the new contract addresses after redeployment.
- **MetaMask Issues:**
  - Ensure Hardhat network is added and accounts are imported.
  - Verify you're connected to the correct network (Chain ID 31337).

## License

MIT License. See [LICENSE](./LICENSE) for details.

---

*Adapted for the European Defense Hackathon - Power Outage Insurance MVP featuring manual stopwatch integration for outage simulation and duration-based parametric insurance payouts.*
