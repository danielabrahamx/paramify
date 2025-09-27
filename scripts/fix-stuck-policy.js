const { ethers } = require("hardhat");

async function main() {
  console.log("=== Fixing Stuck Policy ===");
  
  const contractAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Get the stuck account
  const stuckAccount = await ethers.getSigner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  
  console.log("Stuck Account:", stuckAccount.address);
  
  // Since the stuck policy can't be cleared through normal means,
  // we need to use admin functions or modify the contract state
  
  // Option 1: Try to force clear the policy by setting it as paid out
  // This requires admin access to the contract
  try {
    console.log("Attempting administrative fix...");
    
    // Check if we can modify the policy directly (this depends on contract design)
    const [admin] = await ethers.getSigners();
    console.log("Admin account:", admin.address);
    
    // If the contract has an admin function to clear policies, use it
    // For now, let's try a different approach - modify the oracle to make payout > 0
    
    const oracleAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
    const oracle = await ethers.getContractAt("MockV3Aggregator", oracleAddress);
    
    // Set oracle to a very high value temporarily to force a payout
    console.log("Setting oracle to high value to force payout...");
    await oracle.updateAnswer(1000000); // 1 million seconds
    
    console.log("Attempting payout with high oracle value...");
    const policy = await contract.policies(stuckAccount.address);
    console.log("Policy payout rate:", policy.payoutRatePerSecond.toString());
    
    if (policy.payoutRatePerSecond === 0n) {
      console.log("❌ Policy still has 0 payout rate - cannot be fixed with oracle adjustment");
      console.log("💡 Solution: Use a different account with working policy");
      
      // Reset oracle back to reasonable value
      await oracle.updateAnswer(600);
      console.log("Oracle reset to 600 seconds");
      
      console.log("\n🔧 RECOMMENDED SOLUTION:");
      console.log("1. Disconnect current MetaMask account");
      console.log("2. Import one of these working accounts:");
      console.log("   - Account 3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906");
      console.log("   - Private Key: 0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0");
      console.log("   - Expected Payout: ~10 ETH");
      console.log("3. Refresh the frontend");
      console.log("4. Connect with the new account");
      console.log("5. Test the payout functionality");
      
    } else {
      // Try the payout
      const tx = await contract.connect(stuckAccount).triggerPayout();
      await tx.wait();
      console.log("✅ Stuck policy cleared!");
    }
    
  } catch (error) {
    console.log("Error during fix attempt:", error.message);
    
    console.log("\n🔧 MANUAL SOLUTION:");
    console.log("The stuck policy cannot be automatically cleared.");
    console.log("Please use Account 3 instead:");
    console.log("- Address: 0x90F79bf6EB2c4f870365E785982E1f101E93b906");
    console.log("- Private Key: 0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0");
    console.log("- This account has a working policy with ~10 ETH payout");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });