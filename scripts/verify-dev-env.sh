#!/bin/bash

# Paramify ICP Development Environment Verification Script
# This script checks for all required tools and dependencies

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Version requirements
MIN_NODE_VERSION="18.0.0"
MIN_NPM_VERSION="9.0.0"
MIN_RUST_VERSION="1.75.0"
MIN_DFX_VERSION="0.16.0"
MIN_PYTHON_VERSION="3.8"

# Track overall status
VERIFICATION_PASSED=true

# Helper functions
print_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    VERIFICATION_PASSED=false
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Version comparison function
version_ge() {
    # Returns 0 if version $1 >= version $2
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# Check command existence
check_command() {
    local cmd=$1
    local name=$2
    local install_hint=$3
    
    if command -v "$cmd" &> /dev/null; then
        return 0
    else
        print_error "$name is not installed"
        print_info "  Installation: $install_hint"
        return 1
    fi
}

# Check version
check_version() {
    local current=$1
    local required=$2
    local name=$3
    
    if version_ge "$current" "$required"; then
        print_success "$name version $current (required: ≥$required)"
        return 0
    else
        print_error "$name version $current is below required version $required"
        return 1
    fi
}

# Main verification script
main() {
    print_header "Paramify ICP Development Environment Verification"
    echo "Starting verification at $(date)"
    
    # System Information
    print_header "System Information"
    echo "OS: $(uname -s) $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo "User: $(whoami)"
    echo "Shell: $SHELL"
    
    # Check Core Tools
    print_header "Core Development Tools"
    
    # Node.js
    if check_command "node" "Node.js" "https://nodejs.org/ or use nvm"; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        check_version "$NODE_VERSION" "$MIN_NODE_VERSION" "Node.js"
    fi
    
    # npm
    if check_command "npm" "npm" "Comes with Node.js"; then
        NPM_VERSION=$(npm --version)
        check_version "$NPM_VERSION" "$MIN_NPM_VERSION" "npm"
    fi
    
    # Git
    if check_command "git" "Git" "https://git-scm.com/"; then
        GIT_VERSION=$(git --version | awk '{print $3}')
        print_success "Git version $GIT_VERSION"
    fi
    
    # Python
    if check_command "python3" "Python 3" "https://www.python.org/"; then
        PYTHON_VERSION=$(python3 --version | awk '{print $2}')
        PYTHON_SHORT=$(echo "$PYTHON_VERSION" | cut -d'.' -f1,2)
        check_version "$PYTHON_SHORT" "$MIN_PYTHON_VERSION" "Python"
    fi
    
    # ICP-Specific Tools
    print_header "ICP Development Tools"
    
    # DFX
    if check_command "dfx" "DFX SDK" "sh -ci \"\$(curl -fsSL https://sdk.dfinity.org/install.sh)\""; then
        DFX_VERSION=$(dfx --version | awk '{print $2}')
        check_version "$DFX_VERSION" "$MIN_DFX_VERSION" "DFX"
        
        # Check DFX configuration
        if [ -f "dfx.json" ]; then
            print_success "dfx.json configuration found"
        else
            print_warning "dfx.json not found in current directory"
        fi
    fi
    
    # Rust
    if check_command "rustc" "Rust" "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"; then
        RUST_VERSION=$(rustc --version | awk '{print $2}')
        check_version "$RUST_VERSION" "$MIN_RUST_VERSION" "Rust"
        
        # Check WASM target
        if rustup target list | grep -q "wasm32-unknown-unknown (installed)"; then
            print_success "WASM target installed"
        else
            print_warning "WASM target not installed"
            print_info "  Install with: rustup target add wasm32-unknown-unknown"
        fi
    fi
    
    # Cargo
    if check_command "cargo" "Cargo" "Comes with Rust"; then
        CARGO_VERSION=$(cargo --version | awk '{print $2}')
        print_success "Cargo version $CARGO_VERSION"
    fi
    
    # Optional Tools
    print_header "Optional Tools"
    
    # vessel
    if check_command "vessel" "Vessel (Motoko package manager)" "npm install -g vessel"; then
        VESSEL_VERSION=$(vessel --version 2>/dev/null || echo "unknown")
        print_success "Vessel installed (version: $VESSEL_VERSION)"
    else
        print_warning "Vessel not installed (optional)"
    fi
    
    # ic-wasm
    if check_command "ic-wasm" "IC-WASM optimizer" "cargo install ic-wasm"; then
        print_success "IC-WASM optimizer installed"
    else
        print_warning "IC-WASM not installed (optional, but recommended)"
    fi
    
    # mo-fmt
    if check_command "mo-fmt" "Motoko formatter" "npm install -g mo-fmt"; then
        print_success "Motoko formatter installed"
    else
        print_warning "Motoko formatter not installed (optional)"
    fi
    
    # mo-doc
    if check_command "mo-doc" "Motoko documentation generator" "npm install -g mo-doc"; then
        print_success "Motoko documentation generator installed"
    else
        print_warning "Motoko documentation generator not installed (optional)"
    fi
    
    # Network Connectivity
    print_header "Network Connectivity"
    
    # Check Internet connectivity
    if ping -c 1 -W 2 ic0.app &> /dev/null; then
        print_success "Internet connectivity verified"
    else
        print_warning "Cannot reach IC network (ic0.app)"
    fi
    
    # Check local replica port
    if ! lsof -i:4943 &> /dev/null; then
        print_success "Port 4943 is available for local replica"
    else
        print_warning "Port 4943 is in use (may conflict with local replica)"
        print_info "  Current process: $(lsof -i:4943 | tail -1)"
    fi
    
    # Check frontend port
    if ! lsof -i:3000 &> /dev/null; then
        print_success "Port 3000 is available for frontend"
    else
        print_warning "Port 3000 is in use"
    fi
    
    # Project Structure
    print_header "Project Structure Verification"
    
    # Check for required directories
    REQUIRED_DIRS=("src" "scripts" "docs")
    for dir in "${REQUIRED_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            print_success "Directory '$dir' exists"
        else
            print_warning "Directory '$dir' not found"
        fi
    done
    
    # Check for configuration files
    CONFIG_FILES=("dfx.json" "package.json" "Cargo.toml" ".env.example")
    for file in "${CONFIG_FILES[@]}"; do
        if [ -f "$file" ]; then
            print_success "Configuration file '$file' exists"
        else
            if [ "$file" = ".env.example" ]; then
                print_warning "Configuration file '$file' not found (optional)"
            else
                print_error "Configuration file '$file' not found"
            fi
        fi
    done
    
    # Environment Variables
    print_header "Environment Configuration"
    
    if [ -f ".env" ]; then
        print_success ".env file exists"
        # Check for required variables
        if grep -q "DFX_NETWORK" .env; then
            print_success "DFX_NETWORK configured"
        else
            print_warning "DFX_NETWORK not set in .env"
        fi
    else
        print_warning ".env file not found"
        print_info "  Create with: cp .env.example .env"
    fi
    
    # Identity Check
    print_header "DFX Identity Configuration"
    
    if command -v dfx &> /dev/null; then
        CURRENT_IDENTITY=$(dfx identity whoami 2>/dev/null || echo "none")
        if [ "$CURRENT_IDENTITY" != "none" ]; then
            print_success "Current identity: $CURRENT_IDENTITY"
            PRINCIPAL=$(dfx identity get-principal 2>/dev/null || echo "unknown")
            print_info "  Principal: $PRINCIPAL"
        else
            print_warning "No DFX identity configured"
            print_info "  Create with: dfx identity new dev"
        fi
    fi
    
    # Disk Space Check
    print_header "System Resources"
    
    AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
    print_info "Available disk space: $AVAILABLE_SPACE"
    
    AVAILABLE_MEMORY=$(free -h 2>/dev/null | awk 'NR==2 {print $7}' || echo "N/A (not Linux)")
    print_info "Available memory: $AVAILABLE_MEMORY"
    
    # Summary
    print_header "Verification Summary"
    
    if [ "$VERIFICATION_PASSED" = true ]; then
        echo -e "${GREEN}✓ All required tools are installed and configured!${NC}"
        echo -e "${GREEN}Your development environment is ready for Paramify ICP development.${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Install dependencies: npm install"
        echo "  2. Start local replica: dfx start --clean"
        echo "  3. Deploy canisters: npm run deploy:local"
        exit 0
    else
        echo -e "${RED}✗ Some required tools are missing or misconfigured.${NC}"
        echo -e "${RED}Please install the missing components and run this script again.${NC}"
        echo ""
        echo "For detailed setup instructions, see: docs/setup.md"
        exit 1
    fi
}

# Run main function
main "$@"