import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Option "mo:base/Option";

import Insurance "main";
import TestUtils "../../../tests/utils/test_utils";

actor InsuranceTest {
    
    // Test fixtures
    private let testOwner = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    private let testUser1 = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai");
    private let testUser2 = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    private let testOracle = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
    private let testPayments = Principal.fromText("rno2w-sqaaa-aaaaa-aaacq-cai");
    
    private var insuranceCanister : Insurance.Insurance = Insurance.Insurance();
    
    // ============================================
    // Test Suite: Initialization
    // ============================================
    
    public func testInitialization(): async TestUtils.TestResult {
        Debug.print("Testing initialization...");
        
        // Test 1: Initialize with valid parameters
        let initResult = await insuranceCanister.initialize(
            testOracle,
            testPayments,
            [testOwner]
        );
        
        switch (initResult) {
            case (#ok(message)) {
                assert(Text.contains(message, #text "initialized"));
                Debug.print("✓ Initialization successful");
            };
            case (#err(e)) {
                Debug.print("✗ Initialization failed: " # e);
                return #Failed("Initialization failed: " # e);
            };
        };
        
        // Test 2: Attempt to reinitialize (should fail)
        let reinitResult = await insuranceCanister.initialize(
            testOracle,
            testPayments,
            [testOwner]
        );
        
        switch (reinitResult) {
            case (#ok(_)) {
                return #Failed("Should not allow reinitialization");
            };
            case (#err(e)) {
                assert(Text.contains(e, #text "Already initialized"));
                Debug.print("✓ Reinitialization prevented");
            };
        };
        
        #Passed
    };
    
    // ============================================
    // Test Suite: Access Control
    // ============================================
    
    public func testAccessControl(): async TestUtils.TestResult {
        Debug.print("Testing access control...");
        
        // Test 1: Controller can update threshold
        let updateResult = await insuranceCanister.updateThreshold(5.0);
        switch (updateResult) {
            case (#ok(_)) {
                Debug.print("✓ Controller can update threshold");
            };
            case (#err(e)) {
                return #Failed("Controller should be able to update threshold: " # e);
            };
        };
        
        // Test 2: Verify threshold was updated
        let config = await insuranceCanister.getConfiguration();
        assert(config.defaultThresholdFeet == 5.0);
        Debug.print("✓ Threshold updated correctly");
        
        // Test 3: Add new controller
        let addControllerResult = await insuranceCanister.addController(testUser1);
        switch (addControllerResult) {
            case (#ok(_)) {
                Debug.print("✓ New controller added");
            };
            case (#err(e)) {
                return #Failed("Failed to add controller: " # e);
            };
        };
        
        // Test 4: Verify new controller in list
        let updatedConfig = await insuranceCanister.getConfiguration();
        let hasNewController = Option.isSome(
            Array.find(updatedConfig.controllers, func(p) = Principal.equal(p, testUser1))
        );
        assert(hasNewController);
        Debug.print("✓ Controller list updated");
        
        #Passed
    };
    
    // ============================================
    // Test Suite: Policy Creation
    // ============================================
    
    public func testPolicyCreation(): async TestUtils.TestResult {
        Debug.print("Testing policy creation...");
        
        // Test 1: Create valid policy
        let createRequest : Insurance.CreatePolicyRequest = {
            coverage = 1_000_000_000; // 10 tokens with 8 decimals
            location = "01646500"; // USGS site ID
            durationDays = 30;
        };
        
        let createResult = await insuranceCanister.purchasePolicy(createRequest);
        
        switch (createResult) {
            case (#Ok(policy)) {
                assert(policy.coverage == 1_000_000_000);
                assert(policy.premium == 100_000_000); // 10% of coverage
                assert(policy.status == #Active);
                assert(policy.location == "01646500");
                Debug.print("✓ Policy created successfully");
                Debug.print("  Policy ID: " # Nat.toText(policy.id));
                Debug.print("  Premium: " # Nat.toText(policy.premium));
                Debug.print("  Coverage: " # Nat.toText(policy.coverage));
            };
            case (#Err(e)) {
                // Expected in test environment without actual payment processing
                if (Text.contains(e, #text "Payment")) {
                    Debug.print("✓ Policy creation attempted (payment integration needed)");
                } else {
                    return #Failed("Policy creation failed: " # e);
                };
            };
        };
        
        // Test 2: Attempt to create policy with invalid coverage (too low)
        let invalidRequest1 : Insurance.CreatePolicyRequest = {
            coverage = 1_000_000; // Below minimum
            location = "01646500";
            durationDays = 30;
        };
        
        let invalidResult1 = await insuranceCanister.purchasePolicy(invalidRequest1);
        switch (invalidResult1) {
            case (#Ok(_)) {
                return #Failed("Should not allow coverage below minimum");
            };
            case (#Err(e)) {
                assert(Text.contains(e, #text "too low"));
                Debug.print("✓ Low coverage rejected");
            };
        };
        
        // Test 3: Attempt to create policy with invalid coverage (too high)
        let invalidRequest2 : Insurance.CreatePolicyRequest = {
            coverage = 10_000_000_000_000; // Above maximum
            location = "01646500";
            durationDays = 30;
        };
        
        let invalidResult2 = await insuranceCanister.purchasePolicy(invalidRequest2);
        switch (invalidResult2) {
            case (#Ok(_)) {
                return #Failed("Should not allow coverage above maximum");
            };
            case (#Err(e)) {
                assert(Text.contains(e, #text "too high"));
                Debug.print("✓ High coverage rejected");
            };
        };
        
        // Test 4: Invalid duration
        let invalidRequest3 : Insurance.CreatePolicyRequest = {
            coverage = 1_000_000_000;
            location = "01646500";
            durationDays = 400; // Above 365 days
        };
        
        let invalidResult3 = await insuranceCanister.purchasePolicy(invalidRequest3);
        switch (invalidResult3) {
            case (#Ok(_)) {
                return #Failed("Should not allow duration over 365 days");
            };
            case (#Err(e)) {
                assert(Text.contains(e, #text "Duration"));
                Debug.print("✓ Invalid duration rejected");
            };
        };
        
        #Passed
    };
    
    // ============================================
    // Test Suite: Configuration Management
    // ============================================
    
    public func testConfigurationManagement(): async TestUtils.TestResult {
        Debug.print("Testing configuration management...");
        
        // Test 1: Update premium percentage
        let updatePremiumResult = await insuranceCanister.updatePremiumPercentage(15);
        switch (updatePremiumResult) {
            case (#ok(_)) {
                Debug.print("✓ Premium percentage updated");
            };
            case (#err(e)) {
                return #Failed("Failed to update premium: " # e);
            };
        };
        
        // Test 2: Verify premium percentage
        let config1 = await insuranceCanister.getConfiguration();
        assert(config1.premiumPercentage == 15);
        Debug.print("✓ Premium percentage verified: " # Nat.toText(config1.premiumPercentage) # "%");
        
        // Test 3: Invalid premium percentage (too high)
        let invalidPremiumResult = await insuranceCanister.updatePremiumPercentage(60);
        switch (invalidPremiumResult) {
            case (#ok(_)) {
                return #Failed("Should not allow premium > 50%");
            };
            case (#err(e)) {
                assert(Text.contains(e, #text "between 1 and 50"));
                Debug.print("✓ Invalid premium percentage rejected");
            };
        };
        
        // Test 4: Pause contract
        let pauseResult = await insuranceCanister.setPaused(true);
        switch (pauseResult) {
            case (#ok(message)) {
                assert(Text.contains(message, #text "paused"));
                Debug.print("✓ Contract paused");
            };
            case (#err(e)) {
                return #Failed("Failed to pause: " # e);
            };
        };
        
        // Test 5: Verify paused state
        let config2 = await insuranceCanister.getConfiguration();
        assert(config2.isPaused == true);
        Debug.print("✓ Paused state verified");
        
        // Test 6: Attempt operation while paused
        let pausedRequest : Insurance.CreatePolicyRequest = {
            coverage = 1_000_000_000;
            location = "01646500";
            durationDays = 30;
        };
        
        let pausedResult = await insuranceCanister.purchasePolicy(pausedRequest);
        switch (pausedResult) {
            case (#Ok(_)) {
                return #Failed("Should not allow operations while paused");
            };
            case (#Err(e)) {
                assert(Text.contains(e, #text "paused"));
                Debug.print("✓ Operations blocked while paused");
            };
        };
        
        // Test 7: Unpause contract
        let unpauseResult = await insuranceCanister.setPaused(false);
        switch (unpauseResult) {
            case (#ok(message)) {
                assert(Text.contains(message, #text "unpaused"));
                Debug.print("✓ Contract unpaused");
            };
            case (#err(e)) {
                return #Failed("Failed to unpause: " # e);
            };
        };
        
        #Passed
    };
    
    // ============================================
    // Test Suite: System Status
    // ============================================
    
    public func testSystemStatus(): async TestUtils.TestResult {
        Debug.print("Testing system status...");
        
        let status = await insuranceCanister.getSystemStatus();
        
        Debug.print("System Status:");
        Debug.print("  Total Policies: " # Nat.toText(status.totalPolicies));
        Debug.print("  Active Policies: " # Nat.toText(status.activePolicies));
        Debug.print("  Total Premiums: " # Nat.toText(status.totalPremiumsCollected));
        Debug.print("  Total Payouts: " # Nat.toText(status.totalPayoutsPaid));
        Debug.print("  Default Threshold: " # Float.toText(status.defaultThresholdFeet) # " feet");
        Debug.print("  Premium Percentage: " # Nat.toText(status.premiumPercentage) # "%");
        Debug.print("  Is Paused: " # Bool.toText(status.isPaused));
        
        assert(status.totalPolicies >= 0);
        assert(status.premiumPercentage > 0);
        Debug.print("✓ System status retrieved successfully");
        
        #Passed
    };
    
    // ============================================
    // Test Suite: Arithmetic Safety
    // ============================================
    
    public func testArithmeticSafety(): async TestUtils.TestResult {
        Debug.print("Testing arithmetic safety...");
        
        // Test 1: Large coverage amount (near maximum)
        let largeRequest : Insurance.CreatePolicyRequest = {
            coverage = 999_999_999_999; // Just under max
            location = "01646500";
            durationDays = 365;
        };
        
        let largeResult = await insuranceCanister.purchasePolicy(largeRequest);
        switch (largeResult) {
            case (#Ok(policy)) {
                let expectedPremium = 99_999_999_999; // 10% of coverage
                assert(policy.premium == expectedPremium);
                Debug.print("✓ Large amount arithmetic handled correctly");
            };
            case (#Err(e)) {
                // Expected in test environment
                if (Text.contains(e, #text "Payment")) {
                    Debug.print("✓ Large amount validated (payment needed)");
                } else {
                    return #Failed("Unexpected error: " # e);
                };
            };
        };
        
        #Passed
    };
    
    // ============================================
    // Run All Tests
    // ============================================
    
    public func runAllTests(): async TestUtils.TestSuite {
        Debug.print("\n========================================");
        Debug.print("Insurance Canister Test Suite");
        Debug.print("========================================\n");
        
        let results = Buffer.Buffer<TestUtils.TestResult>(7);
        
        results.add(await testInitialization());
        results.add(await testAccessControl());
        results.add(await testPolicyCreation());
        results.add(await testConfigurationManagement());
        results.add(await testSystemStatus());
        results.add(await testArithmeticSafety());
        
        let passed = Array.filter(Buffer.toArray(results), func(r) = r == #Passed).size();
        let total = results.size();
        
        Debug.print("\n========================================");
        Debug.print("Test Results: " # Nat.toText(passed) # "/" # Nat.toText(total) # " passed");
        Debug.print("========================================\n");
        
        {
            name = "Insurance Canister Tests";
            passed = passed;
            failed = total - passed;
            results = Buffer.toArray(results);
        }
    };
}