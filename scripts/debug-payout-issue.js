const { ethers } = require("hardhat");

async function main() {
  console.log("=== Debugging Payout Issue ===");
  
  const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Account 1 - the one having issues
  const account3Address = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  
  console.log("Contract address:", contractAddress);
  console.log("Account address:", account3Address);
  
  // Get oracle value
  try {
    const oracleValue = await contract.getLatestPrice();
    console.log("Oracle value:", oracleValue.toString());
  } catch (error) {
    console.log("Error getting oracle value:", error.message);
  }
  
  // Get policy details
  try {
    const policy = await contract.policies(account3Address);
    console.log("\nPolicy Details:");
    console.log("- Active:", policy.active);
    console.log("- Premium (wei):", policy.premium.toString());
    console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
    console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
    console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
    console.log("- Paid Out:", policy.paidOut);
    
    // Calculate expected payout
    const oracleValue = await contract.getLatestPrice();
    const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
    console.log("\nPayout Calculation:");
    console.log("- Oracle Value:", oracleValue.toString());
    console.log("- PayoutRatePerSecond:", policy.payoutRatePerSecond.toString());
    console.log("- Expected Payout (wei):", expectedPayout.toString());
    console.log("- Expected Payout (ETH):", ethers.formatEther(expectedPayout));
    
    if (expectedPayout === 0n) {
      console.log("\n❌ PROBLEM: Expected payout is 0!");
      console.log("This means either:");
      console.log("1. Oracle value is 0:", oracleValue.toString() === "0");
      console.log("2. PayoutRatePerSecond is 0:", policy.payoutRatePerSecond.toString() === "0");
    }
    
  } catch (error) {
    console.log("Error getting policy:", error.message);
  }
  
  // Check contract balance
  try {
    const balance = await ethers.provider.getBalance(contractAddress);
    console.log("\nContract balance:", ethers.formatEther(balance), "ETH");
  } catch (error) {
    console.log("Error getting contract balance:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });