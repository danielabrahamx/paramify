#!/usr/bin/env node

/**
 * Paramify ICP E2E Test Suite
 * Full end-to-end testing of the insurance flow
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Test configuration
const TEST_CONFIG = {
    network: 'local',
    identities: {
        admin: 'test-admin',
        customer1: 'test-customer-1',
        customer2: 'test-customer-2'
    },
    coverage: {
        amount: '1000000000', // 10 tokens with 8 decimals
        premium: '100000000'  // 1 token (10% of coverage)
    },
    threshold: {
        normal: 3.0,  // Normal threshold in feet
        trigger: 4.5  // Threshold that triggers payout
    }
};

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runCommand = async (command, silent = false) => {
    try {
        const { stdout, stderr } = await execAsync(command);
        if (!silent) {
            console.log(`✓ Command: ${command.substring(0, 50)}...`);
            if (stdout) console.log(`  Output: ${stdout.trim().substring(0, 100)}...`);
        }
        return { success: true, stdout, stderr };
    } catch (error) {
        console.error(`✗ Command failed: ${command}`);
        console.error(`  Error: ${error.message}`);
        return { success: false, error };
    }
};

const createIdentity = async (name) => {
    console.log(`Creating identity: ${name}`);
    await runCommand(`dfx identity new ${name} --storage-mode=plaintext || true`);
    await runCommand(`dfx identity use ${name}`);
    const { stdout } = await runCommand(`dfx identity get-principal`);
    return stdout.trim();
};

const switchIdentity = async (name) => {
    await runCommand(`dfx identity use ${name}`);
};

// Test scenarios
class ParamifyE2ETests {
    constructor() {
        this.canisterIds = {};
        this.principals = {};
    }

    async setup() {
        console.log('\n🚀 Setting up test environment...\n');

        // Start local replica if not running
        console.log('Starting local replica...');
        await runCommand('dfx stop || true', true);
        await runCommand('dfx start --clean --background');
        await delay(5000); // Wait for replica to start

        // Create test identities
        console.log('\nCreating test identities...');
        for (const [role, identity] of Object.entries(TEST_CONFIG.identities)) {
            this.principals[role] = await createIdentity(identity);
            console.log(`  ${role}: ${this.principals[role]}`);
        }

        // Switch back to default identity for deployment
        await switchIdentity('default');

        // Deploy canisters
        console.log('\nDeploying canisters...');
        const { stdout } = await runCommand('dfx deploy --network local 2>&1');
        
        // Extract canister IDs from deployment output
        const lines = stdout.split('\n');
        for (const line of lines) {
            if (line.includes('Canister ID:')) {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const canisterInfo = parts[0].trim();
                    const canisterId = parts[1].trim();
                    
                    if (canisterInfo.includes('insurance')) {
                        this.canisterIds.insurance = canisterId;
                    } else if (canisterInfo.includes('oracle')) {
                        this.canisterIds.oracle = canisterId;
                    } else if (canisterInfo.includes('payments')) {
                        this.canisterIds.payments = canisterId;
                    } else if (canisterInfo.includes('icrc1_ledger')) {
                        this.canisterIds.ledger = canisterId;
                    }
                }
            }
        }

        console.log('\nCanister IDs:');
        console.log(`  Insurance: ${this.canisterIds.insurance || 'Not found'}`);
        console.log(`  Oracle: ${this.canisterIds.oracle || 'Not found'}`);
        console.log(`  Payments: ${this.canisterIds.payments || 'Not found'}`);
        console.log(`  Ledger: ${this.canisterIds.ledger || 'Not found'}`);

        // Initialize canisters
        await this.initializeCanisters();
    }

    async initializeCanisters() {
        console.log('\n🔧 Initializing canisters...\n');

        // Set up admin role
        await switchIdentity(TEST_CONFIG.identities.admin);

        // Initialize Insurance canister
        if (this.canisterIds.insurance) {
            console.log('Initializing Insurance canister...');
            await runCommand(`dfx canister call insurance initialize '(record {
                oracle_canister = principal "${this.canisterIds.oracle}";
                payments_canister = principal "${this.canisterIds.payments}";
                token_canister = principal "${this.canisterIds.ledger}";
                default_threshold = ${TEST_CONFIG.threshold.normal};
                premium_percentage = 10;
            })'`);
        }

        // Initialize Oracle canister
        if (this.canisterIds.oracle) {
            console.log('Initializing Oracle canister...');
            await runCommand(`dfx canister call oracle set_authorized_caller '(principal "${this.canisterIds.insurance}")'`);
        }

        // Initialize Payments canister
        if (this.canisterIds.payments) {
            console.log('Initializing Payments canister...');
            await runCommand(`dfx canister call payments setLedgerCanister '(principal "${this.canisterIds.ledger}")'`);
            await runCommand(`dfx canister call payments addAuthorizedCaller '(principal "${this.canisterIds.insurance}")'`);
            
            // Fund the payments pool
            console.log('Funding payments pool...');
            await runCommand(`dfx canister call payments depositToPool '(10000000000)'`); // 100 tokens
        }
    }

    async testPurchaseInsurance() {
        console.log('\n📝 Test 1: Purchase Insurance\n');

        await switchIdentity(TEST_CONFIG.identities.customer1);

        // Check initial balance
        const balanceResult = await runCommand(`dfx canister call icrc1_ledger icrc1_balance_of '(record {
            owner = principal "${this.principals.customer1}";
            subaccount = null;
        })'`);
        console.log(`Initial balance: ${balanceResult.stdout}`);

        // Purchase insurance
        console.log('Purchasing insurance policy...');
        const purchaseResult = await runCommand(`dfx canister call insurance purchase_policy '(record {
            coverage_amount = ${TEST_CONFIG.coverage.amount};
        })'`);

        if (purchaseResult.success) {
            console.log('✅ Insurance purchased successfully');
            
            // Verify policy
            const policyResult = await runCommand(`dfx canister call insurance get_policy '(principal "${this.principals.customer1}")'`);
            console.log(`Policy details: ${policyResult.stdout}`);
            
            return true;
        } else {
            console.log('❌ Failed to purchase insurance');
            return false;
        }
    }

    async testOracleUpdate() {
        console.log('\n🌊 Test 2: Oracle Water Level Update\n');

        await switchIdentity(TEST_CONFIG.identities.admin);

        // Manually update oracle with normal level
        console.log('Setting normal water level (2.5 ft)...');
        await runCommand(`dfx canister call oracle manual_update_value '(250)'`); // 2.5 ft * 100
        
        // Check oracle value
        const oracleResult = await runCommand(`dfx canister call oracle get_latest_data`);
        console.log(`Current water level: ${oracleResult.stdout}`);

        // Update with flood level
        console.log('Setting flood water level (4.5 ft)...');
        await runCommand(`dfx canister call oracle manual_update_value '(450)'`); // 4.5 ft * 100
        
        // Verify update
        const floodResult = await runCommand(`dfx canister call oracle get_latest_data`);
        console.log(`Updated water level: ${floodResult.stdout}`);

        return true;
    }

    async testPayoutTrigger() {
        console.log('\n💰 Test 3: Trigger Insurance Payout\n');

        await switchIdentity(TEST_CONFIG.identities.customer1);

        // Check if payout is eligible
        console.log('Checking payout eligibility...');
        const eligibilityResult = await runCommand(`dfx canister call insurance check_payout_eligibility '(principal "${this.principals.customer1}")'`);
        console.log(`Eligibility: ${eligibilityResult.stdout}`);

        // Trigger payout
        console.log('Triggering payout...');
        const payoutResult = await runCommand(`dfx canister call insurance claim_payout`);
        
        if (payoutResult.success && payoutResult.stdout.includes('Ok')) {
            console.log('✅ Payout triggered successfully');
            
            // Check final balance
            const finalBalance = await runCommand(`dfx canister call icrc1_ledger icrc1_balance_of '(record {
                owner = principal "${this.principals.customer1}";
                subaccount = null;
            })'`);
            console.log(`Final balance after payout: ${finalBalance.stdout}`);
            
            return true;
        } else {
            console.log('❌ Failed to trigger payout');
            console.log(`Error: ${payoutResult.stdout || payoutResult.error}`);
            return false;
        }
    }

    async testMultipleCustomers() {
        console.log('\n👥 Test 4: Multiple Customers\n');

        // Customer 2 purchases insurance
        await switchIdentity(TEST_CONFIG.identities.customer2);
        
        console.log('Customer 2 purchasing insurance...');
        const purchase2Result = await runCommand(`dfx canister call insurance purchase_policy '(record {
            coverage_amount = ${TEST_CONFIG.coverage.amount};
        })'`);
        
        if (!purchase2Result.success) {
            console.log('❌ Customer 2 failed to purchase insurance');
            return false;
        }

        // Check all active policies
        await switchIdentity(TEST_CONFIG.identities.admin);
        
        console.log('Fetching all active policies...');
        const policiesResult = await runCommand(`dfx canister call insurance get_all_active_policies`);
        console.log(`Active policies: ${policiesResult.stdout}`);

        return true;
    }

    async testSystemStatus() {
        console.log('\n📊 Test 5: System Status Check\n');

        await switchIdentity(TEST_CONFIG.identities.admin);

        // Check Insurance canister status
        console.log('Insurance canister status:');
        const insuranceStatus = await runCommand(`dfx canister call insurance get_system_status`);
        console.log(insuranceStatus.stdout);

        // Check Oracle canister status
        console.log('\nOracle canister status:');
        const oracleStatus = await runCommand(`dfx canister call oracle get_status`);
        console.log(oracleStatus.stdout);

        // Check Payments canister status
        console.log('\nPayments canister status:');
        const paymentsStatus = await runCommand(`dfx canister call payments getPoolStats`);
        console.log(paymentsStatus.stdout);

        return true;
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...\n');

        // Remove test identities
        for (const identity of Object.values(TEST_CONFIG.identities)) {
            await runCommand(`dfx identity remove ${identity} || true`, true);
        }

        // Stop replica
        await runCommand('dfx stop', true);

        console.log('✅ Cleanup completed');
    }

    async runAllTests() {
        console.log('════════════════════════════════════════════════');
        console.log('   Paramify ICP E2E Test Suite');
        console.log('════════════════════════════════════════════════');

        const results = {
            setup: false,
            purchaseInsurance: false,
            oracleUpdate: false,
            payoutTrigger: false,
            multipleCustomers: false,
            systemStatus: false
        };

        try {
            // Setup
            await this.setup();
            results.setup = true;

            // Run tests
            results.purchaseInsurance = await this.testPurchaseInsurance();
            await delay(2000);
            
            results.oracleUpdate = await this.testOracleUpdate();
            await delay(2000);
            
            results.payoutTrigger = await this.testPayoutTrigger();
            await delay(2000);
            
            results.multipleCustomers = await this.testMultipleCustomers();
            await delay(2000);
            
            results.systemStatus = await this.testSystemStatus();

        } catch (error) {
            console.error('\n❌ Test suite failed with error:');
            console.error(error);
        } finally {
            // Cleanup
            await this.cleanup();
        }

        // Print results summary
        console.log('\n════════════════════════════════════════════════');
        console.log('   Test Results Summary');
        console.log('════════════════════════════════════════════════\n');

        let passed = 0;
        let failed = 0;

        for (const [test, result] of Object.entries(results)) {
            const status = result ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} - ${test}`);
            if (result) passed++; else failed++;
        }

        console.log(`\nTotal: ${passed} passed, ${failed} failed`);
        console.log('════════════════════════════════════════════════\n');

        process.exit(failed > 0 ? 1 : 0);
    }
}

// Run tests
const tester = new ParamifyE2ETests();
tester.runAllTests().catch(console.error);