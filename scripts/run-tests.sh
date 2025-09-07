#!/bin/bash

# Test runner script for Paramify ICP
# Runs unit tests, integration tests, and E2E tests

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

print_test() {
    echo -e "${YELLOW}▶ Running: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

# Run Motoko tests
run_motoko_tests() {
    print_header "Motoko Unit Tests"
    
    # Test Insurance canister
    print_test "Insurance canister tests"
    if $(vessel bin)/moc -r $(vessel sources) -wasi-system-api src/canisters/insurance/insurance.test.mo 2>/dev/null; then
        print_success "Insurance tests passed"
    else
        print_error "Insurance tests failed"
    fi
    
    # Test Payments canister
    print_test "Payments canister tests"
    if $(vessel bin)/moc -r $(vessel sources) -wasi-system-api src/canisters/payments/payments.test.mo 2>/dev/null; then
        print_success "Payments tests passed"
    else
        print_error "Payments tests failed"
    fi
}

# Run Rust tests
run_rust_tests() {
    print_header "Rust Unit Tests"
    
    print_test "Oracle canister tests"
    if cargo test --manifest-path=src/canisters/oracle/Cargo.toml 2>&1 | grep -q "test result: ok"; then
        print_success "Oracle tests passed"
    else
        print_error "Oracle tests failed"
    fi
}

# Run integration tests
run_integration_tests() {
    print_header "Integration Tests"
    
    print_test "Canister integration tests"
    if $(vessel bin)/moc -r $(vessel sources) -wasi-system-api tests/integration/canister-integration.test.mo 2>/dev/null; then
        print_success "Integration tests passed"
    else
        print_error "Integration tests failed"
    fi
}

# Run E2E tests
run_e2e_tests() {
    print_header "End-to-End Tests"
    
    # Check if local replica is running
    if ! dfx ping &> /dev/null; then
        echo -e "${YELLOW}Starting local replica for E2E tests...${NC}"
        dfx start --clean --background
        sleep 5
    fi
    
    # Deploy canisters if not deployed
    if ! dfx canister id insurance --network local &> /dev/null; then
        echo -e "${YELLOW}Deploying canisters for E2E tests...${NC}"
        ./scripts/deploy-local.sh
    fi
    
    print_test "Full insurance flow test"
    if node tests/e2e/full-flow.test.js; then
        print_success "E2E tests passed"
    else
        print_error "E2E tests failed"
    fi
}

# Run frontend tests
run_frontend_tests() {
    print_header "Frontend Tests"
    
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        npm install
    fi
    
    print_test "React component tests"
    if npm test -- --watchAll=false --passWithNoTests 2>&1 | grep -q "PASS\|No tests found"; then
        print_success "Frontend tests passed"
    else
        print_error "Frontend tests failed"
    fi
    
    cd ..
}

# Run specific test suite
run_specific_test() {
    case "$1" in
        motoko)
            run_motoko_tests
            ;;
        rust)
            run_rust_tests
            ;;
        integration)
            run_integration_tests
            ;;
        e2e)
            run_e2e_tests
            ;;
        frontend)
            run_frontend_tests
            ;;
        *)
            echo "Unknown test suite: $1"
            echo "Available options: motoko, rust, integration, e2e, frontend"
            exit 1
            ;;
    esac
}

# Print test summary
print_summary() {
    print_header "Test Summary"
    
    TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
    
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    
    echo ""
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}════════════════════════════════════════${NC}"
        echo -e "${GREEN}  All tests passed successfully! 🎉${NC}"
        echo -e "${GREEN}════════════════════════════════════════${NC}"
        exit 0
    else
        echo -e "${RED}════════════════════════════════════════${NC}"
        echo -e "${RED}  Some tests failed. Please review.${NC}"
        echo -e "${RED}════════════════════════════════════════${NC}"
        exit 1
    fi
}

# Main function
main() {
    echo "========================================="
    echo "  Paramify ICP Test Runner"
    echo "========================================="
    
    # Check for specific test suite argument
    if [ $# -eq 1 ]; then
        run_specific_test "$1"
    else
        # Run all tests
        run_motoko_tests
        run_rust_tests
        run_integration_tests
        run_e2e_tests
        run_frontend_tests
    fi
    
    print_summary
}

# Run main
main "$@"