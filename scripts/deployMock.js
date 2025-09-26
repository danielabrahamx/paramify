const hre = require("hardhat");

async function main() {
  const MockV3Aggregator = await hre.ethers.getContractFactory("MockV3Aggregator");
  const mock = await MockV3Aggregator.deploy(0, 0); // 0 decimals, initial outage duration: 0 seconds (no outage)
  await mock.waitForDeployment();
  const mockAddress = await mock.getAddress();
  console.log("MockV3Aggregator deployed to:", mockAddress);

  const Paramify = await hre.ethers.getContractFactory("Paramify");
  const paramify = await Paramify.deploy(mockAddress);
  await paramify.waitForDeployment();
  const paramifyAddress = await paramify.getAddress();
  console.log("Paramify deployed to:", paramifyAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
