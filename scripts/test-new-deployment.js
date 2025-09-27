const { ethers } = require("hardhat");

async function main() {
  console.log("=== Testing New Deployment with Correct Payout ===");
  
  const [admin, customer] = await ethers.getSigners();
  const contractAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  console.log("Admin address:", admin.address);
  console.log("Customer address:", customer.address);
  console.log("Contract address:", contractAddress);
  
  // Test buying insurance with a rate that will work
  const payoutRatePerMinute = "0.1"; // 0.1 ETH per minute
  const payoutRateInWei = ethers.parseEther(payoutRatePerMinute);
  const premiumInWei = ethers.parseEther((parseFloat(payoutRatePerMinute) * 2).toString()); // 0.2 ETH premium
  
  console.log("Payout rate per minute:", payoutRatePerMinute, "ETH");
  console.log("Payout rate in wei:", payoutRateInWei.toString());
  console.log("Premium:", ethers.formatEther(premiumInWei), "ETH");
  
  // Calculate expected payout rate per second
  const expectedPayoutRatePerSecond = payoutRateInWei / 60n;
  console.log("Expected payout rate per second:", expectedPayoutRatePerSecond.toString(), "wei");
  console.log("Expected payout rate per second (ETH):", ethers.formatEther(expectedPayoutRatePerSecond));
  
  try {
    // Check if customer already has a policy
    const existingPolicy = await contract.policies(customer.address);
    if (existingPolicy.active) {
      console.log("Customer already has active policy, cannot proceed");
      return;
    }
    
    // Check customer balance
    const balance = await ethers.provider.getBalance(customer.address);
    console.log("Customer balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < premiumInWei) {
      console.log("❌ Insufficient balance for premium");
      return;
    }
    
    // Buy insurance
    console.log("\n=== Purchasing Insurance ===");
    const tx = await contract.connect(customer).buyInsurance(payoutRateInWei, { value: premiumInWei });
    await tx.wait();
    console.log("✅ Insurance purchased successfully!");
    
    // Check the policy
    const policy = await contract.policies(customer.address);
    console.log("\n=== Policy Details ===");
    console.log("- Active:", policy.active);
    console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
    console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
    console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
    console.log("- Paid Out:", policy.paidOut);
    
    if (policy.payoutRatePerSecond > 0) {
      console.log("✅ Payout rate is correctly set!");
      
      // Test payout calculation
      const outageDuration = await contract.getLatestPrice();
      console.log("\n=== Payout Calculation ===");
      console.log("Current outage duration:", outageDuration.toString(), "seconds");
      
      const expectedPayout = BigInt(outageDuration) * policy.payoutRatePerSecond;
      console.log("Expected payout (wei):", expectedPayout.toString());
      console.log("Expected payout (ETH):", ethers.formatEther(expectedPayout));
      
      if (outageDuration > 0 && expectedPayout > 0) {
        console.log("\n=== Triggering Payout ===");
        const balanceBeforePayout = await ethers.provider.getBalance(customer.address);
        console.log("Balance before payout:", ethers.formatEther(balanceBeforePayout), "ETH");
        
        const payoutTx = await contract.connect(customer).triggerPayout();
        const receipt = await payoutTx.wait();
        console.log("✅ Payout completed!");
        
        const balanceAfterPayout = await ethers.provider.getBalance(customer.address);
        console.log("Balance after payout:", ethers.formatEther(balanceAfterPayout), "ETH");
        
        const actualPayoutReceived = balanceAfterPayout - balanceBeforePayout;
        console.log("Net payout received (after gas):", ethers.formatEther(actualPayoutReceived), "ETH");
        
        // Check contract events
        const events = receipt.logs.filter(log => {
          try {
            return contract.interface.parseLog(log) !== null;
          } catch {
            return false;
          }
        });
        
        console.log("\n=== Contract Events ===");
        events.forEach(log => {
          const parsed = contract.interface.parseLog(log);
          if (parsed.name === "PayoutTriggered") {
            console.log("PayoutTriggered event:");
            console.log("- Customer:", parsed.args.customer);
            console.log("- Amount (ETH):", ethers.formatEther(parsed.args.amount));
          }
        });
        
      } else {
        console.log("❌ Cannot trigger payout - outage duration or expected payout is 0");
      }
      
    } else {
      console.log("❌ Payout rate is still 0 - there's still an issue");
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });