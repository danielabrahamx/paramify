const { ethers } = require("hardhat");

async function main() {
  // Get contract
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1"; // Update with actual address
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Get signers
  const [admin, customer] = await ethers.getSigners();
  
  console.log("=== Debugging Payout Issue ===");
  console.log("Contract Address:", contractAddress);
  console.log("Customer Address:", customer.address);
  
  // Check if customer has a policy
  try {
    const policy = await contract.policies(customer.address);
    console.log("Policy Details:");
    console.log("- Active:", policy.active);
    console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
    console.log("- Coverage (ETH):", ethers.formatEther(policy.coverage));
    console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
    console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
    console.log("- Paid Out:", policy.paidOut);
    
    // Check current outage duration
    const outageDuration = await contract.getLatestPrice();
    console.log("Current Outage Duration:", outageDuration.toString(), "seconds");
    
    // Calculate expected payout
    const expectedPayout = outageDuration * policy.payoutRatePerSecond;
    console.log("Expected Payout (wei):", expectedPayout.toString());
    console.log("Expected Payout (ETH):", ethers.formatEther(expectedPayout));
    
    // Check contract balance
    const contractBalance = await contract.getContractBalance();
    console.log("Contract Balance (ETH):", ethers.formatEther(contractBalance));
    
    // Check if payout is eligible
    const isEligible = await contract.isPayoutEligible(customer.address);
    console.log("Is Payout Eligible:", isEligible);
    
  } catch (error) {
    console.error("Error checking policy:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });