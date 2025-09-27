const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Test Policy for Stopwatch Functionality ===");
  
  const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Account 5 - fresh account for testing
  const account5Address = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
  const account5 = await ethers.getSigner(account5Address);
  
  console.log("Account 5:", account5Address);
  
  // 4 ETH per minute policy
  const payoutRatePerMinute = ethers.parseEther("4"); 
  const premium = payoutRatePerMinute * 2n; // 8 ETH premium
  
  console.log("Creating policy:");
  console.log("- Rate: 4 ETH per minute");
  console.log("- Premium: 8 ETH");
  console.log("- 60 seconds = 4 ETH payout ✅");
  console.log("- 30 seconds = 2 ETH payout ✅");
  console.log("- Your actual stopwatch time will be used!");
  
  try {
    const tx = await contract.connect(account5).buyInsurance(payoutRatePerMinute, { value: premium });
    await tx.wait();
    
    console.log("✅ Policy created!");
    console.log("Transaction hash:", tx.hash);
    
    // Grant admin role to Account 5 too
    console.log("\nGranting admin role to Account 5...");
    const [deployer] = await ethers.getSigners();
    const adminRole = ethers.id('DEFAULT_ADMIN_ROLE');
    const grantTx = await contract.connect(deployer).grantRole(adminRole, account5Address);
    await grantTx.wait();
    console.log("✅ Admin role granted!");
    
    console.log("\n🎯 READY FOR TESTING:");
    console.log("1. Import Account 5 private key: 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba");
    console.log("2. Connect to frontend");
    console.log("3. Use stopwatch for ANY duration you want");
    console.log("4. Payout = (stopwatch seconds ÷ 60) × 4 ETH");
    console.log("5. 60 seconds = 4 ETH, 30 seconds = 2 ETH, etc.");
    
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