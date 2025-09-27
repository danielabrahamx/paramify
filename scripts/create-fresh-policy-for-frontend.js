const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Fresh Policy for Frontend Testing ===");
  
  const [admin, customer] = await ethers.getSigners();
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Use account 2 for a fresh test
  const testCustomer = await ethers.getSigner("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  console.log("Test customer address:", testCustomer.address);
  
  // Check if this customer already has a policy
  const existingPolicy = await contract.policies(testCustomer.address);
  if (existingPolicy.active || existingPolicy.paidOut) {
    console.log("Customer already has a policy. Using account 3 instead.");
    const testCustomer3 = await ethers.getSigner("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
    console.log("Test customer 3 address:", testCustomer3.address);
    
    const policy3 = await contract.policies(testCustomer3.address);
    if (policy3.active || policy3.paidOut) {
      console.log("Account 3 also has a policy. Creating a new policy anyway to test.");
    }
  }
  
  // Let's create a simple 0.01 ETH per minute policy
  const payoutRatePerMinute = "0.01"; // 0.01 ETH per minute
  const payoutRateInWei = ethers.parseEther(payoutRatePerMinute);
  const premiumInWei = ethers.parseEther((parseFloat(payoutRatePerMinute) * 2).toString()); // 0.02 ETH premium
  
  console.log("Creating policy with:");
  console.log("- Payout rate per minute:", payoutRatePerMinute, "ETH");
  console.log("- Premium:", ethers.formatEther(premiumInWei), "ETH");
  
  try {
    // Use account 4 for a clean test
    const testCustomer4 = await ethers.getSigner("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65");
    console.log("Using test customer 4:", testCustomer4.address);
    
    const policy4 = await contract.policies(testCustomer4.address);
    if (policy4.active) {
      console.log("Account 4 has active policy. Checking payout eligibility...");
      
      const isEligible = await contract.isPayoutEligible(testCustomer4.address);
      if (isEligible) {
        console.log("Policy is eligible for payout. Triggering payout first...");
        const payoutTx = await contract.connect(testCustomer4).triggerPayout();
        await payoutTx.wait();
        console.log("Payout completed for account 4");
      }
    }
    
    // Now create fresh policy with account 5
    const testCustomer5 = await ethers.getSigner("0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc");
    console.log("Creating fresh policy with account 5:", testCustomer5.address);
    
    const balance5 = await ethers.provider.getBalance(testCustomer5.address);
    console.log("Account 5 balance:", ethers.formatEther(balance5), "ETH");
    
    if (balance5 < premiumInWei) {
      console.log("Insufficient balance for premium");
      return;
    }
    
    const tx = await contract.connect(testCustomer5).buyInsurance(payoutRateInWei, { value: premiumInWei });
    await tx.wait();
    console.log("✅ Fresh policy created successfully!");
    
    // Verify the policy
    const newPolicy = await contract.policies(testCustomer5.address);
    console.log("New Policy Details:");
    console.log("- Active:", newPolicy.active);
    console.log("- Premium (ETH):", ethers.formatEther(newPolicy.premium));
    console.log("- PayoutRatePerSecond (wei):", newPolicy.payoutRatePerSecond.toString());
    console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(newPolicy.payoutRatePerSecond));
    console.log("- Paid Out:", newPolicy.paidOut);
    
    // Calculate expected payout
    const outageDuration = await contract.getLatestPrice();
    const expectedPayout = BigInt(outageDuration) * newPolicy.payoutRatePerSecond;
    console.log("Expected payout for", outageDuration.toString(), "seconds outage:");
    console.log("- Amount (ETH):", ethers.formatEther(expectedPayout));
    
    console.log("\n✅ Ready for frontend testing!");
    console.log("Use account:", testCustomer5.address);
    console.log("Private key: Import account 5 into MetaMask for testing");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });