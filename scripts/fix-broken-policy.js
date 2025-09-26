const { ethers } = require("hardhat");

async function main() {
  console.log("=== Fixing the Broken Policy ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // The account with the broken policy
  const problemAccount = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const signer = await ethers.getImpersonatedSigner(problemAccount);
  
  console.log("Problem account:", problemAccount);
  
  // Check current policy
  const currentPolicy = await contract.policies(problemAccount);
  console.log("Current broken policy:");
  console.log("- Active:", currentPolicy.active);
  console.log("- Premium:", ethers.formatEther(currentPolicy.premium), "ETH");
  console.log("- PayoutRatePerSecond:", currentPolicy.payoutRatePerSecond.toString());
  
  // Since we can't modify the existing policy directly, we need to trigger the current
  // broken policy (which will pay 0) to reset it, then create a new proper one
  
  try {
    console.log("\n1. Triggering the broken policy to clear it...");
    const clearTx = await contract.connect(signer).triggerPayout();
    await clearTx.wait();
    console.log("✅ Broken policy cleared");
    
    // Verify it's cleared
    const clearedPolicy = await contract.policies(problemAccount);
    console.log("Policy after clearing:");
    console.log("- Active:", clearedPolicy.active);
    console.log("- Paid Out:", clearedPolicy.paidOut);
    
  } catch (error) {
    console.log("Could not clear broken policy:", error.message);
  }
  
  // Now create a proper new policy with 10 ETH per minute rate
  console.log("\n2. Creating new proper policy...");
  const payoutRatePerMinute = ethers.parseEther("10"); // 10 ETH per minute
  const premium = ethers.parseEther("20"); // 20 ETH premium (rate * 2)
  
  try {
    const newTx = await contract.connect(signer).buyInsurance(payoutRatePerMinute, { 
      value: premium 
    });
    await newTx.wait();
    console.log("✅ New policy created!");
    
    // Verify the new policy
    const newPolicy = await contract.policies(problemAccount);
    console.log("\nNew policy details:");
    console.log("- Active:", newPolicy.active);
    console.log("- Premium:", ethers.formatEther(newPolicy.premium), "ETH");
    console.log("- PayoutRatePerSecond (wei):", newPolicy.payoutRatePerSecond.toString());
    console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(newPolicy.payoutRatePerSecond));
    
    // Calculate expected payout
    const oracleValue = await contract.getLatestPrice();
    const expectedPayout = BigInt(oracleValue) * newPolicy.payoutRatePerSecond;
    
    console.log("\nPayout calculation:");
    console.log("- Oracle value:", oracleValue.toString(), "seconds");
    console.log("- Expected payout:", ethers.formatEther(expectedPayout), "ETH");
    
    if (newPolicy.payoutRatePerSecond > 0) {
      console.log("\n🎉 SUCCESS! Policy now has proper payout rate");
      console.log("The UI should now work correctly for claims");
    }
    
  } catch (error) {
    console.error("Error creating new policy:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });