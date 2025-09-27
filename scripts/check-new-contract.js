const { ethers } = require("hardhat");

async function main() {
  console.log("=== Checking NEW Contract Policy Status ===");
  
  const newContractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const contract = await ethers.getContractAt("Paramify", newContractAddress);
  
  console.log("=== Checking New Contract State ===");
  console.log("Contract Address:", contractAddress);
  
  // Check oracle value
  const oracleValue = await contract.getLatestPrice();
  console.log("Oracle value:", oracleValue.toString(), "seconds");
  
  // Check contract balance
  const balance = await contract.getContractBalance();
  console.log("Contract balance:", ethers.formatEther(balance), "ETH");
  
  // Check policies for test accounts
  const [admin, customer, customer2] = await ethers.getSigners();
  
  const customerPolicy = await contract.policies(customer.address);
  console.log("\nCustomer Policy:");
  console.log("- Address:", customer.address);
  console.log("- Active:", customerPolicy.active);
  console.log("- Premium (ETH):", ethers.formatEther(customerPolicy.premium));
  console.log("- PayoutRatePerSecond (wei):", customerPolicy.payoutRatePerSecond.toString());
  console.log("- Paid Out:", customerPolicy.paidOut);
  
  if (customerPolicy.active && !customerPolicy.paidOut) {
    const expectedPayout = BigInt(oracleValue) * customerPolicy.payoutRatePerSecond;
    console.log("- Expected Payout (wei):", expectedPayout.toString());
    console.log("- Expected Payout (ETH):", ethers.formatEther(expectedPayout));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });