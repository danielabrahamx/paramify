const { ethers } = require("hardhat");

async function main() {
  console.log("=== Testing Account 3 Payout (Debug Calculation) ===");
  
  const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  const account3Address = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  const account3 = await ethers.getSigner(account3Address);
  
  console.log("Account 3:", account3Address);
  
  // Get balance before
  const balanceBefore = await ethers.provider.getBalance(account3Address);
  console.log("Balance before:", ethers.formatEther(balanceBefore), "ETH");
  
  // Check policy details
  const policy = await contract.policies(account3Address);
  console.log("\nPolicy Details:");
  console.log("- Active:", policy.active);
  console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
  console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
  
  // Check oracle value
  const oracleValue = await contract.getLatestPrice();
  console.log("\nOracle Details:");
  console.log("- Oracle Value (seconds):", oracleValue.toString());
  
  // Calculate expected payout
  const expectedPayoutWei = BigInt(oracleValue) * policy.payoutRatePerSecond;
  console.log("\nCalculation:");
  console.log("- Oracle Value:", oracleValue.toString(), "seconds");
  console.log("- PayoutRatePerSecond:", policy.payoutRatePerSecond.toString(), "wei/second");
  console.log("- Expected Payout (wei):", expectedPayoutWei.toString());
  console.log("- Expected Payout (ETH):", ethers.formatEther(expectedPayoutWei));
  
  if (!policy.active) {
    console.log("❌ Policy is not active. Cannot test payout.");
    return;
  }
  
  // Trigger payout
  console.log("\n🔥 TRIGGERING PAYOUT...");
  try {
    const tx = await contract.connect(account3).triggerPayout();
    const receipt = await tx.wait();
    
    console.log("✅ PAYOUT SUCCESS!");
    console.log("Transaction hash:", tx.hash);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Get balance after
    const balanceAfter = await ethers.provider.getBalance(account3Address);
    console.log("\nBalance after:", ethers.formatEther(balanceAfter), "ETH");
    
    const actualReceived = balanceAfter - balanceBefore;
    console.log("Actual received (including gas):", ethers.formatEther(actualReceived), "ETH");
    
    // Estimate gas cost
    const gasPrice = receipt.gasPrice;
    const gasCost = receipt.gasUsed * gasPrice;
    const payoutReceived = actualReceived + gasCost;
    
    console.log("\nBreakdown:");
    console.log("- Gas cost:", ethers.formatEther(gasCost), "ETH");
    console.log("- Payout received:", ethers.formatEther(payoutReceived), "ETH");
    console.log("- Expected payout:", ethers.formatEther(expectedPayoutWei), "ETH");
    
    const difference = payoutReceived - expectedPayoutWei;
    console.log("- Difference:", ethers.formatEther(difference), "ETH");
    
    if (Math.abs(Number(ethers.formatEther(difference))) < 0.0001) {
      console.log("✅ Payout amount is CORRECT!");
    } else {
      console.log("❌ Payout amount is INCORRECT!");
      console.log("This suggests a calculation bug in the contract or frontend display.");
    }
    
  } catch (error) {
    console.log("❌ Payout failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });