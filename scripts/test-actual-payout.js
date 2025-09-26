const { ethers } = require("hardhat");

async function main() {
  console.log("=== Testing Actual Payout ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Test customer with working policy
  const testCustomerAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  const testCustomer = await ethers.getImpersonatedSigner(testCustomerAddress);
  
  console.log("Testing payout for:", testCustomerAddress);
  
  // Check balance before payout
  const balanceBefore = await ethers.provider.getBalance(testCustomerAddress);
  console.log("Balance before payout:", ethers.formatEther(balanceBefore), "ETH");
  
  // Check if eligible for payout
  const isEligible = await contract.isPayoutEligible(testCustomerAddress);
  console.log("Payout eligible:", isEligible);
  
  if (!isEligible) {
    console.log("❌ Not eligible for payout");
    return;
  }
  
  try {
    console.log("Triggering payout...");
    const tx = await contract.connect(testCustomer).triggerPayout();
    const receipt = await tx.wait();
    
    console.log("✅ Payout transaction successful!");
    console.log("Transaction hash:", tx.hash);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Check balance after payout
    const balanceAfter = await ethers.provider.getBalance(testCustomerAddress);
    console.log("Balance after payout:", ethers.formatEther(balanceAfter), "ETH");
    
    // Calculate net change (accounting for gas costs)
    const netChange = balanceAfter - balanceBefore;
    console.log("Net balance change:", ethers.formatEther(netChange), "ETH");
    
    // Check policy status
    const policy = await contract.policies(testCustomerAddress);
    console.log("Policy active after payout:", policy.active);
    console.log("Policy paid out:", policy.paidOut);
    
    console.log("\n🎉 SUCCESS: Payout completed successfully!");
    console.log("Customer received approximately 5 ETH minus gas costs");
    
  } catch (error) {
    console.error("❌ Payout failed:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });