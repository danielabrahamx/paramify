# Paramify: Decentralized Parametric Insurance Proof of Concept

![alt text](image.png)


## Overview

**Paramify** is a proof of concept (PoC) for a decentralized parametric insurance platform, demonstrating automated insurance purchases and instant payouts triggered by satellite and drone damage detection. This PoC showcases a smart contract (`Paramify.sol`) that allows users to buy insurance policies, while the demo frontend simulates the satellite/drone → government property registry → instant payout flow that makes claims automatic and verifiable.

Paramify highlights the potential for decentralized insurance applications. The architecture is adaptable to Avalanche C-Chain or other EVM-compatible networks. This README provides instructions to set up, deploy, and demo the PoC locally, along with steps to test key features.

### Features
- **Insurance Purchase**: Users buy policies by paying a premium (10% of coverage), e.g., 0.1 ETH for 1 ETH coverage.
- **Instant Payouts**: Demo flow shows payouts triggered automatically from satellite geolocation + drone damage confirmation, with the property owner matched via a government property registry — no claims process.
- **Real Browser Geolocation**: The customer demo uses your actual location (browser permission) for the "home locked" satellite step, with reverse geocoding for a real street address.
- **Satellite & Drone Fleet Feed (insurer)**: The admin dashboard monitors a portfolio of homes with live telemetry — damage confirmed homes get instant simulated payouts to their registered owners.
- **Demo Mode (no wallet needed)**: Both dashboards work without MetaMask — a demo signer (hardhat account #0) is used automatically, or click "Continue as Demo Admin" when a wallet extension is installed.
- **Role-Based Access**: Admins manage the contract, oracle updaters set data levels, and insurance admins configure parameters.
- **Frontend Interface**: A React-based UI allows users to connect wallets, buy insurance, run damage scans, and monitor the fleet feed.



## Prerequisites

- **Node.js**: Version 18.x or 23.x (tested with 23.9.0).
- **MetaMask**: Browser extension for wallet interactions (optional — demo mode works without it).
- **Git**: To clone the repository.
- **Hardhat**: For contract deployment and testing.
- **Python 3** (optional): For alternative frontend serving if `http-server` is unavailable.

## Quick Start: Choose Your Environment

This project can be run in either **GitHub Codespaces** (cloud) or on your **local machine**. Follow the instructions for your preferred environment below.

---

## Quick Deployment Summary

For a complete local deployment, run these commands in order:

```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts and fund
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/fund-contract.js --network localhost

# Terminal 3 (optional): Start backend server (USGS data feed)
cd backend
npm start

# Terminal 4: Start frontend
cd frontend  
npm run dev
```

Then configure MetaMask with the Hardhat network and import test accounts. The demo works without MetaMask — if no wallet extension is detected, both dashboards fall back to demo mode automatically.

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
- Note the deployed `Paramify` contract address. Update `frontend/src/lib/contract.ts` with this address.

### 4. Fund the Contract
```bash
npx hardhat run scripts/fund-contract.js --network localhost
```
- This sends 2 ETH to the contract for payouts.

### 5. Start the Backend Server (optional)
```bash
cd backend
npm start
```
- This starts the backend server on port 3001 with USGS data updates.

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

### 7. Configure MetaMask
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
- Note the deployed `Paramify` contract address. Update `frontend/src/lib/contract.ts` with this address.

### 4. Fund the Contract
```bash
npx hardhat run scripts/fund-contract.js --network localhost
```
- This sends 2 ETH to the contract for payouts.

### 5. Start the Backend Server (optional)
```bash
cd backend
npm start
```
- This starts the backend server on port 3001 with USGS data updates.

### 6. Serve the Frontend
```bash
cd frontend
npm run dev
```
- This starts the Vite development server on port 8080.
- Open [http://localhost:8080](http://localhost:8080) in your browser.

### 7. Configure MetaMask
- In MetaMask, add a new network:
  - Network Name: Hardhat (Local)
  - New RPC URL: `http://127.0.0.1:8545`
  - Chain ID: 31337
  - Currency Symbol: ETH
- Import test accounts using private keys from the Hardhat node output (see terminal logs).
- Update `frontend/src/lib/contract.ts` and `backend/.env` with the correct contract addresses if you redeploy contracts.

---

**Note:** For both environments, always update the contract addresses in `frontend/src/lib/contract.ts` and `backend/.env` after redeployment.

## Demo Instructions

### 1. Buy Insurance (customer)
- Open the Individual Portal.
- If no wallet extension is installed, demo mode kicks in automatically (⚡ DEMO MODE badge). For real MetaMask interactions, import a hardhat test account (e.g. account #1 from `scripts/hardhat-accounts.js`) and connect to the Hardhat network.
- Enter `1` in the coverage amount (premium: 0.1 ETH).
- Click "Buy Insurance" and confirm in MetaMask (or it signs automatically in demo mode).
- Verify: Premium: 0.1 ETH, Coverage: 1 ETH, Status: Active.

### 2. Run Damage Scan (customer)
- Click "Run Scan" in the Satellite & Drone Damage Assessment panel.
- Allow browser location permission — the satellite step locks onto your **actual geolocation** and reverse-geocodes a real street address.
- Watch the flow: satellite geolocation → drone damage confirmation (87%) → government property registry owner match → instant payout with tx hash.

### 3. Fleet Feed (insurer)
- Open the Admin Dashboard.
- If MetaMask is connected with a non-admin account, click "⚡ Continue as Demo Admin".
- Click "Run Fleet Scan" — the fleet monitors 4 homes, confirms 2 with damage, and issues instant payouts to their registered owners.

### 4. Initiate Payout (insurer, no flood threshold)
- In the Insurance Policy section, the policy holder address defaults to the customer account (hardhat account #1). Click "Load Policy" to read the active policy from the chain.
- Click "🚨 Initiate Payout (demo)" — the payout is issued immediately without any threshold check (demo simulation).

### 5. Edge Cases
- **Duplicate Policy**: Try buying another policy while one is active (fails: "Policy already active").
- **Low Contract Balance**: Deploy a new contract without funding and try payout (fails: "Payout failed").

## Testing

Run unit tests to verify contract functionality:
```bash
npx hardhat test
```
- Tests cover:
  - Policy creation and validation.
  - Payout triggering.
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
    const customer = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
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
│   │   └── lib/geolocation.ts # Browser geolocation + reverse geocoding helper
│   ├── package.json          # Frontend dependencies
│   └── vite.config.ts        # Vite configuration (port 8080)
├── scripts/
│   ├── deploy.js             # Deploy contracts
│   ├── fund-contract.js      # Fund contract with ETH
│   ├── hardhat-accounts.js   # Print test accounts + private keys
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

## Future Enhancements

- **War-Damage Coverage**: Design a parametric home-damage peril alongside the existing flood peril (tracked in `.scratch/war-damage/`): satellite/drone geolocation → damage confirmation → government property registry owner lookup → instant payout.
- **Avalanche Integration**:
  - Deploy on Avalanche C-Chain for EVM compatibility.
  - Integrate with Avalanche-native oracles for real-world data.
- **Real Oracle Data**: Replace `MockV3Aggregator` with Chainlink data feeds.
- **Multi-Policy Support**: Allow users to hold multiple policies.
- **Frontend Polish**: Add a custom logo, improve UX, and support mobile views.


## Troubleshooting

- **Backend server not starting:**
  - Ensure Node.js is installed and run `npm install` in the backend directory.
  - Check if port 3001 is available: `netstat -ano | findstr :3001` (Windows) or `lsof -i :3001` (Mac/Linux).
- **Frontend not loading:**
  - Ensure frontend is running on port 8080: `npm run dev` in the frontend directory.
  - Check if port 8080 is available and kill conflicting processes if needed.
- **Admin dashboard asks to connect wallet:**
  - Click "⚡ Continue as Demo Admin" — no wallet needed for the demo.
- **Contract address mismatch:**
  - Update both `frontend/src/lib/contract.ts` and `backend/.env` with the new contract addresses after redeployment.
- **MetaMask Issues:**
  - Ensure Hardhat network is added and accounts are imported.
  - Verify you're connected to the correct network (Chain ID 31337).
  - Make sure the currently selected account is the one you imported (the dashboard reads the selected account via `eth_requestAccounts`).

## License

MIT License. See [LICENSE](./LICENSE) for details.

---

*Presented as a proof of concept for the Avalanche Summit Hackathon, May 2025.*
