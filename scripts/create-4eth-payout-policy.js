const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Policy with Rate for 4 ETH Payout ===");
  
  const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Account 4 - fresh account
  const account4Address = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
  const account4 = await ethers.getSigner(account4Address);
  
  console.log("Account 4:", account4Address);
  
  // To get 4 ETH for 12 seconds outage:
  // Need: 4 ETH ÷ 12 seconds × 60 seconds = 20 ETH per minute
  const payoutRatePerMinute = ethers.parseEther("20"); // 20 ETH per minute
  const premium = payoutRatePerMinute * 2n; // 40 ETH premium
  
  console.log("Setting up policy for 4 ETH payout in 12 seconds:");
  console.log("- Required rate: 20 ETH per minute");
  console.log("- Premium: 40 ETH");
  console.log("- PayoutRatePerSecond: 20/60 = 0.333 ETH per second");
  console.log("- 12 seconds × 0.333 = 4 ETH ✅");
  
  try {
    const tx = await contract.connect(account4).buyInsurance(payoutRatePerMinute, { value: premium });
    await tx.wait();
    
    console.log("✅ Policy created!");
    console.log("Transaction hash:", tx.hash);
    
    // Verify
    const policy = await contract.policies(account4Address);
    const oracleValue = await contract.getLatestPrice();
    const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
    
    console.log("\nVerification:");
    console.log("- PayoutRatePerSecond:", ethers.formatEther(policy.payoutRatePerSecond), "ETH");
    console.log("- Expected payout for 12 seconds:", ethers.formatEther(expectedPayout), "ETH");
    
    console.log("\n🎯 Use Account 4 to get your 4 ETH payout!");
    console.log("Private key: 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a");
    
  } catch (error) {
    console.log("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });