const { ethers } = require("hardhat");

async function main() {
  console.log("=== Setting Proper Outage Duration ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Set a reasonable outage duration (300 seconds = 5 minutes)
  const outageDuration = 300;
  
  console.log(`Setting outage duration to ${outageDuration} seconds (5 minutes)`);
  
  const [admin] = await ethers.getSigners();
  const tx = await contract.connect(admin).setOutageDuration(outageDuration);
  await tx.wait();
  
  console.log("✅ Outage duration set successfully!");
  
  // Verify
  const currentValue = await contract.getLatestPrice();
  console.log("Current oracle value:", currentValue.toString(), "seconds");
  
  // Calculate expected payout for the active policy
  const customerAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
  const policy = await contract.policies(customerAddress);
  
  if (policy.active) {
    const expectedPayout = BigInt(currentValue) * policy.payoutRatePerSecond;
    console.log(`Expected payout for customer: ${ethers.formatEther(expectedPayout)} ETH`);
    console.log("Customer can now claim this payout!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });