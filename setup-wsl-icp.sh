#!/bin/bash

# PARAMIFY ICP TRANSFORMATION - WSL SETUP SCRIPT
# Run this script inside WSL Ubuntu at ~/Paramify-5

echo "🚀 Starting Paramify ICP Transformation in WSL..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check command success
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 successful${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# 1. Create WSL project directory
echo -e "\n${YELLOW}Step 1: Setting up WSL project directory...${NC}"
cd ~
if [ -d "Paramify-5" ]; then
    echo "Directory ~/Paramify-5 already exists. Backing up..."
    mv Paramify-5 Paramify-5-backup-$(date +%Y%m%d-%H%M%S)
fi

# Copy from Windows filesystem if it doesn't exist
if [ ! -d "Paramify-5" ]; then
    echo "Copying project from Windows filesystem..."
    cp -r /mnt/c/Users/danie/Paramify-5 ~/
    check_status "Project copy"
fi

cd ~/Paramify-5

# 2. Install system dependencies
echo -e "\n${YELLOW}Step 2: Installing system dependencies...${NC}"
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev curl git nodejs npm
check_status "System dependencies installation"

# 3. Install DFX (Internet Computer SDK)
echo -e "\n${YELLOW}Step 3: Installing DFX SDK...${NC}"
if ! command -v dfx &> /dev/null; then
    sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
    check_status "DFX installation"
    export PATH=$HOME/bin:$PATH
    echo 'export PATH=$HOME/bin:$PATH' >> ~/.bashrc
else
    echo "DFX already installed: $(dfx --version)"
fi

# 4. Install Rust
echo -e "\n${YELLOW}Step 4: Installing Rust toolchain...${NC}"
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    check_status "Rust installation"
    source $HOME/.cargo/env
    echo 'source $HOME/.cargo/env' >> ~/.bashrc
else
    echo "Rust already installed: $(rustc --version)"
fi

# Add WASM target
rustup target add wasm32-unknown-unknown
check_status "WASM target installation"

# 5. Install additional Rust tools
echo -e "\n${YELLOW}Step 5: Installing Rust tools...${NC}"
cargo install ic-wasm --version 0.7.0
check_status "ic-wasm installation"

# 6. Clean up Ethereum artifacts
echo -e "\n${YELLOW}Step 6: Removing Ethereum infrastructure...${NC}"
rm -rf contracts/
rm -rf scripts/deploy.js scripts/fund-contract.js scripts/deployMock.js
rm -rf test/Paramify.test.js test/Lock.js
rm -f hardhat.config.js
rm -rf cache/ artifacts/
rm -f MockV3Aggregator.sol
echo -e "${GREEN}✓ Ethereum files removed${NC}"

# 7. Create ICP project structure
echo -e "\n${YELLOW}Step 7: Creating ICP project structure...${NC}"

# Create canister directory structure
mkdir -p canister/src
mkdir -p frontend/src/lib
mkdir -p backend

# 8. Create sync script for Git operations
echo -e "\n${YELLOW}Step 8: Creating Windows sync script...${NC}"
cat > sync-to-windows.sh << 'EOF'
#!/bin/bash
# Sync WSL changes to Windows for Git operations
echo "Syncing WSL changes to Windows filesystem..."
rsync -av --exclude={'node_modules','.git','target','artifacts','.dfx','dist','cache'} \
      ~/Paramify-5/ /mnt/c/Users/danie/Paramify-5/
echo "✓ Sync complete. You can now commit from Windows."
EOF
chmod +x sync-to-windows.sh

# 9. Create development helper scripts
cat > start-icp.sh << 'EOF'
#!/bin/bash
echo "Starting ICP development environment..."
dfx stop
dfx start --clean --background
echo "ICP network started on http://localhost:8000"
EOF
chmod +x start-icp.sh

cat > deploy-local.sh << 'EOF'
#!/bin/bash
echo "Deploying canisters to local network..."
dfx deploy --network local
echo "Getting canister IDs..."
dfx canister id paramify_insurance --network local
dfx canister id frontend --network local
EOF
chmod +x deploy-local.sh

# 10. Final setup message
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✓ WSL ICP Development Environment Ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nNext steps:"
echo -e "1. Run: ${YELLOW}source ~/.bashrc${NC}"
echo -e "2. Verify installations:"
echo -e "   - ${YELLOW}dfx --version${NC}"
echo -e "   - ${YELLOW}rustc --version${NC}"
echo -e "   - ${YELLOW}cargo --version${NC}"
echo -e "\n${YELLOW}Important:${NC} Always work in WSL at ~/Paramify-5"
echo -e "Use ${YELLOW}./sync-to-windows.sh${NC} to sync changes for Git commits"
