const { ethers } = require("hardhat");

async function main() {
  console.log("=== Diagnosing Zero Payout Issue ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Check the customer address from transaction history
  const customerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  
  console.log("Checking customer:", customerAddress);
  
  // Get policy details
  const policy = await contract.policies(customerAddress);
  console.log("Policy Details:");
  console.log("- Active:", policy.active);
  console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
  console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
  console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
  console.log("- Paid Out:", policy.paidOut);
  
  // Get current oracle value
  const oracleValue = await contract.getLatestPrice();
  console.log("\nOracle Value:", oracleValue.toString(), "seconds");
  
  // Calculate what the payout should be
  if (policy.payoutRatePerSecond > 0 && oracleValue > 0) {
    const calculatedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
    console.log("Calculated Payout (wei):", calculatedPayout.toString());
    console.log("Calculated Payout (ETH):", ethers.formatEther(calculatedPayout));
  } else {
    console.log("❌ Cannot calculate payout:");
    if (policy.payoutRatePerSecond === 0n) {
      console.log("  - PayoutRatePerSecond is 0 (this is the main issue!)");
    }
    if (oracleValue === 0n) {
      console.log("  - Oracle value is 0");
    }
  }
  
  // Check contract balance
  const contractBalance = await contract.getContractBalance();
  console.log("\nContract Balance (ETH):", ethers.formatEther(contractBalance));
  
  // Check if payout eligible
  const isEligible = await contract.isPayoutEligible(customerAddress);
  console.log("Payout Eligible:", isEligible);
  
  console.log("\n=== Diagnosis ===");
  if (policy.payoutRatePerSecond === 0n) {
    console.log("🔍 ROOT CAUSE: PayoutRatePerSecond is 0");
    console.log("This happens when the smart contract receives a small number that becomes 0 after division by 60");
    console.log("The original insurance purchase likely passed incorrect parameters");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });