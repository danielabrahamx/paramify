const { ethers } = require("hardhat");

async function main() {
  const contract = await ethers.getContractAt("Insuracle", "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512");
  const balance = await contract.getContractBalance();
  console.log("Contract Balance:", ethers.formatEther(balance), "ETH");
}

main().catch(console.error);
