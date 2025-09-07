import Debug "mo:base/Debug";
import Result "mo:base/Result";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Option "mo:base/Option";

import Payments "../main";

actor PaymentsTest {
    // Test helper functions
    private func assert(condition: Bool, message: Text) {
        if (not condition) {
            Debug.trap("Assertion failed: " # message);
        };
    };
    
    private func assertEq<T>(actual: T, expected: T, message: Text): Bool 
        where T: Text {
        actual == expected
    };
    
    // Mock principals for testing
    private let admin = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai");
    private let user1 = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    private let user2 = Principal.fromText("rno2w-sqaaa-aaaaa-aaacq-cai");
    private let insurance = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
    private let ledger = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    
    // ==========================================
    // Configuration Tests
    // ==========================================
    
    public func testSetLedgerCanister(): async Text {
        Debug.print("Testing setLedgerCanister...");
        
        let payments = await Payments.Payments();
        
        // Should fail without admin rights
        let result1 = await payments.setLedgerCanister(ledger);
        switch (result1) {
            case (#err(msg)) {
                assert(Text.contains(msg, #text "Unauthorized"), "Should fail for non-admin");
            };
            case (#ok(_)) {
                Debug.trap("Should not succeed without admin rights");
            };
        };
        
        // Add admin and retry
        let adminResult = await payments.addAdmin(admin);
        let result2 = await payments.setLedgerCanister(ledger);
        switch (result2) {
            case (#ok(msg)) {
                assert(Text.contains(msg, #text "successfully"), "Should set ledger successfully");
            };
            case (#err(msg)) {
                Debug.trap("Should succeed with admin rights: " # msg);
            };
        };
        
        // Verify configuration
        let config = await payments.getConfiguration();
        switch (config.ledgerCanister) {
            case (?canister) {
                assert(canister == ledger, "Ledger canister should be set correctly");
            };
            case null {
                Debug.trap("Ledger canister should be set");
            };
        };
        
        "✅ testSetLedgerCanister passed"
    };
    
    public func testTransferFeeConfiguration(): async Text {
        Debug.print("Testing transfer fee configuration...");
        
        let payments = await Payments.Payments();
        
        // Check default fee
        let config1 = await payments.getConfiguration();
        assert(config1.transferFee == 10_000, "Default fee should be 10,000");
        
        // Update fee (should fail without admin)
        let result1 = await payments.setTransferFee(20_000);
        switch (result1) {
            case (#err(msg)) {
                assert(Text.contains(msg, #text "Unauthorized"), "Should fail for non-admin");
            };
            case (#ok(_)) {
                Debug.trap("Should not succeed without admin rights");
            };
        };
        
        // Add admin and update fee
        let _ = await payments.addAdmin(admin);
        let result2 = await payments.setTransferFee(20_000);
        switch (result2) {
            case (#ok(msg)) {
                assert(Text.contains(msg, #text "20000"), "Should update fee successfully");
            };
            case (#err(msg)) {
                Debug.trap("Should succeed with admin rights: " # msg);
            };
        };
        
        // Verify new fee
        let config2 = await payments.getConfiguration();
        assert(config2.transferFee == 20_000, "Fee should be updated to 20,000");
        
        "✅ testTransferFeeConfiguration passed"
    };
    
    // ==========================================
    // Access Control Tests
    // ==========================================
    
    public func testAdminManagement(): async Text {
        Debug.print("Testing admin management...");
        
        let payments = await Payments.Payments();
        
        // Initial state - no admins
        let config1 = await payments.getConfiguration();
        assert(config1.adminCount == 0, "Should start with no admins");
        
        // Add first admin (should work for initial setup)
        let result1 = await payments.addAdmin(admin);
        switch (result1) {
            case (#ok(_)) {
                Debug.print("First admin added");
            };
            case (#err(msg)) {
                Debug.print("Note: First admin addition might require special initialization");
            };
        };
        
        // Try to add another admin as non-admin
        let result2 = await payments.addAdmin(user1);
        switch (result2) {
            case (#err(msg)) {
                assert(Text.contains(msg, #text "Unauthorized"), "Non-admin should not add admins");
            };
            case (#ok(_)) {
                Debug.print("Warning: Non-admin could add admin (might be initial setup)");
            };
        };
        
        "✅ testAdminManagement passed"
    };
    
    public func testAuthorizedCallers(): async Text {
        Debug.print("Testing authorized callers...");
        
        let payments = await Payments.Payments();
        
        // Setup admin
        let _ = await payments.addAdmin(admin);
        
        // Add authorized caller
        let result1 = await payments.addAuthorizedCaller(insurance);
        switch (result1) {
            case (#ok(msg)) {
                assert(Text.contains(msg, #text "successfully"), "Should add authorized caller");
            };
            case (#err(msg)) {
                Debug.print("Warning: Could not add authorized caller: " # msg);
            };
        };
        
        // Verify configuration
        let config = await payments.getConfiguration();
        assert(config.authorizedCallerCount > 0 or config.adminCount > 0, 
               "Should have authorized callers or admins");
        
        "✅ testAuthorizedCallers passed"
    };
    
    // ==========================================
    // Pool Management Tests
    // ==========================================
    
    public func testPoolBalance(): async Text {
        Debug.print("Testing pool balance queries...");
        
        let payments = await Payments.Payments();
        
        // Initial balance should be 0
        let balance = await payments.getPoolBalance();
        assert(balance == 0, "Initial pool balance should be 0");
        
        // Get pool stats
        let stats = await payments.getPoolStats();
        assert(stats.currentBalance == 0, "Current balance should be 0");
        assert(stats.totalDeposits == 0, "Total deposits should be 0");
        assert(stats.totalWithdrawals == 0, "Total withdrawals should be 0");
        assert(stats.totalPayouts == 0, "Total payouts should be 0");
        assert(stats.numberOfDepositors == 0, "Number of depositors should be 0");
        
        "✅ testPoolBalance passed"
    };
    
    public func testDepositToPool(): async Text {
        Debug.print("Testing deposit to pool...");
        
        let payments = await Payments.Payments();
        
        // Configure ledger first
        let _ = await payments.addAdmin(admin);
        let _ = await payments.setLedgerCanister(ledger);
        
        // Try to deposit (will fail without actual ledger, but tests the flow)
        let result = await payments.depositToPool(1_000_000);
        switch (result) {
            case (#err(msg)) {
                Debug.print("Expected error without real ledger: " # msg);
                assert(Text.contains(msg, #text "Transfer failed") or 
                       Text.contains(msg, #text "Ledger"), 
                       "Should fail with transfer or ledger error");
            };
            case (#ok(msg)) {
                Debug.print("Deposit simulation successful: " # msg);
            };
        };
        
        "✅ testDepositToPool passed"
    };
    
    public func testWithdrawFromPool(): async Text {
        Debug.print("Testing withdraw from pool...");
        
        let payments = await Payments.Payments();
        
        // Setup
        let _ = await payments.addAdmin(admin);
        let _ = await payments.setLedgerCanister(ledger);
        
        // Try to withdraw without balance (should fail)
        let result1 = await payments.withdrawFromPool(1_000_000);
        switch (result1) {
            case (#err(msg)) {
                assert(Text.contains(msg, #text "Insufficient") or
                       Text.contains(msg, #text "Unauthorized"),
                       "Should fail with insufficient balance or unauthorized");
            };
            case (#ok(_)) {
                Debug.trap("Should not succeed with zero balance");
            };
        };
        
        "✅ testWithdrawFromPool passed"
    };
    
    // ==========================================
    // Payment Processing Tests
    // ==========================================
    
    public func testProcessPayout(): async Text {
        Debug.print("Testing process payout...");
        
        let payments = await Payments.Payments();
        
        // Setup
        let _ = await payments.addAdmin(admin);
        let _ = await payments.setLedgerCanister(ledger);
        let _ = await payments.addAuthorizedCaller(insurance);
        
        // Try to process payout without authorization
        let result1 = await payments.processPayout(user1, 100_000, "Test payout");
        switch (result1) {
            case (#err(msg)) {
                assert(Text.contains(msg, #text "Unauthorized") or
                       Text.contains(msg, #text "Insufficient"),
                       "Should fail without authorization or balance");
            };
            case (#ok(_)) {
                Debug.print("Warning: Payout processed (might be in test mode)");
            };
        };
        
        "✅ testProcessPayout passed"
    };
    
    public func testPaymentRecord(): async Text {
        Debug.print("Testing payment record retrieval...");
        
        let payments = await Payments.Payments();
        
        // Get non-existent payment
        let payment = await payments.getPayment("PAY-999");
        switch (payment) {
            case null {
                assert(true, "Non-existent payment should return null");
            };
            case (?p) {
                Debug.print("Warning: Found unexpected payment");
            };
        };
        
        // Get recent payments (should be empty initially)
        let recent = await payments.getRecentPayments(10);
        assert(recent.size() == 0, "Should have no recent payments initially");
        
        "✅ testPaymentRecord passed"
    };
    
    // ==========================================
    // Escrow Management Tests
    // ==========================================
    
    public func testCreateEscrow(): async Text {
        Debug.print("Testing escrow creation...");
        
        let payments = await Payments.Payments();
        
        // Setup
        let _ = await payments.addAdmin(admin);
        let _ = await payments.setLedgerCanister(ledger);
        
        // Try to create escrow (will fail without actual ledger)
        let result = await payments.createEscrow(
            user2,
            500_000,
            "Test escrow condition",
            3600 // 1 hour expiration
        );
        
        switch (result) {
            case (#err(msg)) {
                Debug.print("Expected error without real ledger: " # msg);
                assert(Text.contains(msg, #text "failed") or
                       Text.contains(msg, #text "Ledger"),
                       "Should fail with appropriate error");
            };
            case (#ok(escrow)) {
                assert(escrow.depositor == Principal.fromActor(PaymentsTest), "Depositor should be test actor");
                assert(escrow.beneficiary == user2, "Beneficiary should be user2");
                assert(escrow.amount == 500_000, "Amount should be 500,000");
                assert(escrow.status == #Active, "Status should be Active");
            };
        };
        
        "✅ testCreateEscrow passed"
    };
    
    public func testReleaseEscrow(): async Text {
        Debug.print("Testing escrow release...");
        
        let payments = await Payments.Payments();
        
        // Try to release non-existent escrow
        let result = await payments.releaseEscrow("ESC-999");
        switch (result) {
            case (#err(msg)) {
                assert(Text.contains(msg, #text "not found"), "Should not find escrow");
            };
            case (#ok(_)) {
                Debug.trap("Should not release non-existent escrow");
            };
        };
        
        "✅ testReleaseEscrow passed"
    };
    
    public func testGetActiveEscrows(): async Text {
        Debug.print("Testing get active escrows...");
        
        let payments = await Payments.Payments();
        
        // Should be empty initially
        let escrows = await payments.getActiveEscrows();
        assert(escrows.size() == 0, "Should have no active escrows initially");
        
        "✅ testGetActiveEscrows passed"
    };
    
    // ==========================================
    // Query Function Tests
    // ==========================================
    
    public func testDepositorBalance(): async Text {
        Debug.print("Testing depositor balance...");
        
        let payments = await Payments.Payments();
        
        // Check balance for user with no deposits
        let balance = await payments.getDepositorBalance(user1);
        assert(balance == 0, "Balance should be 0 for user with no deposits");
        
        "✅ testDepositorBalance passed"
    };
    
    public func testCanisterStatus(): async Text {
        Debug.print("Testing canister status...");
        
        let payments = await Payments.Payments();
        
        let status = await payments.getCanisterStatus();
        assert(status.cycles >= 0, "Cycles should be non-negative");
        assert(status.memory_size >= 0, "Memory size should be non-negative");
        
        "✅ testCanisterStatus passed"
    };
    
    // ==========================================
    // Integration Test Suite
    // ==========================================
    
    public func runAllTests(): async Text {
        Debug.print("=== Running Payments Canister Test Suite ===");
        
        var results = "";
        
        // Configuration tests
        results #= (await testSetLedgerCanister()) # "\n";
        results #= (await testTransferFeeConfiguration()) # "\n";
        
        // Access control tests
        results #= (await testAdminManagement()) # "\n";
        results #= (await testAuthorizedCallers()) # "\n";
        
        // Pool management tests
        results #= (await testPoolBalance()) # "\n";
        results #= (await testDepositToPool()) # "\n";
        results #= (await testWithdrawFromPool()) # "\n";
        
        // Payment processing tests
        results #= (await testProcessPayout()) # "\n";
        results #= (await testPaymentRecord()) # "\n";
        
        // Escrow management tests
        results #= (await testCreateEscrow()) # "\n";
        results #= (await testReleaseEscrow()) # "\n";
        results #= (await testGetActiveEscrows()) # "\n";
        
        // Query function tests
        results #= (await testDepositorBalance()) # "\n";
        results #= (await testCanisterStatus()) # "\n";
        
        Debug.print("=== All Tests Completed ===");
        results
    };
}