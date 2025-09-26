const { ethers } = require("hardhat");

async function main() {
  console.log("=== Diagnosing Current UI Payout Issue ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Check the account that's showing in the UI (20 ETH premium suggests 10 ETH/minute rate)
  // Let's check all accounts to find the one with 20 ETH premium
  const accounts = await ethers.getSigners();
  
  console.log("Looking for account with 20 ETH premium (10 ETH/minute policy)...");
  
  for (let i = 0; i < 10; i++) {
    const account = accounts[i];
    const policy = await contract.policies(account.address);
    
    if (policy.premium > 0) {
      const premiumEth = Number(ethers.formatEther(policy.premium));
      console.log(`\nAccount ${i}: ${account.address}`);
      console.log(`- Active: ${policy.active}`);
      console.log(`- Premium: ${premiumEth} ETH`);
      console.log(`- PayoutRatePerSecond (wei): ${policy.payoutRatePerSecond.toString()}`);
      console.log(`- PayoutRatePerSecond (ETH): ${ethers.formatEther(policy.payoutRatePerSecond)}`);
      console.log(`- Paid Out: ${policy.paidOut}`);
      
      if (premiumEth === 20.0) {
        console.log("\n🎯 FOUND THE UI ACCOUNT!");
        
        // Check oracle and calculate payout
        const oracleValue = await contract.getLatestPrice();
        console.log(`Oracle Value: ${oracleValue} seconds`);
        
        if (policy.payoutRatePerSecond > 0 && oracleValue > 0) {
          const calculatedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
          console.log(`Calculated Payout (wei): ${calculatedPayout.toString()}`);
          console.log(`Calculated Payout (ETH): ${ethers.formatEther(calculatedPayout)}`);
          
          // Check if eligible
          const isEligible = await contract.isPayoutEligible(account.address);
          console.log(`Payout Eligible: ${isEligible}`);
          
          if (isEligible) {
            console.log("\n✅ Policy should be able to claim payout");
          } else {
            console.log("\n❌ Policy is NOT eligible for payout");
          }
        } else {
          console.log("\n❌ Cannot calculate payout:");
          if (policy.payoutRatePerSecond === 0n) {
            console.log("  - PayoutRatePerSecond is 0!");
          }
          if (oracleValue === 0n) {
            console.log("  - Oracle value is 0");
          }
        }
        
        // Check account balance
        const balance = await ethers.provider.getBalance(account.address);
        console.log(`Current Balance: ${ethers.formatEther(balance)} ETH`);
        
        return; // Found the account, exit
      }
    }
  }
  
  console.log("\n❌ Could not find account with 20 ETH premium");
  console.log("Current oracle value:", (await contract.getLatestPrice()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });