const { ethers } = require("hardhat");

async function main() {
  console.log("=== Testing Payout Rate Calculation ===");
  
  // Test different rates
  const testRates = [1, 2, 5, 10, 0.1, 0.01];
  
  for (const rate of testRates) {
    const rateInWei = ethers.parseEther(rate.toString());
    const ratePerSecondInWei = rateInWei / 60n; // Using BigInt division
    
    console.log(`\nRate: ${rate} ETH/minute`);
    console.log(`Rate in Wei: ${rateInWei.toString()}`);
    console.log(`Rate per second in Wei: ${ratePerSecondInWei.toString()}`);
    console.log(`Rate per second in ETH: ${ethers.formatEther(ratePerSecondInWei)}`);
    
    // Test payout for 100 seconds
    const payoutFor100Seconds = ratePerSecondInWei * 100n;
    console.log(`Payout for 100 seconds: ${ethers.formatEther(payoutFor100Seconds)} ETH`);
  }
  
  // Check if there's precision loss
  console.log("\n=== Precision Loss Check ===");
  const smallRate = ethers.parseEther("0.01"); // 0.01 ETH/minute
  const perSecond = smallRate / 60n;
  console.log(`0.01 ETH/minute → ${perSecond.toString()} wei/second`);
  console.log(`This equals: ${ethers.formatEther(perSecond)} ETH/second`);
  
  if (perSecond === 0n) {
    console.log("❌ PROBLEM: Rate becomes 0 due to integer division!");
  } else {
    console.log("✅ Rate calculation is working properly");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });