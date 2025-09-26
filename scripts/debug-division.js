const { ethers } = require("hardhat");

async function main() {
  console.log("=== Simulating the Problem ===");
  
  // The premium was 4.0 ETH, and premium = rate * 2
  // So the rate per minute was 2.0 ETH
  const ratePerMinute = 2.0;
  const rateInWei = ethers.parseEther(ratePerMinute.toString());
  
  console.log(`Original Rate: ${ratePerMinute} ETH/minute`);
  console.log(`Rate in Wei: ${rateInWei.toString()}`);
  
  // This is what the Solidity contract does:
  // uint256 payoutRatePerSecond = _payoutRatePerMinute / 60;
  // In Solidity, this is integer division
  const payoutRatePerSecond = rateInWei / 60n;
  
  console.log(`Payout Rate Per Second (Solidity calc): ${payoutRatePerSecond.toString()} wei`);
  console.log(`Payout Rate Per Second in ETH: ${ethers.formatEther(payoutRatePerSecond)}`);
  
  // Test with smaller values that might cause issues
  console.log("\n=== Testing Edge Cases ===");
  
  const smallRates = [0.1, 0.01, 0.001];
  
  for (const rate of smallRates) {
    const wei = ethers.parseEther(rate.toString());
    const perSecond = wei / 60n;
    console.log(`${rate} ETH/min → ${perSecond.toString()} wei/sec (${ethers.formatEther(perSecond)} ETH/sec)`);
    
    if (perSecond === 0n) {
      console.log(`❌ This rate becomes 0!`);
    }
  }
  
  // The issue might be: they entered the rate in the wrong unit
  // Maybe they entered "2" thinking it was wei, not ETH
  console.log("\n=== If rate was entered as raw number instead of ETH ===");
  const rawNumber = 2n; // Just "2" without parseEther
  const perSecondRaw = rawNumber / 60n;
  console.log(`Raw 2 → ${perSecondRaw.toString()} per second`);
  if (perSecondRaw === 0n) {
    console.log(`❌ This would definitely be 0!`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });