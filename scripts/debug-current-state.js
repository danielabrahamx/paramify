const { ethers } = require("hardhat");

async function main() {
  console.log("=== Debugging Current State ===");
  
  const contractAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  const oracleAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
  
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  const oracle = await ethers.getContractAt("MockV3Aggregator", oracleAddress);
  
  // Check oracle value directly
  const oracleValue = await oracle.latestAnswer();
  console.log("Direct oracle value:", oracleValue.toString());
  
  // Check what contract reads
  const contractOracleValue = await contract.getLatestPrice();
  console.log("Contract reads oracle as:", contractOracleValue.toString());
  
  // Check active policies
  const [admin, customer] = await ethers.getSigners();
  const policy = await contract.policies(customer.address);
  
  console.log("\nPolicy Details:");
  console.log("- Address:", customer.address);
  console.log("- Active:", policy.active);
  console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
  console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
  console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
  console.log("- Paid Out:", policy.paidOut);
  
  if (policy.active && !policy.paidOut) {
    const expectedPayout = BigInt(contractOracleValue) * policy.payoutRatePerSecond;
    console.log("\nPayout Calculation:");
    console.log("- Outage duration:", contractOracleValue.toString(), "seconds");
    console.log("- Rate per second:", policy.payoutRatePerSecond.toString(), "wei");
    console.log("- Expected payout (wei):", expectedPayout.toString());
    console.log("- Expected payout (ETH):", ethers.formatEther(expectedPayout));
    
    if (expectedPayout === 0n) {
      console.log("❌ PROBLEM: Expected payout is 0!");
      
      if (policy.payoutRatePerSecond === 0n) {
        console.log("Issue: PayoutRatePerSecond is 0");
      }
      
      if (contractOracleValue === 0n) {
        console.log("Issue: Oracle value is 0");
      }
    }
  }
  
  // Fix oracle to reasonable value
  console.log("\n=== Fixing Oracle ===");
  console.log("Setting oracle to 600 seconds (10 minutes)...");
  const tx = await oracle.updateAnswer(600);
  await tx.wait();
  
  const newOracleValue = await oracle.latestAnswer();
  console.log("New oracle value:", newOracleValue.toString());
  
  const newContractValue = await contract.getLatestPrice();
  console.log("Contract now reads:", newContractValue.toString());
  
  if (policy.active && !policy.paidOut) {
    const newExpectedPayout = BigInt(newContractValue) * policy.payoutRatePerSecond;
    console.log("\nNew Payout Calculation:");
    console.log("- New expected payout (wei):", newExpectedPayout.toString());
    console.log("- New expected payout (ETH):", ethers.formatEther(newExpectedPayout));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });