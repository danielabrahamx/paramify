const { ethers } = require("hardhat");

async function main() {
  console.log("=== Setting up NEW contracts properly ===");
  
  const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const oracleAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  const oracle = await ethers.getContractAt("MockV3Aggregator", oracleAddress);
  
  console.log("New contract address:", contractAddress);
  console.log("New oracle address:", oracleAddress);
  
  // 1. Fund the contract
  const [admin] = await ethers.getSigners();
  console.log("\n1. Funding contract...");
  const fundTx = await admin.sendTransaction({
    to: contractAddress,
    value: ethers.parseEther("2.0")
  });
  await fundTx.wait();
  console.log("✅ Contract funded with 2 ETH");
  
  // 2. Set oracle to 12 seconds
  console.log("\n2. Setting oracle to 12 seconds...");
  const setOracleTx = await oracle.updateAnswer(12);
  await setOracleTx.wait();
  const oracleValue = await contract.getLatestPrice();
  console.log("✅ Oracle set to:", oracleValue.toString(), "seconds");
  
  // 3. Create policy for Account 1 with PROPER rate
  console.log("\n3. Creating policy for Account 1...");
  const account1Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const account1 = await ethers.getSigner(account1Address);
  
  // Use 0.06 ETH per minute = 60000000000000000 wei per minute
  // 60000000000000000 / 60 = 1000000000000000 wei per second (NOT ZERO!)
  const payoutRatePerMinute = ethers.parseEther("0.06");
  const premium = payoutRatePerMinute * 2n; // Contract requires 2x
  
  console.log("- Payout rate per minute:", ethers.formatEther(payoutRatePerMinute), "ETH");
  console.log("- Premium (2x rate):", ethers.formatEther(premium), "ETH");
  
  const policyTx = await contract.connect(account1).buyInsurance(payoutRatePerMinute, { value: premium });
  await policyTx.wait();
  console.log("✅ Policy created for Account 1");
  
  // 4. Verify everything works
  console.log("\n4. Verifying...");
  const policy = await contract.policies(account1Address);
  console.log("- Active:", policy.active);
  console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
  console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
  
  const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
  console.log("- Expected payout (wei):", expectedPayout.toString());
  console.log("- Expected payout (ETH):", ethers.formatEther(expectedPayout));
  
  if (expectedPayout > 0n) {
    console.log("\n🎉 SUCCESS! Payout will work now!");
    console.log("Account 1 can now successfully trigger payouts!");
  } else {
    console.log("\n❌ Still broken somehow...");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });