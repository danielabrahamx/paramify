const { ethers } = require("hardhat");

async function main() {
  console.log("=== Checking Current Oracle State ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Check oracle value
  const oracleValue = await contract.getLatestPrice();
  console.log("Current Oracle Value (raw):", oracleValue.toString());
  console.log("Current Oracle Value (number):", Number(oracleValue));
  
  // Check who has active policies
  const accounts = await ethers.getSigners();
  
  for (let i = 0; i < 5; i++) {
    const account = accounts[i];
    const policy = await contract.policies(account.address);
    
    if (policy.active || policy.premium > 0) {
      console.log(`\n=== Account ${i}: ${account.address} ===`);
      console.log("- Active:", policy.active);
      console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
      console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
      console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
      console.log("- Paid Out:", policy.paidOut);
      
      if (policy.active && oracleValue > 0) {
        const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
        console.log("- Expected Payout (wei):", expectedPayout.toString());
        console.log("- Expected Payout (ETH):", ethers.formatEther(expectedPayout));
      }
    }
  }
  
  // Check contract balance
  const contractBalance = await contract.getContractBalance();
  console.log("\nContract Balance (ETH):", ethers.formatEther(contractBalance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });