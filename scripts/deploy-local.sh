#!/bin/bash

# Deploy script for local development
# This script deploys all canisters to the local replica

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETWORK="local"
DFX_VERSION="0.16.1"

# Helper functions
print_step() {
    echo -e "\n${BLUE}===> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites"
    
    # Check DFX
    if ! command -v dfx &> /dev/null; then
        print_error "DFX is not installed"
        echo "Please install DFX: sh -ci \"\$(curl -fsSL https://sdk.dfinity.org/install.sh)\""
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check Rust
    if ! command -v rustc &> /dev/null; then
        print_error "Rust is not installed"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Start local replica
start_replica() {
    print_step "Starting local replica"
    
    if dfx ping &> /dev/null; then
        print_success "Replica is already running"
    else
        print_warning "Starting new replica"
        dfx start --clean --background
        sleep 5
        
        if dfx ping &> /dev/null; then
            print_success "Replica started successfully"
        else
            print_error "Failed to start replica"
            exit 1
        fi
    fi
}

# Create identities and wallets
setup_identities() {
    print_step "Setting up identities"
    
    # Create default identity if not exists
    dfx identity new default --storage-mode=plaintext 2>/dev/null || true
    dfx identity use default
    
    DEPLOYER_PRINCIPAL=$(dfx identity get-principal)
    print_success "Deployer principal: $DEPLOYER_PRINCIPAL"
    
    # Create test identities
    dfx identity new test-admin --storage-mode=plaintext 2>/dev/null || true
    dfx identity new test-user --storage-mode=plaintext 2>/dev/null || true
    
    # Switch back to default
    dfx identity use default
}

# Deploy ICRC-1 Ledger
deploy_ledger() {
    print_step "Deploying ICRC-1 Ledger"
    
    MINTING_PRINCIPAL=$(dfx identity get-principal)
    
    # Deploy with initialization arguments
    dfx deploy icrc1_ledger --network $NETWORK --argument "(variant { 
        Init = record {
            token_symbol = \"ckETH\";
            token_name = \"Chain Key Ethereum\";
            minting_account = record {
                owner = principal \"$MINTING_PRINCIPAL\"
            };
            transfer_fee = 10_000;
            metadata = vec {};
            initial_balances = vec {
                record {
                    record {
                        owner = principal \"$MINTING_PRINCIPAL\";
                    };
                    100_000_000_000_000;
                };
            };
            archive_options = record {
                num_blocks_to_archive = 10_000;
                trigger_threshold = 20_000;
                controller_id = principal \"$MINTING_PRINCIPAL\";
            };
            feature_flags = opt record { icrc2 = true; };
            decimals = opt 8;
        }
    })" 2>&1 | while IFS= read -r line; do
        echo "  $line"
    done
    
    LEDGER_ID=$(dfx canister id icrc1_ledger --network $NETWORK)
    print_success "Ledger deployed: $LEDGER_ID"
}

# Deploy Oracle canister
deploy_oracle() {
    print_step "Deploying Oracle canister"
    
    # Build Oracle
    print_warning "Building Oracle canister (Rust)..."
    cargo build --manifest-path=src/canisters/oracle/Cargo.toml --target wasm32-unknown-unknown --release
    
    # Optimize WASM if ic-wasm is available
    if command -v ic-wasm &> /dev/null; then
        print_warning "Optimizing WASM..."
        ic-wasm target/wasm32-unknown-unknown/release/oracle.wasm \
                -o target/wasm32-unknown-unknown/release/oracle_optimized.wasm shrink
    fi
    
    # Deploy
    dfx deploy oracle --network $NETWORK
    
    ORACLE_ID=$(dfx canister id oracle --network $NETWORK)
    print_success "Oracle deployed: $ORACLE_ID"
}

# Deploy Payments canister
deploy_payments() {
    print_step "Deploying Payments canister"
    
    dfx deploy payments --network $NETWORK
    
    PAYMENTS_ID=$(dfx canister id payments --network $NETWORK)
    print_success "Payments deployed: $PAYMENTS_ID"
    
    # Configure payments canister
    print_warning "Configuring Payments canister..."
    
    LEDGER_ID=$(dfx canister id icrc1_ledger --network $NETWORK)
    
    # Set ledger canister
    dfx canister call payments setLedgerCanister "(principal \"$LEDGER_ID\")" --network $NETWORK
    
    # Add admin
    ADMIN_PRINCIPAL=$(dfx identity get-principal)
    dfx canister call payments addAdmin "(principal \"$ADMIN_PRINCIPAL\")" --network $NETWORK
    
    print_success "Payments configured"
}

# Deploy Insurance canister
deploy_insurance() {
    print_step "Deploying Insurance canister"
    
    dfx deploy insurance --network $NETWORK
    
    INSURANCE_ID=$(dfx canister id insurance --network $NETWORK)
    print_success "Insurance deployed: $INSURANCE_ID"
    
    # Initialize insurance canister
    print_warning "Initializing Insurance canister..."
    
    ORACLE_ID=$(dfx canister id oracle --network $NETWORK)
    PAYMENTS_ID=$(dfx canister id payments --network $NETWORK)
    LEDGER_ID=$(dfx canister id icrc1_ledger --network $NETWORK)
    
    dfx canister call insurance initialize "(record {
        oracle_canister = principal \"$ORACLE_ID\";
        payments_canister = principal \"$PAYMENTS_ID\";
        token_canister = principal \"$LEDGER_ID\";
        default_threshold = 3.0;
        premium_percentage = 10;
    })" --network $NETWORK
    
    print_success "Insurance initialized"
}

# Configure inter-canister permissions
configure_permissions() {
    print_step "Configuring inter-canister permissions"
    
    INSURANCE_ID=$(dfx canister id insurance --network $NETWORK)
    
    # Add Insurance as authorized caller in Oracle
    dfx canister call oracle add_authorized_caller "(principal \"$INSURANCE_ID\")" --network $NETWORK
    
    # Add Insurance as authorized caller in Payments
    dfx canister call payments addAuthorizedCaller "(principal \"$INSURANCE_ID\")" --network $NETWORK
    
    print_success "Permissions configured"
}

# Fund the payments pool
fund_pool() {
    print_step "Funding insurance pool"
    
    # Transfer tokens to payments canister for pool
    print_warning "Depositing 1000 tokens to insurance pool..."
    
    dfx canister call payments depositToPool "(100_000_000_000)" --network $NETWORK
    
    # Check pool balance
    BALANCE=$(dfx canister call payments getPoolBalance --network $NETWORK)
    print_success "Pool balance: $BALANCE"
}

# Deploy frontend assets
deploy_frontend() {
    print_step "Deploying frontend assets"
    
    # Build frontend
    print_warning "Building frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
    
    # Deploy frontend canister
    dfx deploy frontend --network $NETWORK
    
    FRONTEND_ID=$(dfx canister id frontend --network $NETWORK)
    print_success "Frontend deployed: $FRONTEND_ID"
}

# Generate canister IDs file
generate_canister_ids() {
    print_step "Generating canister IDs"
    
    cat > canister_ids.json << EOF
{
  "insurance": {
    "local": "$(dfx canister id insurance --network $NETWORK)"
  },
  "oracle": {
    "local": "$(dfx canister id oracle --network $NETWORK)"
  },
  "payments": {
    "local": "$(dfx canister id payments --network $NETWORK)"
  },
  "icrc1_ledger": {
    "local": "$(dfx canister id icrc1_ledger --network $NETWORK)"
  },
  "frontend": {
    "local": "$(dfx canister id frontend --network $NETWORK)"
  }
}
EOF
    
    print_success "Canister IDs saved to canister_ids.json"
}

# Update .env file
update_env() {
    print_step "Updating .env file"
    
    if [ ! -f .env ]; then
        cp .env.example .env
    fi
    
    # Update canister IDs in .env
    sed -i.bak "s/INSURANCE_CANISTER_ID=.*/INSURANCE_CANISTER_ID=$(dfx canister id insurance --network $NETWORK)/" .env
    sed -i.bak "s/ORACLE_CANISTER_ID=.*/ORACLE_CANISTER_ID=$(dfx canister id oracle --network $NETWORK)/" .env
    sed -i.bak "s/PAYMENTS_CANISTER_ID=.*/PAYMENTS_CANISTER_ID=$(dfx canister id payments --network $NETWORK)/" .env
    sed -i.bak "s/ICRC1_LEDGER_CANISTER_ID=.*/ICRC1_LEDGER_CANISTER_ID=$(dfx canister id icrc1_ledger --network $NETWORK)/" .env
    sed -i.bak "s/FRONTEND_CANISTER_ID=.*/FRONTEND_CANISTER_ID=$(dfx canister id frontend --network $NETWORK)/" .env
    
    print_success ".env file updated"
}

# Print deployment summary
print_summary() {
    print_step "Deployment Summary"
    
    echo ""
    echo "========================================="
    echo "  Paramify ICP Local Deployment Complete"
    echo "========================================="
    echo ""
    echo "Canister IDs:"
    echo "  Insurance:     $(dfx canister id insurance --network $NETWORK)"
    echo "  Oracle:        $(dfx canister id oracle --network $NETWORK)"
    echo "  Payments:      $(dfx canister id payments --network $NETWORK)"
    echo "  ICRC-1 Ledger: $(dfx canister id icrc1_ledger --network $NETWORK)"
    echo "  Frontend:      $(dfx canister id frontend --network $NETWORK)"
    echo ""
    echo "Frontend URL:"
    echo "  http://$(dfx canister id frontend --network $NETWORK).localhost:4943"
    echo ""
    echo "Candid UI URLs:"
    echo "  Insurance: http://127.0.0.1:4943/?canisterId=$(dfx canister id __Candid_UI --network $NETWORK)&id=$(dfx canister id insurance --network $NETWORK)"
    echo "  Oracle:    http://127.0.0.1:4943/?canisterId=$(dfx canister id __Candid_UI --network $NETWORK)&id=$(dfx canister id oracle --network $NETWORK)"
    echo "  Payments:  http://127.0.0.1:4943/?canisterId=$(dfx canister id __Candid_UI --network $NETWORK)&id=$(dfx canister id payments --network $NETWORK)"
    echo ""
    echo "Next steps:"
    echo "  1. Test the system: ./scripts/run-tests.sh"
    echo "  2. Start frontend dev server: cd frontend && npm run dev"
    echo "  3. View logs: dfx canister logs <canister-name>"
    echo ""
}

# Main deployment flow
main() {
    echo "========================================="
    echo "  Paramify ICP Local Deployment Script"
    echo "========================================="
    
    check_prerequisites
    start_replica
    setup_identities
    
    # Deploy canisters in order
    deploy_ledger
    deploy_oracle
    deploy_payments
    deploy_insurance
    
    # Configure system
    configure_permissions
    fund_pool
    deploy_frontend
    
    # Generate artifacts
    generate_canister_ids
    update_env
    
    # Print summary
    print_summary
    
    print_success "Deployment completed successfully!"
}

# Run main function
main "$@"