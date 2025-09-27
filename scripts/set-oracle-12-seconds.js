const { ethers } = require("hardhat");

async function main() {
  console.log("=== Setting Oracle to Match UI (12 seconds) ===");
  
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Set oracle to 12 seconds to match the UI display
  const [admin] = await ethers.getSigners();
  
  console.log("Current oracle value:", (await contract.getLatestPrice()).toString());
  console.log("Setting oracle to 12 seconds to match UI...");
  
  const tx = await contract.connect(admin).setOutageDuration(12);
  await tx.wait();
  
  console.log("✅ Oracle updated!");
  
  // Verify
  const newValue = await contract.getLatestPrice();
  console.log("New oracle value:", newValue.toString(), "seconds");
  
  // Calculate expected payout for the fixed account
  const accountAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const policy = await contract.policies(accountAddress);
  
  if (policy.active && policy.payoutRatePerSecond > 0) {
    const expectedPayout = BigInt(newValue) * policy.payoutRatePerSecond;
    console.log("\nFor the UI account:");
    console.log("- Expected payout:", ethers.formatEther(expectedPayout), "ETH");
    console.log("- This should match the UI display of 2 ETH");
    
    // Check if eligible for payout
    const isEligible = await contract.isPayoutEligible(accountAddress);
    console.log("- Payout eligible:", isEligible);
    
    if (isEligible) {
      console.log("\n🎯 READY! Now the 'Claim Outage Payout' should work");
      console.log("Expected balance increase: ~2 ETH (minus gas costs)");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });