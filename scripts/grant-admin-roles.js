const { ethers } = require("hardhat");

async function main() {
  console.log("=== Granting Admin Role to Test Accounts ===");
  
  const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  const [deployer] = await ethers.getSigners();
  console.log("Admin (deployer):", deployer.address);
  
  // Accounts to grant admin role
  const accounts = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Account 1
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Account 2
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Account 3
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // Account 4
  ];
  
  const adminRole = ethers.id('DEFAULT_ADMIN_ROLE');
  console.log("Admin role hash:", adminRole);
  
  for (const account of accounts) {
    try {
      console.log(`\nGranting admin role to ${account}...`);
      const tx = await contract.grantRole(adminRole, account);
      await tx.wait();
      console.log("✅ Admin role granted!");
      
      // Verify
      const hasRole = await contract.hasRole(adminRole, account);
      console.log("Verification - Has admin role:", hasRole);
      
    } catch (error) {
      console.log("❌ Error:", error.message);
    }
  }
  
  console.log("\n🎉 Now your accounts can set custom outage durations!");
  console.log("The stopwatch time will be used instead of the fixed 12 seconds.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });