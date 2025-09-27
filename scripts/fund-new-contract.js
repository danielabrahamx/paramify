const { ethers } = require("hardhat");

async function main() {
  console.log("=== Funding New Contract ===");
  
  const [admin] = await ethers.getSigners();
  const contractAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  
  console.log("Funding from:", admin.address);
  console.log("Contract address:", contractAddress);
  
  // Send 5 ETH to the contract
  const fundingAmount = ethers.parseEther("5");
  const tx = await admin.sendTransaction({
    to: contractAddress,
    value: fundingAmount
  });
  await tx.wait();
  
  console.log("Funded contract with 5 ETH");
  
  // Check new balance
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  const balance = await contract.getContractBalance();
  console.log("New contract balance:", ethers.formatEther(balance), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });