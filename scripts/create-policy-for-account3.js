const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Policy for Account 3 (Clean Slate) ===");
  
  const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Account 3 - fresh account for testing
  const account3Address = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  const account3 = await ethers.getSigner(account3Address);
  
  console.log("Creating policy for Account 3:", account3Address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(account3Address)), "ETH");
  
  // Check if account already has a policy
  const existingPolicy = await contract.policies(account3Address);
  if (existingPolicy.active) {
    console.log("❌ Account already has an active policy");
    return;
  }
  
  // Use 4 ETH per minute (like in your frontend test)
  const payoutRatePerMinute = ethers.parseEther("4");
  const premium = payoutRatePerMinute * 2n; // Contract requires 2x
  
  console.log("Creating policy with:");
  console.log("- Payout rate per minute:", ethers.formatEther(payoutRatePerMinute), "ETH");
  console.log("- Premium (2x rate):", ethers.formatEther(premium), "ETH");
  
  const tx = await contract.connect(account3).buyInsurance(payoutRatePerMinute, { value: premium });
  await tx.wait();
  
  console.log("✅ Policy created successfully!");
  console.log("Transaction hash:", tx.hash);
  
  // Verify the policy
  const policy = await contract.policies(account3Address);
  console.log("\nPolicy Details:");
  console.log("- Active:", policy.active);
  console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
  console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
  console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
  
  // Calculate expected payout for 12 seconds
  const oracleValue = await contract.getLatestPrice();
  const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
  console.log("\nExpected payout for", oracleValue.toString(), "seconds outage:");
  console.log("- Amount (ETH):", ethers.formatEther(expectedPayout));
  
  console.log("\n✅ Ready for testing!");
  console.log("Account 3 private key for MetaMask:");
  console.log("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });