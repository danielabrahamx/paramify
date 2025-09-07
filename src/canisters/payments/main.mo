import Principal "mo:base/Principal";
import Result "mo:base/Result";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Option "mo:base/Option";
import Timer "mo:base/Timer";
import Blob "mo:base/Blob";

// ICRC-1 Token Standard Interface
import ICRC1 "mo:icrc1/ICRC1";

actor Payments {
    // ==========================================
    // Types and Constants
    // ==========================================
    
    private type TokenAmount = Nat;
    private type Timestamp = Int;
    private type TxIndex = Nat;
    
    // ICRC-1 Types
    private type Account = {
        owner: Principal;
        subaccount: ?Blob;
    };
    
    private type TransferArg = {
        from_subaccount: ?Blob;
        to: Account;
        amount: Nat;
        fee: ?Nat;
        memo: ?Blob;
        created_at_time: ?Nat64;
    };
    
    private type TransferResult = {
        #Ok: Nat;
        #Err: TransferError;
    };
    
    private type TransferError = {
        #BadFee: { expected_fee: Nat };
        #BadBurn: { min_burn_amount: Nat };
        #InsufficientFunds: { balance: Nat };
        #TooOld;
        #CreatedInFuture: { ledger_time: Nat64 };
        #Duplicate: { duplicate_of: Nat };
        #TemporarilyUnavailable;
        #GenericError: { error_code: Nat; message: Text };
    };
    
    // Payment Types
    public type PaymentStatus = {
        #Pending;
        #Completed;
        #Failed;
        #Refunded;
    };
    
    public type PaymentRecord = {
        id: Text;
        payer: Principal;
        recipient: Principal;
        amount: TokenAmount;
        fee: TokenAmount;
        purpose: Text;
        status: PaymentStatus;
        timestamp: Timestamp;
        txIndex: ?TxIndex;
        errorMessage: ?Text;
    };
    
    public type EscrowRecord = {
        id: Text;
        depositor: Principal;
        beneficiary: Principal;
        amount: TokenAmount;
        condition: Text;
        status: EscrowStatus;
        createdAt: Timestamp;
        releasedAt: ?Timestamp;
        expiresAt: Timestamp;
    };
    
    public type EscrowStatus = {
        #Active;
        #Released;
        #Refunded;
        #Expired;
    };
    
    public type PoolStats = {
        totalDeposits: TokenAmount;
        totalWithdrawals: TokenAmount;
        totalPayouts: TokenAmount;
        currentBalance: TokenAmount;
        numberOfDepositors: Nat;
        lastUpdated: Timestamp;
    };
    
    // ==========================================
    // State Variables
    // ==========================================
    
    // Stable storage for upgrade persistence
    private stable var paymentEntries: [(Text, PaymentRecord)] = [];
    private stable var escrowEntries: [(Text, EscrowRecord)] = [];
    private stable var poolBalance: TokenAmount = 0;
    private stable var totalDeposits: TokenAmount = 0;
    private stable var totalWithdrawals: TokenAmount = 0;
    private stable var totalPayouts: TokenAmount = 0;
    private stable var paymentCounter: Nat = 0;
    private stable var escrowCounter: Nat = 0;
    private stable var adminPrincipals: [Principal] = [];
    private stable var authorizedCallers: [Principal] = [];
    private stable var ledgerCanisterId: ?Principal = null;
    private stable var transferFee: TokenAmount = 10_000; // 0.0001 tokens
    
    // Runtime state
    private var payments = HashMap.HashMap<Text, PaymentRecord>(10, Text.equal, Text.hash);
    private var escrows = HashMap.HashMap<Text, EscrowRecord>(10, Text.equal, Text.hash);
    private var depositorBalances = HashMap.HashMap<Principal, TokenAmount>(10, Principal.equal, Principal.hash);
    
    // ==========================================
    // Initialization and Upgrade Hooks
    // ==========================================
    
    system func preupgrade() {
        Debug.print("Payments canister: Starting pre-upgrade...");
        paymentEntries := Iter.toArray(payments.entries());
        escrowEntries := Iter.toArray(escrows.entries());
        Debug.print("Payments canister: Pre-upgrade completed. Saved " # Nat.toText(paymentEntries.size()) # " payments and " # Nat.toText(escrowEntries.size()) # " escrows.");
    };
    
    system func postupgrade() {
        Debug.print("Payments canister: Starting post-upgrade...");
        payments := HashMap.fromIter<Text, PaymentRecord>(paymentEntries.vals(), paymentEntries.size(), Text.equal, Text.hash);
        escrows := HashMap.fromIter<Text, EscrowRecord>(escrowEntries.vals(), escrowEntries.size(), Text.equal, Text.hash);
        paymentEntries := [];
        escrowEntries := [];
        Debug.print("Payments canister: Post-upgrade completed.");
    };
    
    // ==========================================
    // Access Control
    // ==========================================
    
    private func isAdmin(caller: Principal): Bool {
        Array.find<Principal>(adminPrincipals, func(p) = p == caller) != null
    };
    
    private func isAuthorized(caller: Principal): Bool {
        isAdmin(caller) or (Array.find<Principal>(authorizedCallers, func(p) = p == caller) != null)
    };
    
    public shared(msg) func addAdmin(principal: Principal): async Result.Result<Text, Text> {
        if (not isAdmin(msg.caller)) {
            return #err("Unauthorized: Only admins can add other admins");
        };
        
        let adminsBuffer = Buffer.fromArray<Principal>(adminPrincipals);
        adminsBuffer.add(principal);
        adminPrincipals := Buffer.toArray(adminsBuffer);
        
        #ok("Admin added successfully")
    };
    
    public shared(msg) func addAuthorizedCaller(principal: Principal): async Result.Result<Text, Text> {
        if (not isAdmin(msg.caller)) {
            return #err("Unauthorized: Only admins can add authorized callers");
        };
        
        let callersBuffer = Buffer.fromArray<Principal>(authorizedCallers);
        callersBuffer.add(principal);
        authorizedCallers := Buffer.toArray(callersBuffer);
        
        #ok("Authorized caller added successfully")
    };
    
    // ==========================================
    // Configuration
    // ==========================================
    
    public shared(msg) func setLedgerCanister(canisterId: Principal): async Result.Result<Text, Text> {
        if (not isAdmin(msg.caller)) {
            return #err("Unauthorized: Only admins can set ledger canister");
        };
        
        ledgerCanisterId := ?canisterId;
        #ok("Ledger canister ID set successfully")
    };
    
    public shared(msg) func setTransferFee(fee: TokenAmount): async Result.Result<Text, Text> {
        if (not isAdmin(msg.caller)) {
            return #err("Unauthorized: Only admins can set transfer fee");
        };
        
        transferFee := fee;
        #ok("Transfer fee updated to " # Nat.toText(fee))
    };
    
    // ==========================================
    // Pool Management
    // ==========================================
    
    public shared(msg) func depositToPool(amount: TokenAmount): async Result.Result<Text, Text> {
        switch (ledgerCanisterId) {
            case null { #err("Ledger canister not configured") };
            case (?ledger) {
                // Create transfer argument
                let transferArg: TransferArg = {
                    from_subaccount = null;
                    to = {
                        owner = Principal.fromActor(Payments);
                        subaccount = null;
                    };
                    amount = amount;
                    fee = ?transferFee;
                    memo = null;
                    created_at_time = null;
                };
                
                // Call ICRC-1 transfer
                let ledgerActor = actor(Principal.toText(ledger)): actor {
                    icrc1_transfer: (TransferArg) -> async TransferResult;
                };
                
                try {
                    let result = await ledgerActor.icrc1_transfer(transferArg);
                    
                    switch (result) {
                        case (#Ok(txIndex)) {
                            // Update pool balance with overflow protection
                            switch (safeAdd(poolBalance, amount)) {
                                case null { #err("Arithmetic overflow in pool balance") };
                                case (?newBalance) {
                                    poolBalance := newBalance;
                                    
                                    switch (safeAdd(totalDeposits, amount)) {
                                        case null { #err("Arithmetic overflow in total deposits") };
                                        case (?newTotal) {
                                            totalDeposits := newTotal;
                                            
                                            // Update depositor balance
                                            let currentBalance = Option.get(depositorBalances.get(msg.caller), 0);
                                            switch (safeAdd(currentBalance, amount)) {
                                                case null { #err("Arithmetic overflow in depositor balance") };
                                                case (?newDepositorBalance) {
                                                    depositorBalances.put(msg.caller, newDepositorBalance);
                                                    #ok("Deposited " # Nat.toText(amount) # " tokens. Transaction: " # Nat.toText(txIndex));
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                        case (#Err(error)) {
                            #err("Transfer failed: " # errorToText(error))
                        };
                    };
                } catch (e) {
                    #err("Transfer failed: " # Error.message(e))
                };
            };
        };
    };
    
    public shared(msg) func withdrawFromPool(amount: TokenAmount): async Result.Result<Text, Text> {
        if (not isAdmin(msg.caller)) {
            return #err("Unauthorized: Only admins can withdraw from pool");
        };
        
        if (amount > poolBalance) {
            return #err("Insufficient pool balance");
        };
        
        switch (ledgerCanisterId) {
            case null { #err("Ledger canister not configured") };
            case (?ledger) {
                let transferArg: TransferArg = {
                    from_subaccount = null;
                    to = {
                        owner = msg.caller;
                        subaccount = null;
                    };
                    amount = amount;
                    fee = ?transferFee;
                    memo = null;
                    created_at_time = null;
                };
                
                let ledgerActor = actor(Principal.toText(ledger)): actor {
                    icrc1_transfer: (TransferArg) -> async TransferResult;
                };
                
                try {
                    let result = await ledgerActor.icrc1_transfer(transferArg);
                    
                    switch (result) {
                        case (#Ok(txIndex)) {
                            // Update balances with underflow protection
                            switch (safeSub(poolBalance, amount)) {
                                case null { #err("Arithmetic underflow in pool balance") };
                                case (?newBalance) {
                                    poolBalance := newBalance;
                                    
                                    switch (safeAdd(totalWithdrawals, amount)) {
                                        case null { #err("Arithmetic overflow in total withdrawals") };
                                        case (?newTotal) {
                                            totalWithdrawals := newTotal;
                                            #ok("Withdrawn " # Nat.toText(amount) # " tokens. Transaction: " # Nat.toText(txIndex));
                                        };
                                    };
                                };
                            };
                        };
                        case (#Err(error)) {
                            #err("Transfer failed: " # errorToText(error))
                        };
                    };
                } catch (e) {
                    #err("Transfer failed: " # Error.message(e))
                };
            };
        };
    };
    
    // ==========================================
    // Payment Processing
    // ==========================================
    
    public shared(msg) func processPayout(
        recipient: Principal,
        amount: TokenAmount,
        purpose: Text
    ): async Result.Result<PaymentRecord, Text> {
        if (not isAuthorized(msg.caller)) {
            return #err("Unauthorized: Only authorized callers can process payouts");
        };
        
        if (amount > poolBalance) {
            return #err("Insufficient pool balance for payout");
        };
        
        // Generate payment ID
        paymentCounter += 1;
        let paymentId = "PAY-" # Nat.toText(paymentCounter) # "-" # Int.toText(Time.now());
        
        // Create payment record
        var paymentRecord: PaymentRecord = {
            id = paymentId;
            payer = Principal.fromActor(Payments);
            recipient = recipient;
            amount = amount;
            fee = transferFee;
            purpose = purpose;
            status = #Pending;
            timestamp = Time.now();
            txIndex = null;
            errorMessage = null;
        };
        
        switch (ledgerCanisterId) {
            case null {
                paymentRecord := {
                    paymentRecord with
                    status = #Failed;
                    errorMessage = ?"Ledger canister not configured";
                };
                payments.put(paymentId, paymentRecord);
                #err("Ledger canister not configured")
            };
            case (?ledger) {
                let transferArg: TransferArg = {
                    from_subaccount = null;
                    to = {
                        owner = recipient;
                        subaccount = null;
                    };
                    amount = amount;
                    fee = ?transferFee;
                    memo = ?Text.encodeUtf8(purpose);
                    created_at_time = null;
                };
                
                let ledgerActor = actor(Principal.toText(ledger)): actor {
                    icrc1_transfer: (TransferArg) -> async TransferResult;
                };
                
                try {
                    let result = await ledgerActor.icrc1_transfer(transferArg);
                    
                    switch (result) {
                        case (#Ok(txIndex)) {
                            // Update payment record
                            paymentRecord := {
                                paymentRecord with
                                status = #Completed;
                                txIndex = ?txIndex;
                            };
                            
                            // Update balances
                            switch (safeSub(poolBalance, amount)) {
                                case null {
                                    paymentRecord := {
                                        paymentRecord with
                                        status = #Failed;
                                        errorMessage = ?"Arithmetic underflow";
                                    };
                                    payments.put(paymentId, paymentRecord);
                                    #err("Arithmetic underflow in pool balance")
                                };
                                case (?newBalance) {
                                    poolBalance := newBalance;
                                    
                                    switch (safeAdd(totalPayouts, amount)) {
                                        case null {
                                            paymentRecord := {
                                                paymentRecord with
                                                errorMessage = ?"Warning: Total payouts overflow";
                                            };
                                            payments.put(paymentId, paymentRecord);
                                            #ok(paymentRecord)
                                        };
                                        case (?newTotal) {
                                            totalPayouts := newTotal;
                                            payments.put(paymentId, paymentRecord);
                                            #ok(paymentRecord)
                                        };
                                    };
                                };
                            };
                        };
                        case (#Err(error)) {
                            paymentRecord := {
                                paymentRecord with
                                status = #Failed;
                                errorMessage = ?errorToText(error);
                            };
                            payments.put(paymentId, paymentRecord);
                            #err("Transfer failed: " # errorToText(error))
                        };
                    };
                } catch (e) {
                    paymentRecord := {
                        paymentRecord with
                        status = #Failed;
                        errorMessage = ?Error.message(e);
                    };
                    payments.put(paymentId, paymentRecord);
                    #err("Transfer failed: " # Error.message(e))
                };
            };
        };
    };
    
    // ==========================================
    // Escrow Management
    // ==========================================
    
    public shared(msg) func createEscrow(
        beneficiary: Principal,
        amount: TokenAmount,
        condition: Text,
        expirationSeconds: Nat
    ): async Result.Result<EscrowRecord, Text> {
        switch (ledgerCanisterId) {
            case null { #err("Ledger canister not configured") };
            case (?ledger) {
                // Generate escrow ID
                escrowCounter += 1;
                let escrowId = "ESC-" # Nat.toText(escrowCounter) # "-" # Int.toText(Time.now());
                
                let now = Time.now();
                let expiresAt = now + (expirationSeconds * 1_000_000_000);
                
                // Create escrow record
                let escrowRecord: EscrowRecord = {
                    id = escrowId;
                    depositor = msg.caller;
                    beneficiary = beneficiary;
                    amount = amount;
                    condition = condition;
                    status = #Active;
                    createdAt = now;
                    releasedAt = null;
                    expiresAt = expiresAt;
                };
                
                // Transfer tokens to escrow
                let transferArg: TransferArg = {
                    from_subaccount = null;
                    to = {
                        owner = Principal.fromActor(Payments);
                        subaccount = ?Text.encodeUtf8(escrowId);
                    };
                    amount = amount;
                    fee = ?transferFee;
                    memo = ?Text.encodeUtf8("Escrow: " # condition);
                    created_at_time = null;
                };
                
                let ledgerActor = actor(Principal.toText(ledger)): actor {
                    icrc1_transfer: (TransferArg) -> async TransferResult;
                };
                
                try {
                    let result = await ledgerActor.icrc1_transfer(transferArg);
                    
                    switch (result) {
                        case (#Ok(txIndex)) {
                            escrows.put(escrowId, escrowRecord);
                            #ok(escrowRecord)
                        };
                        case (#Err(error)) {
                            #err("Escrow creation failed: " # errorToText(error))
                        };
                    };
                } catch (e) {
                    #err("Escrow creation failed: " # Error.message(e))
                };
            };
        };
    };
    
    public shared(msg) func releaseEscrow(escrowId: Text): async Result.Result<Text, Text> {
        switch (escrows.get(escrowId)) {
            case null { #err("Escrow not found") };
            case (?escrow) {
                if (escrow.status != #Active) {
                    return #err("Escrow is not active");
                };
                
                // Only authorized parties can release
                if (msg.caller != escrow.depositor and not isAuthorized(msg.caller)) {
                    return #err("Unauthorized: Only depositor or authorized callers can release escrow");
                };
                
                switch (ledgerCanisterId) {
                    case null { #err("Ledger canister not configured") };
                    case (?ledger) {
                        let transferArg: TransferArg = {
                            from_subaccount = ?Text.encodeUtf8(escrowId);
                            to = {
                                owner = escrow.beneficiary;
                                subaccount = null;
                            };
                            amount = escrow.amount;
                            fee = ?transferFee;
                            memo = ?Text.encodeUtf8("Escrow released: " # escrowId);
                            created_at_time = null;
                        };
                        
                        let ledgerActor = actor(Principal.toText(ledger)): actor {
                            icrc1_transfer: (TransferArg) -> async TransferResult;
                        };
                        
                        try {
                            let result = await ledgerActor.icrc1_transfer(transferArg);
                            
                            switch (result) {
                                case (#Ok(txIndex)) {
                                    let updatedEscrow = {
                                        escrow with
                                        status = #Released;
                                        releasedAt = ?Time.now();
                                    };
                                    escrows.put(escrowId, updatedEscrow);
                                    #ok("Escrow released successfully. Transaction: " # Nat.toText(txIndex))
                                };
                                case (#Err(error)) {
                                    #err("Escrow release failed: " # errorToText(error))
                                };
                            };
                        } catch (e) {
                            #err("Escrow release failed: " # Error.message(e))
                        };
                    };
                };
            };
        };
    };
    
    // ==========================================
    // Query Functions
    // ==========================================
    
    public query func getPoolBalance(): async TokenAmount {
        poolBalance
    };
    
    public query func getPoolStats(): async PoolStats {
        {
            totalDeposits = totalDeposits;
            totalWithdrawals = totalWithdrawals;
            totalPayouts = totalPayouts;
            currentBalance = poolBalance;
            numberOfDepositors = depositorBalances.size();
            lastUpdated = Time.now();
        }
    };
    
    public query func getPayment(paymentId: Text): async ?PaymentRecord {
        payments.get(paymentId)
    };
    
    public query func getEscrow(escrowId: Text): async ?EscrowRecord {
        escrows.get(escrowId)
    };
    
    public query func getDepositorBalance(depositor: Principal): async TokenAmount {
        Option.get(depositorBalances.get(depositor), 0)
    };
    
    public query func getRecentPayments(limit: Nat): async [PaymentRecord] {
        let allPayments = Iter.toArray(payments.vals());
        let sorted = Array.sort(allPayments, func(a: PaymentRecord, b: PaymentRecord): {#less; #equal; #greater} {
            if (a.timestamp > b.timestamp) { #less }
            else if (a.timestamp < b.timestamp) { #greater }
            else { #equal }
        });
        
        let size = if (sorted.size() < limit) { sorted.size() } else { limit };
        Array.tabulate(size, func(i: Nat): PaymentRecord { sorted[i] })
    };
    
    public query func getActiveEscrows(): async [EscrowRecord] {
        Array.filter(Iter.toArray(escrows.vals()), func(e: EscrowRecord): Bool {
            e.status == #Active
        })
    };
    
    public query func getConfiguration(): async {
        ledgerCanister: ?Principal;
        transferFee: TokenAmount;
        adminCount: Nat;
        authorizedCallerCount: Nat;
    } {
        {
            ledgerCanister = ledgerCanisterId;
            transferFee = transferFee;
            adminCount = adminPrincipals.size();
            authorizedCallerCount = authorizedCallers.size();
        }
    };
    
    // ==========================================
    // Helper Functions
    // ==========================================
    
    private func safeAdd(a: Nat, b: Nat): ?Nat {
        let sum = a + b;
        if (sum >= a) { ?sum } else { null }
    };
    
    private func safeSub(a: Nat, b: Nat): ?Nat {
        if (a >= b) { ?(a - b) } else { null }
    };
    
    private func errorToText(error: TransferError): Text {
        switch (error) {
            case (#BadFee(f)) { "Bad fee: expected " # Nat.toText(f.expected_fee) };
            case (#BadBurn(b)) { "Bad burn: minimum " # Nat.toText(b.min_burn_amount) };
            case (#InsufficientFunds(f)) { "Insufficient funds: balance " # Nat.toText(f.balance) };
            case (#TooOld) { "Transaction too old" };
            case (#CreatedInFuture(t)) { "Created in future: " # Nat64.toText(t.ledger_time) };
            case (#Duplicate(d)) { "Duplicate transaction: " # Nat.toText(d.duplicate_of) };
            case (#TemporarilyUnavailable) { "Temporarily unavailable" };
            case (#GenericError(e)) { "Error " # Nat.toText(e.error_code) # ": " # e.message };
        };
    };
    
    // ==========================================
    // System Functions
    // ==========================================
    
    public query func getCanisterStatus(): async {
        cycles: Nat;
        memory_size: Nat;
        module_hash: ?Blob;
    } {
        {
            cycles = 0; // Would need ExperimentalCycles for real value
            memory_size = 0; // Would need system API
            module_hash = null;
        }
    };
}