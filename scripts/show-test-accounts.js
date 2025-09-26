const { ethers } = require("hardhat");

async function main() {
  console.log("=== Account Information for Testing ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Get all test accounts
  const accounts = await ethers.getSigners();
  
  console.log("🏦 Available Test Accounts:");
  console.log("==========================");
  
  for (let i = 0; i < 10; i++) {
    const account = accounts[i];
    const balance = await ethers.provider.getBalance(account.address);
    const policy = await contract.policies(account.address);
    
    console.log(`\nAccount ${i}: ${account.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (policy.active) {
      console.log(`✅ ACTIVE POLICY - Payout Rate: ${ethers.formatEther(policy.payoutRatePerSecond)} ETH/sec`);
      const oracleValue = await contract.getLatestPrice();
      const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
      console.log(`   Expected Payout: ${ethers.formatEther(expectedPayout)} ETH`);
    } else if (policy.premium > 0) {
      if (policy.paidOut) {
        console.log(`💰 PAID OUT - Previous Premium: ${ethers.formatEther(policy.premium)} ETH`);
      } else {
        console.log(`❌ INACTIVE - Premium: ${ethers.formatEther(policy.premium)} ETH`);
      }
    } else {
      console.log(`⚪ NO POLICY`);
    }
  }
  
  // Show current oracle value
  const oracleValue = await contract.getLatestPrice();
  console.log(`\n🔮 Current Oracle Value: ${oracleValue} seconds`);
  
  // Show contract balance
  const contractBalance = await contract.getContractBalance();
  console.log(`💎 Contract Balance: ${ethers.formatEther(contractBalance)} ETH`);
  
  console.log("\n📋 INSTRUCTIONS FOR TESTING:");
  console.log("================================");
  console.log("1. Import Account 3 into MetaMask:");
  console.log("   Address: 0x90F79bf6EB2c4f870365E785982E1f101E93b906");
  console.log("   Private Key: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
  console.log("");
  console.log("2. This account has an ACTIVE policy that should pay out ~5 ETH");
  console.log("3. Connect to the frontend and trigger the payout");
  console.log("4. You should see the balance increase by ~5 ETH (minus gas costs)");
  console.log("");
  console.log("5. To test new insurance purchases, use any account with NO POLICY");
  console.log("6. Use payout rates >= 0.001 ETH/minute to avoid zero payout issues");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });