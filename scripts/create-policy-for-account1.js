const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Policy for Account 1 (Your Existing Wallet) ===");
  
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Account 1 - the one you've been using
  const account1Address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const account1 = await ethers.getSigner(account1Address);
  
  console.log("Creating policy for:", account1Address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(account1Address)), "ETH");
  
  // Check if account already has a policy
  try {
    const existingPolicy = await contract.policies(account1Address);
    if (existingPolicy.active) {
      console.log("❌ Account already has an active policy");
      return;
    }
    if (existingPolicy.paidOut) {
      console.log("ℹ️ Account had a previous policy that was paid out - creating new one");
    }
  } catch (error) {
    console.log("ℹ️ No existing policy found - creating new one");
  }
  
  // Create policy: 0.01 ETH per minute, premium = 0.02 ETH
  const payoutRatePerMinute = ethers.parseEther("0.01");
  const premium = ethers.parseEther("0.02");
  
  console.log("Creating policy with:");
  console.log("- Payout rate per minute:", ethers.formatEther(payoutRatePerMinute), "ETH");
  console.log("- Premium:", ethers.formatEther(premium), "ETH");
  
  const tx = await contract.connect(account1).buyInsurance(payoutRatePerMinute, { value: premium });
  await tx.wait();
  
  console.log("✅ Policy created successfully!");
  console.log("Transaction hash:", tx.hash);
  
  // Verify the policy
  const policy = await contract.policies(account1Address);
  console.log("\nPolicy Details:");
  console.log("- Active:", policy.active);
  console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
  console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
  console.log("- Paid Out:", policy.paidOut);
  
  // Calculate expected payout for 12 seconds (current oracle value)
  const oracleValue = await contract.getLatestPrice();
  const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
  console.log("\nExpected payout for", oracleValue.toString(), "seconds outage:");
  console.log("- Amount (ETH):", ethers.formatEther(expectedPayout));
  
  console.log("\n✅ Ready! You can now use your existing wallet:", account1Address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });