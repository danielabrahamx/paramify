const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Working Insurance Policy ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Use account 3 for fresh testing
  const [admin, account1, account2, testCustomer] = await ethers.getSigners();
  console.log("Test customer address:", testCustomer.address);
  
  // Check if customer already has a policy
  const existingPolicy = await contract.policies(testCustomer.address);
  if (existingPolicy.active) {
    console.log("Customer already has active policy, skipping creation");
    return;
  }
  
  // Create proper insurance parameters
  // We want 1 ETH per minute payout rate
  const payoutRatePerMinuteETH = 1; // 1 ETH per minute
  const payoutRatePerMinuteWei = ethers.parseEther(payoutRatePerMinuteETH.toString());
  const expectedPremium = ethers.parseEther((payoutRatePerMinuteETH * 2).toString()); // 2 ETH premium
  
  console.log("Insurance Parameters:");
  console.log("- Payout Rate: 1 ETH per minute");
  console.log("- Premium: 2 ETH");
  console.log("- Payout Rate in Wei:", payoutRatePerMinuteWei.toString());
  
  // Calculate expected payout rate per second
  const expectedPayoutRatePerSecond = payoutRatePerMinuteWei / 60n;
  console.log("- Expected Payout Rate Per Second:", expectedPayoutRatePerSecond.toString(), "wei");
  console.log("- Expected Payout Rate Per Second:", ethers.formatEther(expectedPayoutRatePerSecond), "ETH");
  
  try {
    console.log("\nPurchasing insurance...");
    const tx = await contract.connect(testCustomer).buyInsurance(payoutRatePerMinuteWei, { 
      value: expectedPremium 
    });
    await tx.wait();
    console.log("✅ Insurance purchased successfully!");
    
    // Verify the policy
    const newPolicy = await contract.policies(testCustomer.address);
    console.log("\nPolicy Verification:");
    console.log("- Active:", newPolicy.active);
    console.log("- Premium (ETH):", ethers.formatEther(newPolicy.premium));
    console.log("- PayoutRatePerSecond (wei):", newPolicy.payoutRatePerSecond.toString());
    console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(newPolicy.payoutRatePerSecond));
    
    if (newPolicy.payoutRatePerSecond > 0) {
      console.log("✅ Payout rate is correctly set!");
      
      // Test the payout calculation
      const oracleValue = await contract.getLatestPrice();
      console.log("\nCurrent oracle value:", oracleValue.toString(), "seconds");
      
      if (oracleValue > 0) {
        const expectedPayout = BigInt(oracleValue) * newPolicy.payoutRatePerSecond;
        console.log("Expected payout (ETH):", ethers.formatEther(expectedPayout));
        
        console.log("\n🎯 Ready for testing!");
        console.log("Customer address for MetaMask:", testCustomer.address);
        console.log("Expected payout amount:", ethers.formatEther(expectedPayout), "ETH");
      }
    } else {
      console.log("❌ Payout rate is still 0 - need to investigate further");
    }
    
  } catch (error) {
    console.error("Error purchasing insurance:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });