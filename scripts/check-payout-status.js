const { ethers } = require("hardhat");

async function main() {
  console.log("=== Checking Active Policies for Payout ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Check which account you might be using in the frontend
  const adminAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const customerAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"; // From README
  
  console.log("Admin address:", adminAddress);
  console.log("Customer address:", customerAddress);
  
  // Check both addresses
  const addresses = [adminAddress, customerAddress];
  
  for (const addr of addresses) {
    console.log(`\n=== Checking ${addr} ===`);
    const policy = await contract.policies(addr);
    
    console.log("- Active:", policy.active);
    console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
    console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
    console.log("- Paid Out:", policy.paidOut);
    
    if (policy.active) {
      console.log("✅ This address has an ACTIVE policy!");
      
      // Check if eligible for payout
      const isEligible = await contract.isPayoutEligible(addr);
      console.log("- Payout Eligible:", isEligible);
      
      const oracleValue = await contract.getLatestPrice();
      if (oracleValue > 0 && policy.payoutRatePerSecond > 0) {
        const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
        console.log("- Expected Payout (ETH):", ethers.formatEther(expectedPayout));
      }
    } else if (policy.premium > 0) {
      console.log("ℹ️ This address had a policy but it's no longer active");
    } else {
      console.log("❌ No policy found for this address");
    }
    
    // Check balance
    const balance = await ethers.provider.getBalance(addr);
    console.log("- Current Balance (ETH):", ethers.formatEther(balance));
  }
  
  // Check oracle value
  const oracleValue = await contract.getLatestPrice();
  console.log("\nCurrent Oracle Value:", oracleValue.toString(), "seconds");
  
  // Check contract balance
  const contractBalance = await contract.getContractBalance();
  console.log("Contract Balance (ETH):", ethers.formatEther(contractBalance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });