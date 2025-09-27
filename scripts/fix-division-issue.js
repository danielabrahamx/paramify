const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Policy with Larger Rate (Avoiding Division Issue) ===");
  
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Account 2 - create new policy with proper rate
  const account2Address = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const account2 = await ethers.getSigner(account2Address);
  
  console.log("Creating policy for Account 2:", account2Address);
  
  // Use 0.06 ETH per minute (60 times larger to avoid division issues)
  // 0.06 ETH = 60000000000000000 wei
  // 60000000000000000 / 60 = 1000000000000000 wei per second (not zero!)
  const payoutRatePerMinute = ethers.parseEther("0.06"); // Larger rate
  const premium = payoutRatePerMinute * 2n; // Contract requires 2x
  
  console.log("Using larger payout rate to avoid division by 60 = 0:");
  console.log("- Payout rate per minute:", ethers.formatEther(payoutRatePerMinute), "ETH");
  console.log("- Premium (2x rate):", ethers.formatEther(premium), "ETH");
  
  // Test the division first
  const payoutRatePerMinuteWei = BigInt(payoutRatePerMinute);
  const payoutRatePerSecondWei = payoutRatePerMinuteWei / 60n;
  console.log("- Division test:");
  console.log("  - Per minute (wei):", payoutRatePerMinuteWei.toString());
  console.log("  - Per second (wei):", payoutRatePerSecondWei.toString());
  console.log("  - Per second (ETH):", ethers.formatEther(payoutRatePerSecondWei));
  
  if (payoutRatePerSecondWei === 0n) {
    console.log("❌ Still would result in 0! Need even larger rate.");
    return;
  }
  
  const tx = await contract.connect(account2).buyInsurance(payoutRatePerMinute, { value: premium });
  await tx.wait();
  
  console.log("✅ Policy created successfully!");
  console.log("Transaction hash:", tx.hash);
  
  // Verify the policy
  const policy = await contract.policies(account2Address);
  console.log("\nVerified Policy Details:");
  console.log("- Active:", policy.active);
  console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
  console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
  console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
  
  // Calculate expected payout for 12 seconds
  const oracleValue = await contract.getLatestPrice();
  const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
  console.log("\nExpected payout for", oracleValue.toString(), "seconds outage:");
  console.log("- Amount (wei):", expectedPayout.toString());
  console.log("- Amount (ETH):", ethers.formatEther(expectedPayout));
  
  console.log("\n✅ Fixed! Payout should now work.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });