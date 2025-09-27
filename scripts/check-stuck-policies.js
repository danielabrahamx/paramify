const { ethers } = require("hardhat");

async function main() {
  console.log("=== Checking All Accounts for Stuck Policies ===");
  
  const contractAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Check all known test accounts
  const accounts = await ethers.getSigners();
  
  for (let i = 0; i < Math.min(accounts.length, 10); i++) {
    const account = accounts[i];
    const policy = await contract.policies(account.address);
    
    console.log(`\n=== Account ${i}: ${account.address} ===`);
    console.log("- Active:", policy.active);
    console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
    console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
    console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
    console.log("- Paid Out:", policy.paidOut);
    
    // If this is a stuck policy (active but payout rate is 0)
    if (policy.active && policy.payoutRatePerSecond === 0n) {
      console.log("🚨 STUCK POLICY DETECTED!");
      console.log("This policy has payout rate of 0 and needs to be cleared.");
      
      // Try to trigger payout to clear it (it should fail gracefully or clear the policy)
      try {
        console.log("Attempting to clear stuck policy...");
        const tx = await contract.connect(account).triggerPayout();
        await tx.wait();
        console.log("✅ Policy cleared successfully!");
      } catch (error) {
        console.log("⚠️ Failed to clear policy:", error.message);
        console.log("This policy is truly stuck and blocking the interface.");
      }
    }
    
    // If this is a working policy
    if (policy.active && policy.payoutRatePerSecond > 0n) {
      console.log("✅ WORKING POLICY FOUND!");
      const oracleValue = await contract.getLatestPrice();
      const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
      console.log("- Oracle value:", oracleValue.toString(), "seconds");
      console.log("- Expected payout:", ethers.formatEther(expectedPayout), "ETH");
      console.log("📋 Use this account in MetaMask:", account.address);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });