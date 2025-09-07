# Paramify ICP Development Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Environment Configuration](#environment-configuration)
5. [Development Workflow](#development-workflow)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)
9. [IDE Setup](#ide-setup)

## Prerequisites

### System Requirements
- **OS**: macOS, Linux, or WSL2 on Windows
- **RAM**: Minimum 8GB (16GB recommended)
- **Disk Space**: At least 10GB free
- **Internet**: Stable connection for downloading dependencies

### Required Software

| Tool | Version | Installation Command | Verification |
|------|---------|---------------------|--------------|
| **Node.js** | ≥ 18.0.0 | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh \| bash` | `node --version` |
| **npm** | ≥ 9.0.0 | Comes with Node.js | `npm --version` |
| **Rust** | ≥ 1.75.0 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` | `rustc --version` |
| **dfx** | ≥ 0.16.1 | `sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"` | `dfx --version` |
| **Git** | ≥ 2.0.0 | System package manager | `git --version` |
| **Python** | ≥ 3.8 | System package manager | `python3 --version` |

### Optional Tools

| Tool | Purpose | Installation |
|------|---------|--------------|
| **vessel** | Motoko package manager | `npm install -g vessel` |
| **ic-wasm** | WASM optimizer | `cargo install ic-wasm` |
| **pocket-ic** | Local testing | `cargo install pocket-ic` |
| **candid-ui** | Candid interface explorer | Included with dfx |

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/danielabrahamx/Paramify.git
cd Paramify
git checkout icp-migration

# 2. Run the setup verification
chmod +x scripts/verify-dev-env.sh
./scripts/verify-dev-env.sh

# 3. Install dependencies
npm run setup

# 4. Configure environment
cp .env.example .env
# Edit .env with your values

# 5. Start local replica
npm run start

# 6. Deploy canisters
npm run deploy:local

# 7. Start frontend development server
npm run dev:frontend
```

## Detailed Setup

### Step 1: Install DFX (DFINITY SDK)

```bash
# Install DFX
sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH=$HOME/bin:$PATH

# Verify installation
dfx --version
```

### Step 2: Install Rust Toolchain

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install IC-specific tools
cargo install ic-wasm
cargo install candid-extractor
```

### Step 3: Install Motoko Tools

```bash
# Install vessel for package management
npm install -g vessel

# Install formatter and documentation generator
npm install -g mo-fmt mo-doc

# Verify installation
vessel --version
mo-fmt --version
```

### Step 4: Project Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Rust dependencies
cargo build

# Install Motoko dependencies
vessel install
```

### Step 5: Identity Setup

```bash
# Create a new identity for development
dfx identity new dev --storage-mode=plaintext
dfx identity use dev

# Get your principal ID
dfx identity get-principal

# Create a wallet (local network must be running)
dfx start --clean --background
dfx wallet balance
```

## Environment Configuration

### .env File Structure

Create a `.env` file in the project root:

```bash
# Network Configuration
DFX_NETWORK=local
REPLICA_PORT=4943

# Identity Configuration
DEPLOYER_PRINCIPAL=<your-principal-id>
MINTING_PRINCIPAL=<minting-account-principal>

# Canister IDs (auto-populated after deployment)
INSURANCE_CANISTER_ID=
ORACLE_CANISTER_ID=
PAYMENTS_CANISTER_ID=
ICRC1_LEDGER_CANISTER_ID=
FRONTEND_CANISTER_ID=

# Oracle Configuration
USGS_SITE_ID=01646500
USGS_PARAMETER_CODE=00065
UPDATE_INTERVAL_SECONDS=300

# Insurance Configuration
DEFAULT_THRESHOLD_FEET=3.0
PREMIUM_PERCENTAGE=10
MAX_COVERAGE_TOKENS=1000000000000

# Development Settings
ENABLE_MOCK_DATA=false
LOG_LEVEL=debug
```

### Network Configuration

#### Local Development
```json
{
  "local": {
    "bind": "127.0.0.1:4943",
    "type": "ephemeral"
  }
}
```

#### Mainnet Deployment
```json
{
  "ic": {
    "providers": ["https://ic0.app"],
    "type": "persistent"
  }
}
```

## Development Workflow

### 1. Start Local Replica

```bash
# Start in background
dfx start --clean --background

# Or start with logs
dfx start --clean

# Check status
dfx ping
```

### 2. Deploy Canisters

```bash
# Deploy all canisters
npm run deploy:local

# Deploy specific canister
dfx deploy insurance --network local

# Deploy with initialization arguments
dfx deploy oracle --argument '(record { 
  usgs_site_id = "01646500"; 
  update_interval = 300;
})'
```

### 3. Interact with Canisters

```bash
# Using dfx canister call
dfx canister call insurance get_system_status

# Using generated bindings (in frontend)
import { insurance } from '../declarations/insurance';
const status = await insurance.get_system_status();
```

### 4. Frontend Development

```bash
# Start development server
cd frontend
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## Testing

### Unit Tests

```bash
# Motoko tests
$(vessel bin)/moc -r $(vessel sources) -wasi-system-api src/canisters/**/*.test.mo

# Rust tests
cargo test --all

# JavaScript tests
npm run test --workspace=frontend
```

### Integration Tests

```bash
# Run integration test suite
npm run test:integration

# Run specific test
npm run test:integration -- --grep "oracle updates"
```

### E2E Tests

```bash
# Start all services
npm run dev

# In another terminal
npm run test:e2e
```

### Pocket-IC Testing

```bash
# Install pocket-ic
cargo install pocket-ic-cli

# Run pocket-ic tests
pocket-ic tests/pocket-ic/*.test.js
```

## Deployment

### Local Deployment

```bash
# Full deployment
npm run deploy:local

# Check deployment
dfx canister status --all
```

### Testnet Deployment

```bash
# Deploy to testnet
dfx deploy --network testnet --with-cycles 1000000000000
```

### Mainnet Deployment

```bash
# Set identity
dfx identity use production

# Check cycles balance
dfx wallet balance --network ic

# Deploy with cycles
dfx deploy --network ic --with-cycles 2000000000000

# Verify deployment
dfx canister status --all --network ic
```

## Troubleshooting

### Common Issues and Solutions

#### 1. DFX Not Found
```bash
# Add to PATH
export PATH=$HOME/bin:$PATH
echo 'export PATH=$HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### 2. Replica Connection Failed
```bash
# Stop and restart
dfx stop
dfx start --clean
```

#### 3. WASM Build Errors
```bash
# Clear build cache
cargo clean
rm -rf .dfx
dfx build --clean
```

#### 4. Out of Cycles
```bash
# Top up cycles
dfx wallet send <amount> <canister-id>
```

#### 5. Port Already in Use
```bash
# Find process
lsof -i :4943
# Kill process
kill -9 <PID>
```

### Debug Commands

```bash
# Check replica logs
dfx replica logs

# Check canister logs
dfx canister logs <canister-name>

# Check cycles consumption
dfx canister status <canister-name>

# Inspect canister state
dfx canister call <canister-name> __get_candid_interface_tmp_hack
```

## IDE Setup

### VS Code

Install recommended extensions:
```json
{
  "recommendations": [
    "dfinity-foundation.vscode-motoko",
    "rust-lang.rust-analyzer",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "tamasfe.even-better-toml"
  ]
}
```

Settings:
```json
{
  "motoko.formatter": "mo-fmt",
  "rust-analyzer.cargo.target": "wasm32-unknown-unknown",
  "editor.formatOnSave": true,
  "files.associations": {
    "*.did": "candid"
  }
}
```

### IntelliJ IDEA

1. Install Rust plugin
2. Install Motoko plugin
3. Configure SDK paths:
   - DFX SDK: `$HOME/bin`
   - Vessel: `$HOME/.vessel`

## Monitoring and Maintenance

### Health Checks

```bash
# System status
npm run insurance:status

# Oracle status
npm run oracle:status

# Check all canisters
dfx canister status --all
```

### Backup and Recovery

```bash
# Export state
dfx canister call insurance export_state > backup.json

# Import state
dfx canister call insurance import_state "$(cat backup.json)"
```

### Upgrade Procedures

```bash
# Build new version
npm run build

# Upgrade canister
dfx canister install insurance --mode upgrade

# Verify upgrade
dfx canister call insurance get_version
```

## Additional Resources

- [Internet Computer Documentation](https://internetcomputer.org/docs/)
- [Motoko Language Guide](https://internetcomputer.org/docs/current/motoko/main/motoko)
- [Rust CDK Documentation](https://docs.rs/ic-cdk/latest/ic_cdk/)
- [DFINITY Forum](https://forum.dfinity.org/)
- [ICP Developer Discord](https://discord.gg/jnjVVQaE2C)

## Support

For issues and questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [GitHub Issues](https://github.com/danielabrahamx/Paramify/issues)
3. Ask in the [DFINITY Forum](https://forum.dfinity.org/)
4. Contact the development team

---

*Last Updated: 2025-09-02*
*Version: 2.0.0*