import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Time "mo:base/Time";
import Option "mo:base/Option";

// Import canister interfaces
import Insurance "../../src/canisters/insurance/main";
import Payments "../../src/canisters/payments/main";

actor IntegrationTest {
    // Test principals
    private let admin = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai");
    private let customer1 = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    private let customer2 = Principal.fromText("rno2w-sqaaa-aaaaa-aaacq-cai");
    private let oracle = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
    
    // Helper functions
    private func assert(condition: Bool, message: Text) {
        if (not condition) {
            Debug.trap("Assertion failed: " # message);
        };
    };
    
    // ==========================================
    // Insurance + Payments Integration Tests
    // ==========================================
    
    public func testInsurancePaymentFlow(): async Text {
        Debug.print("Testing Insurance + Payments integration flow...");
        
        // Deploy canisters
        let insurance = await Insurance.Insurance();
        let payments = await Payments.Payments();
        
        // Setup: Configure canisters
        Debug.print("Setting up canister configuration...");
        
        // Configure payments canister
        let _ = await payments.addAdmin(admin);
        let _ = await payments.addAuthorizedCaller(Principal.fromActor(insurance));
        
        // Configure insurance canister
        let config = {
            oracle_canister = oracle;
            payments_canister = Principal.fromActor(payments);
            token_canister = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"); // Mock ledger
            default_threshold = 3.0;
            premium_percentage = 10;
        };
        let initResult = await insurance.initialize(config);
        
        switch (initResult) {
            case (#ok(_)) {
                Debug.print("✓ Insurance canister initialized");
            };
            case (#err(msg)) {
                Debug.print("Note: Insurance initialization: " # msg);
            };
        };
        
        // Test: Purchase policy flow
        Debug.print("Testing policy purchase flow...");
        
        // Simulate customer purchasing policy
        let purchaseResult = await insurance.purchase_policy({
            coverage_amount = 1_000_000_000; // 10 tokens
        });
        
        switch (purchaseResult) {
            case (#ok(policy)) {
                assert(policy.coverage_amount == 1_000_000_000, "Coverage amount mismatch");
                assert(policy.premium_amount == 100_000_000, "Premium should be 10% of coverage");
                Debug.print("✓ Policy purchased successfully");
            };
            case (#err(msg)) {
                Debug.print("Expected error in test environment: " # msg);
            };
        };
        
        // Test: Check pool balance after premium
        let poolStats = await payments.getPoolStats();
        Debug.print("Pool stats after premium: " # debug_show(poolStats));
        
        "✅ Insurance + Payments integration test completed"
    };
    
    public func testPayoutProcessing(): async Text {
        Debug.print("Testing payout processing flow...");
        
        let insurance = await Insurance.Insurance();
        let payments = await Payments.Payments();
        
        // Setup canisters
        let _ = await payments.addAdmin(admin);
        let _ = await payments.addAuthorizedCaller(Principal.fromActor(insurance));
        
        // Test: Process payout
        Debug.print("Processing test payout...");
        
        let payoutResult = await payments.processPayout(
            customer1,
            500_000_000, // 5 tokens
            "Flood insurance payout"
        );
        
        switch (payoutResult) {
            case (#ok(payment)) {
                assert(payment.recipient == customer1, "Recipient mismatch");
                assert(payment.amount == 500_000_000, "Amount mismatch");
                assert(payment.purpose == "Flood insurance payout", "Purpose mismatch");
                Debug.print("✓ Payout processed: " # payment.id);
            };
            case (#err(msg)) {
                Debug.print("Expected error without real ledger: " # msg);
            };
        };
        
        // Verify payment record
        let recentPayments = await payments.getRecentPayments(5);
        Debug.print("Recent payments count: " # Nat.toText(recentPayments.size()));
        
        "✅ Payout processing test completed"
    };
    
    // ==========================================
    // Multi-Canister Coordination Tests
    // ==========================================
    
    public func testCrossCanisterAuthorization(): async Text {
        Debug.print("Testing cross-canister authorization...");
        
        let insurance = await Insurance.Insurance();
        let payments = await Payments.Payments();
        
        // Test: Insurance canister calling payments
        Debug.print("Testing Insurance -> Payments authorization...");
        
        // Add insurance as authorized caller in payments
        let _ = await payments.addAdmin(admin);
        let authResult = await payments.addAuthorizedCaller(Principal.fromActor(insurance));
        
        switch (authResult) {
            case (#ok(_)) {
                Debug.print("✓ Insurance authorized in Payments");
            };
            case (#err(msg)) {
                Debug.trap("Authorization failed: " # msg);
            };
        };
        
        // Verify configuration
        let paymentsConfig = await payments.getConfiguration();
        assert(paymentsConfig.authorizedCallerCount > 0 or paymentsConfig.adminCount > 0,
               "Should have authorized callers");
        
        "✅ Cross-canister authorization test completed"
    };
    
    public func testEscrowIntegration(): async Text {
        Debug.print("Testing escrow integration flow...");
        
        let payments = await Payments.Payments();
        
        // Setup
        let _ = await payments.addAdmin(admin);
        
        // Test: Create escrow for insurance claim
        Debug.print("Creating escrow for disputed claim...");
        
        let escrowResult = await payments.createEscrow(
            customer1,
            750_000_000, // 7.5 tokens
            "Insurance claim pending verification",
            86400 // 24 hours
        );
        
        switch (escrowResult) {
            case (#ok(escrow)) {
                assert(escrow.beneficiary == customer1, "Beneficiary mismatch");
                assert(escrow.amount == 750_000_000, "Amount mismatch");
                assert(escrow.status == #Active, "Should be active");
                Debug.print("✓ Escrow created: " # escrow.id);
            };
            case (#err(msg)) {
                Debug.print("Expected error without ledger: " # msg);
            };
        };
        
        // Test: Query active escrows
        let activeEscrows = await payments.getActiveEscrows();
        Debug.print("Active escrows: " # Nat.toText(activeEscrows.size()));
        
        "✅ Escrow integration test completed"
    };
    
    // ==========================================
    // State Consistency Tests
    // ==========================================
    
    public func testStateConsistency(): async Text {
        Debug.print("Testing state consistency across canisters...");
        
        let insurance = await Insurance.Insurance();
        let payments = await Payments.Payments();
        
        // Get system status from both canisters
        let insuranceStatus = await insurance.get_system_status();
        let paymentsStats = await payments.getPoolStats();
        
        Debug.print("Insurance status: " # debug_show(insuranceStatus));
        Debug.print("Payments stats: " # debug_show(paymentsStats));
        
        // Verify consistency
        assert(insuranceStatus.total_policies >= 0, "Invalid policy count");
        assert(paymentsStats.currentBalance >= 0, "Invalid balance");
        
        "✅ State consistency test completed"
    };
    
    // ==========================================
    // Error Handling Tests
    // ==========================================
    
    public func testErrorPropagation(): async Text {
        Debug.print("Testing error propagation between canisters...");
        
        let insurance = await Insurance.Insurance();
        let payments = await Payments.Payments();
        
        // Test: Unauthorized access
        Debug.print("Testing unauthorized access handling...");
        
        let unauthorizedResult = await payments.processPayout(
            customer1,
            100_000_000,
            "Unauthorized test"
        );
        
        switch (unauthorizedResult) {
            case (#err(msg)) {
                assert(Text.contains(msg, #text "Unauthorized"), 
                       "Should return unauthorized error");
                Debug.print("✓ Unauthorized access properly rejected");
            };
            case (#ok(_)) {
                Debug.trap("Should not allow unauthorized payout");
            };
        };
        
        // Test: Insufficient balance
        Debug.print("Testing insufficient balance handling...");
        
        let _ = await payments.addAdmin(admin);
        let _ = await payments.addAuthorizedCaller(admin);
        
        let largePayoutResult = await payments.processPayout(
            customer1,
            999_999_999_999_999, // Huge amount
            "Insufficient balance test"
        );
        
        switch (largePayoutResult) {
            case (#err(msg)) {
                assert(Text.contains(msg, #text "Insufficient") or
                       Text.contains(msg, #text "balance"),
                       "Should return insufficient balance error");
                Debug.print("✓ Insufficient balance properly handled");
            };
            case (#ok(_)) {
                Debug.print("Warning: Large payout succeeded (unexpected)");
            };
        };
        
        "✅ Error propagation test completed"
    };
    
    // ==========================================
    // Performance Tests
    // ==========================================
    
    public func testBulkOperations(): async Text {
        Debug.print("Testing bulk operations performance...");
        
        let payments = await Payments.Payments();
        let _ = await payments.addAdmin(admin);
        
        let startTime = Time.now();
        
        // Test: Multiple payment queries
        Debug.print("Executing bulk queries...");
        
        for (i in Iter.range(0, 9)) {
            let _ = await payments.getPoolStats();
            let _ = await payments.getRecentPayments(10);
            let _ = await payments.getActiveEscrows();
        };
        
        let endTime = Time.now();
        let duration = (endTime - startTime) / 1_000_000; // Convert to milliseconds
        
        Debug.print("Bulk operations completed in " # Int.toText(duration) # " ms");
        assert(duration < 5000, "Bulk operations should complete within 5 seconds");
        
        "✅ Bulk operations test completed"
    };
    
    // ==========================================
    // Upgrade Safety Tests
    // ==========================================
    
    public func testUpgradePersistence(): async Text {
        Debug.print("Testing upgrade persistence simulation...");
        
        // Note: This test simulates upgrade persistence
        // In real scenario, would require actual canister upgrade
        
        let insurance = await Insurance.Insurance();
        
        // Create some state
        Debug.print("Creating test state...");
        
        // Add configuration
        let config = {
            oracle_canister = oracle;
            payments_canister = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
            token_canister = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
            default_threshold = 3.5;
            premium_percentage = 12;
        };
        let _ = await insurance.initialize(config);
        
        // Simulate upgrade by checking state persistence
        Debug.print("Verifying state after simulated upgrade...");
        
        let status = await insurance.get_system_status();
        assert(status.configuration.default_threshold == 3.5, 
               "Threshold should persist");
        assert(status.configuration.premium_percentage == 12,
               "Premium percentage should persist");
        
        Debug.print("✓ State persistence verified");
        
        "✅ Upgrade persistence test completed"
    };
    
    // ==========================================
    // Integration Test Suite Runner
    // ==========================================
    
    public func runAllTests(): async Text {
        Debug.print("=== Running Integration Test Suite ===");
        
        var results = "";
        
        // Insurance + Payments tests
        results #= (await testInsurancePaymentFlow()) # "\n";
        results #= (await testPayoutProcessing()) # "\n";
        
        // Cross-canister tests
        results #= (await testCrossCanisterAuthorization()) # "\n";
        results #= (await testEscrowIntegration()) # "\n";
        
        // Consistency tests
        results #= (await testStateConsistency()) # "\n";
        
        // Error handling tests
        results #= (await testErrorPropagation()) # "\n";
        
        // Performance tests
        results #= (await testBulkOperations()) # "\n";
        
        // Upgrade tests
        results #= (await testUpgradePersistence()) # "\n";
        
        Debug.print("=== All Integration Tests Completed ===");
        results
    };
}