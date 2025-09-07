# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**FULLY TRANSFORMED TO ICP - NO ETHEREUM DEPENDENCIES**

Paramify is now a 100% Internet Computer Protocol (ICP) native flood insurance platform:
- **ICP Rust Canisters**: Complete insurance logic with stable storage
- **Internet Identity**: Web3 authentication without wallets or gas fees
- **ICP Cycles**: Payment system using native ICP tokens (e-8s)
- **Real-time USGS Integration**: Oracle service updates flood data every 5 minutes
- **React Frontend**: ICP-native interface with @dfinity/agent integration

The system automatically triggers insurance payouts when flood levels exceed thresholds, all powered by ICP smart contracts.

## Development Environment

### ⚠️ CRITICAL: ALL DEVELOPMENT MUST BE IN WSL UBUNTU

**WSL Setup (MANDATORY):**
```bash
# Work ONLY in WSL filesystem
cd ~/Paramify-5  # NOT /mnt/c/Users/...

# Run setup script
./setup-wsl-icp.sh
```

**ICP Development Workflow:**
```bash
# Start ICP replica
npm run start:replica  # or dfx start --clean --background

# Deploy canisters to local network
npm run deploy:local   # or dfx deploy --network local

# Build specific canisters
npm run build:oracle
npm run build:insurance

# Start frontend with ICP integration
npm run dev:frontend
```

### Testing Commands

```bash
# Run Ethereum smart contract tests
npx hardhat test

# Run all tests (Rust + Motoko + Integration)
npm test

# Run specific test suites
npm run test:rust    # Rust canister tests
npm run test:motoko  # Motoko canister tests
npm run test:integration

# Format and lint code
npm run format       # All languages
npm run lint         # All linting
```

### Build Commands

```bash
# Build entire project
npm run build

# Build only ICP canisters
npm run build:canisters

# Build only frontend
npm run build:frontend

# Generate type declarations
npm run generate     # or dfx generate
```

## Architecture Overview

### Smart Contract Layer (Ethereum)
- **Paramify.sol**: Main insurance contract with role-based access control
- **MockV3Aggregator.sol**: Chainlink-compatible oracle for flood data
- **Dynamic threshold management**: Flood thresholds can be updated by contract owner
- **Automated payouts**: Triggered when flood levels exceed threshold

### ICP Canister Infrastructure
- **paramify_insurance canister**: Mirror insurance logic with stable storage
- **oracle canister**: Real-time USGS data fetching and processing
- **flood_data_storage canister**: Historical data storage (Motoko)
- **Cross-platform synchronization**: Maintains consistency between Ethereum and ICP states

### Data Flow Architecture
1. **USGS API** → Real-time water level data (feet)
2. **Backend Processing** → Converts to contract units (feet × 100,000,000,000)
3. **Oracle Updates** → Both Ethereum contracts and ICP canisters
4. **Frontend Display** → Converts back to user-friendly feet values
5. **Automatic Payouts** → Triggered when threshold conditions are met

### Frontend Architecture
- **InsuracleDashboard.tsx**: Customer interface (buy insurance, claim payouts)
- **InsuracleDashboardAdmin.tsx**: Admin interface (manage thresholds, fund contracts)
- **Responsive design**: Optimized for both desktop and mobile
- **Real-time updates**: Live flood level monitoring and threshold alerts

## Critical Development Notes

### Contract Address Management
⚠️ **CRITICAL**: Contract addresses change on every Hardhat restart/redeployment!

After redeploying contracts, update addresses in:
- `backend/.env` - PARAMIFY_ADDRESS and MOCK_ORACLE_ADDRESS  
- `frontend/src/lib/contract.ts` - PARAMIFY_ADDRESS and MOCK_ORACLE_ADDRESS

### Unit Conversion System
The project uses a scaling factor of **100,000,000,000** for flood level data:
- USGS reports flood levels in feet (e.g., 4.24 ft)
- Smart contracts store scaled values (4.24 ft = 424,000,000,000 units)
- Frontend displays convert back to feet for users
- Admin thresholds are entered in feet but stored as scaled values

### Network Configuration
- **Local Ethereum**: Chain ID 31337, RPC http://localhost:8545
- **ICP Local**: Replica at http://localhost:4943
- **Default Admin Wallet**: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- **GitHub Codespaces**: Uses dynamically generated URLs for RPC endpoints

## File Structure Context

### Key Configuration Files
- `hardhat.config.js` - Ethereum development configuration
- `dfx.json` - ICP canister definitions and network settings
- `Cargo.toml` - Rust workspace configuration for ICP canisters
- `flake.nix` - Nix development environment with all required tools

### Smart Contract Directory
- `contracts/Paramify.sol` - Main insurance contract
- `contracts/mocks/MockV3Aggregator.sol` - Oracle simulation for testing
- Role-based access control for threshold management and payouts

### ICP Canisters Structure  
- `icp-canister/` - Rust-based insurance canister with stable storage
- `src/canisters/oracle/` - Real-time data oracle implementation
- `src/canisters/insurance/` - Motoko insurance logic (alternative implementation)

### Frontend Integration
- `frontend/src/lib/contract.ts` - Contract addresses and ABI definitions
- `frontend/src/lib/icp.ts` - ICP agent configuration and canister interfaces
- `frontend/src/lib/usgsApi.ts` - Backend API client for flood data

## Development Workflows

### Smart Contract Development
1. Make changes to `contracts/Paramify.sol`
2. Update ABI in `frontend/src/lib/contract.ts` if interface changes
3. Redeploy contracts: `npx hardhat run scripts/deploy.js --network localhost`
4. Update contract addresses in backend and frontend configuration
5. Restart backend service to pick up new addresses
6. Test on both customer and admin dashboards

### ICP Canister Development
1. Modify Rust code in `icp-canister/src/` or Motoko in `src/canisters/`
2. Build canisters: `dfx build` or `npm run build:canisters`
3. Deploy to local network: `dfx deploy --network local`
4. Generate updated type declarations: `dfx generate`
5. Update frontend imports if canister interfaces change

### Debugging Tips
- Backend logs show real-time USGS data updates every 5 minutes
- Frontend console shows contract interaction details
- Use `npx hardhat console --network localhost` for contract debugging
- ICP canister logs: `dfx canister logs <canister-name>`
- Check MetaMask network configuration (Chain ID 31337 for local)

### Environment Setup Notes
- Node.js 18.x or 23.x required (tested with 23.9.0)
- MetaMask browser extension needed for wallet interactions
- Python 3 optional for alternative frontend serving
- Rust toolchain with wasm32-unknown-unknown target for ICP development
- DFX SDK for ICP canister management

### Testing Strategy
- Unit tests cover individual contract functions and canister methods
- Integration tests verify cross-canister communication
- End-to-end tests simulate complete user workflows
- Real-world testing uses actual USGS flood monitoring station data
