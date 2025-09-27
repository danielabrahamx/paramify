const { ethers } = require("hardhat");

async function main() {
  console.log("=== Fixing Oracle for New Contract ===");
  
  const mockOracleAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
  const mockOracle = await ethers.getContractAt("MockV3Aggregator", mockOracleAddress);
  
  console.log("Mock Oracle Address:", mockOracleAddress);
  
  // Check current oracle value
  const currentValue = await mockOracle.latestAnswer();
  console.log("Current oracle value:", currentValue.toString());
  
  // Set it to 12 seconds (reasonable outage duration)
  console.log("Setting oracle to 12 seconds...");
  const tx = await mockOracle.updateAnswer(12);
  await tx.wait();
  
  const newValue = await mockOracle.latestAnswer();
  console.log("New oracle value:", newValue.toString());
  
  // Also check the contract to make sure it reads the correct value
  const contractAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  const contractOracleValue = await contract.getLatestPrice();
  console.log("Contract reads oracle value as:", contractOracleValue.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });