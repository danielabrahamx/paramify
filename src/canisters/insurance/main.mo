import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Time "mo:base/Time";
import Result "mo:base/Result";
import HashMap "mo:base/HashMap";
import Buffer "mo:base/Buffer";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Option "mo:base/Option";
import Debug "mo:base/Debug";
import Error "mo:base/Error";

import Oracle "../oracle/oracle";
import Payments "../payments/payments";

// Insurance Canister - Core flood insurance policy management
actor Insurance {
    
    // ============================================
    // Type Definitions
    // ============================================
    
    public type PolicyId = Nat;
    
    public type PolicyStatus = {
        #Active;
        #Expired;
        #PaidOut;
        #Cancelled;
    };
    
    public type Policy = {
        id: PolicyId;
        owner: Principal;
        premium: Nat;           // Amount paid for insurance (in smallest token units)
        coverage: Nat;          // Payout amount if triggered
        startTime: Time.Time;
        expirationTime: Time.Time;
        status: PolicyStatus;
        location: Text;         // USGS site ID
        thresholdFeet: Float;   // Trigger threshold in feet
        paidOutTime: ?Time.Time;
        paidOutAmount: ?Nat;
        transactionId: ?Text;   // Payment transaction ID
    };
    
    public type CreatePolicyRequest = {
        coverage: Nat;
        location: Text;
        durationDays: Nat;
    };
    
    public type CreatePolicyResponse = {
        #Ok: Policy;
        #Err: Text;
    };
    
    public type ClaimPayoutRequest = {
        policyId: PolicyId;
    };
    
    public type ClaimPayoutResponse = {
        #Ok: { 
            policyId: PolicyId; 
            payoutAmount: Nat; 
            transactionId: Text 
        };
        #Err: Text;
    };
    
    public type SystemStatus = {
        totalPolicies: Nat;
        activePolicies: Nat;
        totalPremiumsCollected: Nat;
        totalPayoutsPaid: Nat;
        contractBalance: Nat;
        defaultThresholdFeet: Float;
        premiumPercentage: Nat;
        isPaused: Bool;
    };
    
    // ============================================
    // State Variables
    // ============================================
    
    // Stable storage for upgrade safety
    private stable var nextPolicyId: PolicyId = 1;
    private stable var policiesEntries: [(PolicyId, Policy)] = [];
    private stable var userPoliciesEntries: [(Principal, [PolicyId])] = [];
    private stable var totalPremiumsCollected: Nat = 0;
    private stable var totalPayoutsPaid: Nat = 0;
    private stable var isPaused: Bool = false;
    private stable var defaultThresholdFeet: Float = 3.0;
    private stable var premiumPercentage: Nat = 10; // 10% of coverage
    private stable var maxCoverageAmount: Nat = 1_000_000_000_000; // Max 10,000 tokens (with 8 decimals)
    private stable var minCoverageAmount: Nat = 100_000_000; // Min 1 token
    private stable var controllers: [Principal] = [];
    
    // Non-stable storage (rebuilt from stable on upgrade)
    private var policies = HashMap.HashMap<PolicyId, Policy>(32, Nat.equal, Nat.hash);
    private var userPolicies = HashMap.HashMap<Principal, Buffer.Buffer<PolicyId>>(32, Principal.equal, Principal.hash);
    
    // Canister references (must be updated after deployment)
    private stable var oracleCanisterId: ?Principal = null;
    private stable var paymentsCanisterId: ?Principal = null;
    
    // ============================================
    // System Lifecycle Hooks
    // ============================================
    
    system func preupgrade() {
        policiesEntries := Iter.toArray(policies.entries());
        
        // Convert user policies buffers to arrays
        userPoliciesEntries := Iter.toArray(
            Iter.map<(Principal, Buffer.Buffer<PolicyId>), (Principal, [PolicyId])>(
                userPolicies.entries(),
                func ((principal, buffer)) = (principal, Buffer.toArray(buffer))
            )
        );
    };
    
    system func postupgrade() {
        // Rebuild policies HashMap
        for ((id, policy) in policiesEntries.vals()) {
            policies.put(id, policy);
        };
        policiesEntries := [];
        
        // Rebuild user policies HashMap with Buffers
        for ((principal, policyIds) in userPoliciesEntries.vals()) {
            let buffer = Buffer.Buffer<PolicyId>(policyIds.size());
            for (id in policyIds.vals()) {
                buffer.add(id);
            };
            userPolicies.put(principal, buffer);
        };
        userPoliciesEntries := [];
    };
    
    // ============================================
    // Access Control
    // ============================================
    
    private func isController(caller: Principal): Bool {
        Principal.isController(caller) or 
        Array.find<Principal>(controllers, func(p) = Principal.equal(p, caller)) != null
    };
    
    private func requireController(caller: Principal): Result.Result<(), Text> {
        if (isController(caller)) {
            #ok()
        } else {
            #err("Unauthorized: Caller is not a controller")
        }
    };
    
    private func requireNotPaused(): Result.Result<(), Text> {
        if (not isPaused) {
            #ok()
        } else {
            #err("Contract is paused")
        }
    };
    
    // ============================================
    // Configuration Management
    // ============================================
    
    public shared(msg) func initialize(
        _oracleCanister: Principal,
        _paymentsCanister: Principal,
        _controllers: [Principal]
    ): async Result.Result<Text, Text> {
        switch (requireController(msg.caller)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Can only initialize once
        switch (oracleCanisterId) {
            case (?_) { return #err("Already initialized") };
            case null {};
        };
        
        oracleCanisterId := ?_oracleCanister;
        paymentsCanisterId := ?_paymentsCanister;
        controllers := _controllers;
        
        #ok("Insurance canister initialized successfully")
    };
    
    public shared(msg) func updateThreshold(newThresholdFeet: Float): async Result.Result<Text, Text> {
        switch (requireController(msg.caller)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        if (newThresholdFeet <= 0 or newThresholdFeet > 100) {
            return #err("Threshold must be between 0 and 100 feet");
        };
        
        defaultThresholdFeet := newThresholdFeet;
        #ok("Threshold updated to " # Float.toText(newThresholdFeet) # " feet")
    };
    
    public shared(msg) func updatePremiumPercentage(newPercentage: Nat): async Result.Result<Text, Text> {
        switch (requireController(msg.caller)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        if (newPercentage == 0 or newPercentage > 50) {
            return #err("Premium percentage must be between 1 and 50");
        };
        
        premiumPercentage := newPercentage;
        #ok("Premium percentage updated to " # Nat.toText(newPercentage) # "%")
    };
    
    public shared(msg) func setPaused(paused: Bool): async Result.Result<Text, Text> {
        switch (requireController(msg.caller)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        isPaused := paused;
        #ok("Contract " # (if paused "paused" else "unpaused"))
    };
    
    public shared(msg) func addController(newController: Principal): async Result.Result<Text, Text> {
        switch (requireController(msg.caller)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        let exists = Array.find<Principal>(controllers, func(p) = Principal.equal(p, newController));
        switch (exists) {
            case (?_) { return #err("Controller already exists") };
            case null {
                controllers := Array.append(controllers, [newController]);
                #ok("Controller added")
            };
        };
    };
    
    // ============================================
    // Policy Management
    // ============================================
    
    public shared(msg) func purchasePolicy(request: CreatePolicyRequest): async CreatePolicyResponse {
        switch (requireNotPaused()) {
            case (#err(e)) { return #Err(e) };
            case (#ok()) {};
        };
        
        let caller = msg.caller;
        
        // Validate coverage amount
        if (request.coverage < minCoverageAmount) {
            return #Err("Coverage amount too low. Minimum: " # Nat.toText(minCoverageAmount));
        };
        if (request.coverage > maxCoverageAmount) {
            return #Err("Coverage amount too high. Maximum: " # Nat.toText(maxCoverageAmount));
        };
        
        // Validate duration
        if (request.durationDays == 0 or request.durationDays > 365) {
            return #Err("Duration must be between 1 and 365 days");
        };
        
        // Check for existing active policy
        switch (userPolicies.get(caller)) {
            case (?buffer) {
                for (policyId in buffer.vals()) {
                    switch (policies.get(policyId)) {
                        case (?policy) {
                            if (policy.status == #Active and policy.location == request.location) {
                                return #Err("Active policy already exists for this location");
                            };
                        };
                        case null {};
                    };
                };
            };
            case null {};
        };
        
        // Calculate premium (with overflow protection)
        let premiumAmount = switch (safeMultiply(request.coverage, premiumPercentage)) {
            case (#ok(product)) { product / 100 };
            case (#err(_)) { return #Err("Premium calculation overflow") };
        };
        
        // Process payment
        let paymentsCanister = switch (paymentsCanisterId) {
            case (?id) { id };
            case null { return #Err("Payments canister not initialized") };
        };
        
        let paymentResult = await Payments.processPayment(paymentsCanister, {
            from = caller;
            amount = premiumAmount;
            memo = "Policy premium #" # Nat.toText(nextPolicyId);
        });
        
        switch (paymentResult) {
            case (#Err(e)) { return #Err("Payment failed: " # e) };
            case (#Ok(txId)) {
                // Create policy
                let now = Time.now();
                let expirationTime = now + (request.durationDays * 24 * 60 * 60 * 1_000_000_000);
                
                let policy: Policy = {
                    id = nextPolicyId;
                    owner = caller;
                    premium = premiumAmount;
                    coverage = request.coverage;
                    startTime = now;
                    expirationTime = expirationTime;
                    status = #Active;
                    location = request.location;
                    thresholdFeet = defaultThresholdFeet;
                    paidOutTime = null;
                    paidOutAmount = null;
                    transactionId = ?txId;
                };
                
                // Store policy
                policies.put(nextPolicyId, policy);
                
                // Update user policies
                switch (userPolicies.get(caller)) {
                    case (?buffer) { buffer.add(nextPolicyId) };
                    case null {
                        let buffer = Buffer.Buffer<PolicyId>(1);
                        buffer.add(nextPolicyId);
                        userPolicies.put(caller, buffer);
                    };
                };
                
                // Update statistics
                totalPremiumsCollected := switch (safeAdd(totalPremiumsCollected, premiumAmount)) {
                    case (#ok(sum)) { sum };
                    case (#err(_)) { totalPremiumsCollected }; // Keep old value on overflow
                };
                
                nextPolicyId += 1;
                
                #Ok(policy)
            };
        };
    };
    
    public shared(msg) func claimPayout(request: ClaimPayoutRequest): async ClaimPayoutResponse {
        switch (requireNotPaused()) {
            case (#err(e)) { return #Err(e) };
            case (#ok()) {};
        };
        
        let caller = msg.caller;
        
        // Get policy
        let policy = switch (policies.get(request.policyId)) {
            case (?p) { p };
            case null { return #Err("Policy not found") };
        };
        
        // Verify ownership
        if (not Principal.equal(policy.owner, caller)) {
            return #Err("Unauthorized: Not policy owner");
        };
        
        // Check policy status
        switch (policy.status) {
            case (#Active) {};
            case (#PaidOut) { return #Err("Policy already paid out") };
            case (#Expired) { return #Err("Policy expired") };
            case (#Cancelled) { return #Err("Policy cancelled") };
        };
        
        // Check expiration
        if (Time.now() > policy.expirationTime) {
            // Update status to expired
            let updatedPolicy = {
                policy with status = #Expired
            };
            policies.put(request.policyId, updatedPolicy);
            return #Err("Policy has expired");
        };
        
        // Check flood level from oracle
        let oracleCanister = switch (oracleCanisterId) {
            case (?id) { id };
            case null { return #Err("Oracle canister not initialized") };
        };
        
        let floodData = await Oracle.getLatestData(oracleCanister, policy.location);
        
        switch (floodData) {
            case (#Err(e)) { return #Err("Oracle error: " # e) };
            case (#Ok(data)) {
                // Check if flood level exceeds threshold
                if (data.waterLevelFeet < policy.thresholdFeet) {
                    return #Err("Flood level (" # Float.toText(data.waterLevelFeet) # 
                               " ft) below threshold (" # Float.toText(policy.thresholdFeet) # " ft)");
                };
                
                // Process payout
                let paymentsCanister = switch (paymentsCanisterId) {
                    case (?id) { id };
                    case null { return #Err("Payments canister not initialized") };
                };
                
                let payoutResult = await Payments.processPayout(paymentsCanister, {
                    to = caller;
                    amount = policy.coverage;
                    memo = "Insurance payout for policy #" # Nat.toText(policy.id);
                });
                
                switch (payoutResult) {
                    case (#Err(e)) { return #Err("Payout failed: " # e) };
                    case (#Ok(txId)) {
                        // Update policy status
                        let updatedPolicy = {
                            policy with 
                            status = #PaidOut;
                            paidOutTime = ?Time.now();
                            paidOutAmount = ?policy.coverage;
                        };
                        policies.put(request.policyId, updatedPolicy);
                        
                        // Update statistics
                        totalPayoutsPaid := switch (safeAdd(totalPayoutsPaid, policy.coverage)) {
                            case (#ok(sum)) { sum };
                            case (#err(_)) { totalPayoutsPaid };
                        };
                        
                        #Ok({
                            policyId = request.policyId;
                            payoutAmount = policy.coverage;
                            transactionId = txId;
                        })
                    };
                };
            };
        };
    };
    
    public shared(msg) func cancelPolicy(policyId: PolicyId): async Result.Result<Text, Text> {
        let caller = msg.caller;
        
        let policy = switch (policies.get(policyId)) {
            case (?p) { p };
            case null { return #err("Policy not found") };
        };
        
        // Verify ownership or controller
        if (not (Principal.equal(policy.owner, caller) or isController(caller))) {
            return #err("Unauthorized");
        };
        
        if (policy.status != #Active) {
            return #err("Can only cancel active policies");
        };
        
        // Calculate refund if within grace period (7 days)
        let gracePeriod = 7 * 24 * 60 * 60 * 1_000_000_000; // 7 days in nanoseconds
        let now = Time.now();
        var refundAmount: Nat = 0;
        
        if (now < policy.startTime + gracePeriod) {
            // Pro-rated refund
            let elapsedTime = Int.abs(now - policy.startTime);
            let totalDuration = Int.abs(policy.expirationTime - policy.startTime);
            let remainingRatio = (totalDuration - elapsedTime) * 100 / totalDuration;
            refundAmount := policy.premium * Int.abs(remainingRatio) / 100;
            
            // Process refund
            if (refundAmount > 0) {
                let paymentsCanister = switch (paymentsCanisterId) {
                    case (?id) { id };
                    case null { return #err("Payments canister not initialized") };
                };
                
                let refundResult = await Payments.processPayout(paymentsCanister, {
                    to = policy.owner;
                    amount = refundAmount;
                    memo = "Refund for cancelled policy #" # Nat.toText(policyId);
                });
                
                switch (refundResult) {
                    case (#Err(e)) { return #err("Refund failed: " # e) };
                    case (#Ok(_)) {};
                };
            };
        };
        
        // Update policy status
        let updatedPolicy = {
            policy with status = #Cancelled
        };
        policies.put(policyId, updatedPolicy);
        
        #ok("Policy cancelled" # (if (refundAmount > 0) " with refund of " # Nat.toText(refundAmount) else ""))
    };
    
    // ============================================
    // Query Functions
    // ============================================
    
    public query func getPolicy(policyId: PolicyId): async ?Policy {
        policies.get(policyId)
    };
    
    public query func getUserPolicies(user: Principal): async [Policy] {
        switch (userPolicies.get(user)) {
            case (?buffer) {
                let policies_array = Buffer.Buffer<Policy>(buffer.size());
                for (id in buffer.vals()) {
                    switch (policies.get(id)) {
                        case (?policy) { policies_array.add(policy) };
                        case null {};
                    };
                };
                Buffer.toArray(policies_array)
            };
            case null { [] };
        }
    };
    
    public query func getActivePolicies(): async [Policy] {
        let activePolicies = Buffer.Buffer<Policy>(policies.size());
        for ((_, policy) in policies.entries()) {
            if (policy.status == #Active) {
                activePolicies.add(policy);
            };
        };
        Buffer.toArray(activePolicies)
    };
    
    public query func checkEligibility(policyId: PolicyId): async Result.Result<Bool, Text> {
        let policy = switch (policies.get(policyId)) {
            case (?p) { p };
            case null { return #err("Policy not found") };
        };
        
        if (policy.status != #Active) {
            return #ok(false);
        };
        
        if (Time.now() > policy.expirationTime) {
            return #ok(false);
        };
        
        // Would need to check oracle data in update call
        #ok(true)
    };
    
    public query func getSystemStatus(): async SystemStatus {
        let activePoliciesCount = Array.size(
            Array.filter<(PolicyId, Policy)>(
                Iter.toArray(policies.entries()),
                func((_, p)) = p.status == #Active
            )
        );
        
        {
            totalPolicies = policies.size();
            activePolicies = activePoliciesCount;
            totalPremiumsCollected = totalPremiumsCollected;
            totalPayoutsPaid = totalPayoutsPaid;
            contractBalance = 0; // Would need to query payments canister
            defaultThresholdFeet = defaultThresholdFeet;
            premiumPercentage = premiumPercentage;
            isPaused = isPaused;
        }
    };
    
    public query func getConfiguration(): async {
        defaultThresholdFeet: Float;
        premiumPercentage: Nat;
        maxCoverageAmount: Nat;
        minCoverageAmount: Nat;
        isPaused: Bool;
        controllers: [Principal];
    } {
        {
            defaultThresholdFeet = defaultThresholdFeet;
            premiumPercentage = premiumPercentage;
            maxCoverageAmount = maxCoverageAmount;
            minCoverageAmount = minCoverageAmount;
            isPaused = isPaused;
            controllers = controllers;
        }
    };
    
    // ============================================
    // Helper Functions
    // ============================================
    
    private func safeAdd(a: Nat, b: Nat): Result.Result<Nat, Text> {
        let max = 2**64 - 1;
        if (a > max - b) {
            #err("Addition overflow")
        } else {
            #ok(a + b)
        }
    };
    
    private func safeMultiply(a: Nat, b: Nat): Result.Result<Nat, Text> {
        if (b == 0) { return #ok(0) };
        let max = 2**64 - 1;
        if (a > max / b) {
            #err("Multiplication overflow")
        } else {
            #ok(a * b)
        }
    };
    
    // ============================================
    // Upgrade Functions
    // ============================================
    
    public query func getVersion(): async Text {
        "2.0.0"
    };
    
    public shared(msg) func exportState(): async Result.Result<Text, Text> {
        switch (requireController(msg.caller)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Export state for backup
        #ok("State exported: " # Nat.toText(policies.size()) # " policies")
    };
}