const { ethers } = require("hardhat");

async function main() {
  // Get accounts
  const accounts = await ethers.getSigners();
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  console.log("=== Account and Policy Check ===");
  
  // Check all accounts
  for (let i = 0; i < Math.min(accounts.length, 5); i++) {
    const account = accounts[i];
    console.log(`\nAccount ${i}: ${account.address}`);
    
    try {
      const policy = await contract.policies(account.address);
      console.log(`- Has Active Policy: ${policy.active}`);
      console.log(`- Premium (ETH): ${ethers.formatEther(policy.premium)}`);
      console.log(`- PayoutRatePerSecond (wei): ${policy.payoutRatePerSecond.toString()}`);
      console.log(`- Paid Out: ${policy.paidOut}`);
      
      if (policy.active || policy.paidOut) {
        console.log(`👥 This account has/had a policy!`);
      }
    } catch (error) {
      console.log(`- Error checking policy: ${error.message}`);
    }
  }
  
  // Check specific accounts that frontend might use
  const customerAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"; // Example from README
  console.log(`\n=== Checking Customer Address from README ===`);
  console.log(`Customer: ${customerAddress}`);
  
  try {
    const policy = await contract.policies(customerAddress);
    console.log(`- Has Active Policy: ${policy.active}`);
    console.log(`- Premium (ETH): ${ethers.formatEther(policy.premium)}`);
    console.log(`- PayoutRatePerSecond (wei): ${policy.payoutRatePerSecond.toString()}`);
    console.log(`- Paid Out: ${policy.paidOut}`);
  } catch (error) {
    console.log(`- Error: ${error.message}`);
  }
  
  // Check contract balance and oracle value
  console.log(`\n=== Contract Status ===`);
  const contractBalance = await contract.getContractBalance();
  console.log(`Contract Balance: ${ethers.formatEther(contractBalance)} ETH`);
  
  const oracleValue = await contract.getLatestPrice();
  console.log(`Oracle Value (outage duration): ${oracleValue.toString()} seconds`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });