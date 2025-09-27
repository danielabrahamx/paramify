const { ethers } = require("hardhat");

async function main() {
  console.log("=== MetaMask Account Information for Testing ===");
  
  // Get the test account that has the working policy
  const testAccount = await ethers.getSigner("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
  const contractAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  console.log("📋 Account Details:");
  console.log("Address:", testAccount.address);
  console.log("Private Key: 0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0");
  console.log();
  
  // Check account balance
  const balance = await ethers.provider.getBalance(testAccount.address);
  console.log("Account Balance:", ethers.formatEther(balance), "ETH");
  
  // Check policy details
  const policy = await contract.policies(testAccount.address);
  console.log("\n🏠 Insurance Policy:");
  console.log("- Status:", policy.active ? "Active" : "Inactive");
  console.log("- Premium Paid:", ethers.formatEther(policy.premium), "ETH");
  console.log("- Payout Rate per Second:", ethers.formatEther(policy.payoutRatePerSecond), "ETH");
  console.log("- Already Paid Out:", policy.paidOut ? "Yes" : "No");
  
  // Calculate potential payout
  const oracleValue = await contract.getLatestPrice();
  const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
  
  console.log("\n💰 Payout Information:");
  console.log("- Current Outage Duration:", oracleValue.toString(), "seconds");
  console.log("- Expected Payout:", ethers.formatEther(expectedPayout), "ETH");
  
  console.log("\n🔧 Setup Instructions:");
  console.log("1. Import the above private key into MetaMask");
  console.log("2. Make sure you're connected to Hardhat Local Network (http://localhost:8545, Chain ID: 31337)");
  console.log("3. Refresh your frontend page");
  console.log("4. Connect with this account");
  console.log("5. Click 'Claim Outage Payout' - it should work now!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });